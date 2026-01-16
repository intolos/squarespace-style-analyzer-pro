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

import { platformStrings } from '../utils/platform';

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
      // First check yearly product
      let resp = await fetch(
        `${this.API_BASE}/check-email?email=${encodeURIComponent(
          email
        )}&product_id=${encodeURIComponent(this.PRODUCT_ID_YEARLY)}`,
        { method: 'GET' }
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.valid) {
          return data;
        }
      }

      // If yearly not valid, check lifetime product
      resp = await fetch(
        `${this.API_BASE}/check-email?email=${encodeURIComponent(
          email
        )}&product_id=${encodeURIComponent(this.PRODUCT_ID_LIFETIME)}`,
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
        const lastCheck = data.lastLicenseCheck || 0;
        const hoursSinceLastCheck = (now - lastCheck) / (1000 * 60 * 60);

        if (hoursSinceLastCheck < 24) {
          console.log('License checked recently, skipping verification');
          return;
        }

        console.log('Verifying license with Stripe in background (24+ hours since last check)');
        const result = await this.checkLicense(data.licenseEmail);

        if (result && result.valid) {
          await this.storageSet({
            isPremium: true,
            licenseData: result,
            lastLicenseCheck: now,
          });
          console.log('Background verification complete');
        } else {
          await this.storageSet({
            isPremium: false,
            lastLicenseCheck: now,
          });
          console.log('License expired or not found');
        }
      }
    } catch (error) {
      console.error('Background license verification failed:', error);
    }
  },
};
