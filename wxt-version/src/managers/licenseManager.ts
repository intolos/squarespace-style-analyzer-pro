// managers/licenseManager.ts
// Handles license verification and Stripe integration

export interface LicenseCheckResult {
  valid: boolean;
  record?: any;
  error?: string;
  email?: string;
}

export interface CheckoutSessionResult {
  url?: string;
  id?: string;
  error?: string | any;
}

import { platformStrings, isSqs } from '../utils/platform';

export const LicenseManager = {
  // Configuration from platform settings
  API_BASE: platformStrings.stripe.apiBase,
  PRODUCT_ID_YEARLY: platformStrings.stripe.productIdYearly,
  PRICE_ID_YEARLY: platformStrings.stripe.priceIdYearly,
  PRODUCT_ID_LIFETIME: platformStrings.stripe.productIdLifetime,
  PRICE_ID_LIFETIME: platformStrings.stripe.priceIdLifetime,
  SUCCESS_URL_YEARLY: platformStrings.stripe.successUrlYearly,
  SUCCESS_URL_LIFETIME: platformStrings.stripe.successUrlLifetime,
  CANCEL_URL: platformStrings.stripe.cancelUrl,

  // Storage helpers
  async storageGet(keys: string[]) {
    return await chrome.storage.local.get(keys);
  },

  async storageSet(obj: Record<string, any>) {
    await chrome.storage.local.set(obj);
  },

  // Check license with Stripe
  async checkLicense(email: string): Promise<LicenseCheckResult> {
    try {
      // IMPORTANT: Check Lifetime first. If a user has both a legacy Yearly sub and a new
      // Lifetime license, we must detect Lifetime first to ensure correct UI labeling.
      // First check lifetime product (HIGHER PRIORITY)
      let resp = await fetch(
        `${this.API_BASE}/check-email?email=${encodeURIComponent(
          email
        )}&product_id=${encodeURIComponent(this.PRODUCT_ID_LIFETIME)}`,
        { method: 'GET' }
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.valid) {
          return data;
        }
      }

      // If lifetime not valid, check yearly product
      resp = await fetch(
        `${this.API_BASE}/check-email?email=${encodeURIComponent(
          email
        )}&product_id=${encodeURIComponent(this.PRODUCT_ID_YEARLY)}`,
        { method: 'GET' }
      );
      if (!resp.ok) {
        console.warn('checkLicense non-OK response', resp.status);
        return { valid: false };
      }
      const data = await resp.json();
      return data || { valid: false };
    } catch (err) {
      console.error('checkLicense error', err);
      return { valid: false };
    }
  },

  // Create Stripe checkout session
  async createCheckoutSession(
    email: string | null,
    isLifetime = false
  ): Promise<CheckoutSessionResult> {
    try {
      const priceId = isLifetime ? this.PRICE_ID_LIFETIME : this.PRICE_ID_YEARLY;
      const productId = isLifetime ? this.PRODUCT_ID_LIFETIME : this.PRODUCT_ID_YEARLY;
      const mode = isLifetime ? 'payment' : 'subscription';

      const requestBody: any = {
        email,
        product_id: productId,
        cancel_url: this.CANCEL_URL,
        priceId: priceId,
        mode: mode,
        // IMPORTANT: Pass extension_type directly so worker can stamp Customer metadata
        // without needing Product ID environment variables. Fixed 2026-01-23.
        extension_type: isSqs ? 'squarespace' : 'generic',
        purchase_type: isLifetime ? 'lifetime' : 'yearly',
      };

      if (isLifetime) {
        requestBody.success_url_lifetime = this.SUCCESS_URL_LIFETIME;
      } else {
        requestBody.success_url_yearly = this.SUCCESS_URL_YEARLY;
      }

      const resp = await fetch(`${this.API_BASE}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      if (!resp.ok) {
        console.error('createCheckoutSession HTTP error', resp.status);
        return { error: 'network' };
      }
      const data = await resp.json();
      return data;
    } catch (err: any) {
      console.error('createCheckoutSession error', err);
      return { error: err.message || 'unknown' };
    }
  },

  // Poll for checkout session completion
  pollForSessionCompletion(
    sessionId: string,
    productId: string | null,
    onComplete: (data: any) => void,
    timeoutMs = 300000,
    intervalMs = 5000
  ): () => void {
    const start = Date.now();
    let stopped = false;
    // Use provided productId or default to yearly
    const resolvedProductId = productId || this.PRODUCT_ID_YEARLY;

    const tick = async () => {
      if (stopped) return;
      const elapsed = Date.now() - start;
      if (elapsed > timeoutMs) {
        onComplete(null);
        return;
      }
      try {
        const resp = await fetch(`${this.API_BASE}/redeem-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            product_id: resolvedProductId,
          }),
        });
        const data = await resp.json();
        console.log('poll session result:', data);
        if (data && data.ok && data.email) {
          onComplete(data);
          return;
        }
      } catch (e) {
        console.warn('poll session error', e);
      }
      setTimeout(tick, intervalMs);
    };

    tick();
    return () => {
      stopped = true;
    };
  },

  // Verify stored license in background
  async verifyStoredLicenseInBackground(): Promise<void> {
    try {
      const data = await this.storageGet(['licenseEmail', 'isPremium', 'lastLicenseCheck']);

      if (data.licenseEmail) {
        const now = Date.now();
        const lastCheck = typeof data.lastLicenseCheck === 'number' ? data.lastLicenseCheck : 0;
        const hoursSinceLastCheck = (now - lastCheck) / (1000 * 60 * 60);

        if (hoursSinceLastCheck < 24) {
          console.log('License checked recently, skipping verification');
          return;
        }

        console.log('Verifying license with Stripe in background (24+ hours since last check)');
        const result = await this.checkLicense(data.licenseEmail as string);

        if (result && result.valid) {
          await this.storageSet({
            isPremium: true,
            licenseData: result,
            lastLicenseCheck: now,
          });
          console.log('Background verification complete');
        } else {
          // IMPORTANT: Notify user that their subscription has expired.
          // Check if we've already notified them to avoid spam.
          const notificationData = await this.storageGet(['licenseExpiredNotificationShown']);
          const wasActive = data.isPremium === true;

          await this.storageSet({
            isPremium: false,
            lastLicenseCheck: now,
          });
          console.log('License expired or not found');

          // Only notify if they were previously active and we haven't notified yet
          if (wasActive && !notificationData.licenseExpiredNotificationShown) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: chrome.runtime.getURL('icon/128.png'),
              title: 'Premium Subscription Expired',
              message:
                'Your yearly premium subscription has expired. Click "Check Premium Status" to renew or verify your license.',
              priority: 2,
            });

            // Mark that we've shown the notification
            await this.storageSet({
              licenseExpiredNotificationShown: true,
            });
          }
        }
      }
    } catch (error) {
      console.error('Background license verification failed:', error);
    }
  },

  // Report issues to backend (e.g. unknown product IDs)
  async reportIssue(type: string, details: any): Promise<void> {
    try {
      // Don't report if offline or no API base
      if (!this.API_BASE) return;

      const resp = await fetch(`${this.API_BASE}/report-issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, details }),
      });

      if (!resp.ok) {
        console.warn('Failed to report issue:', resp.status);
      }
    } catch (e) {
      console.warn('Error reporting issue:', e);
    }
  },
};
