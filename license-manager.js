// license-manager.js - License and Stripe Integration
// Handles premium license verification and upgrade flow

const LicenseManager = {
  // ============================================
  // EXTENSION-SPECIFIC CONFIGURATION
  // Change these values for each extension
  // ============================================
  API_BASE: 'https://squarespace-style-analyzer-pro.eamass.workers.dev',
  // Product 1: Squarespace Style Analyzer Pro (Yearly)
  PRODUCT_ID_YEARLY: 'prod_TOjJHIVm4hIXW0',
  PRICE_ID_YEARLY: 'price_1SRvr6Aoq9jsK93OKp1jn8d3',
  // Product 2: Squarespace Style Analyzer Pro, Lifetime
  PRODUCT_ID_LIFETIME: 'prod_TbiIroZ9oKQ8cT',
  PRICE_ID_LIFETIME: 'price_1SeUs2Aoq9jsK93OqaZJ8YIg',
  // Legacy: Keep for backward compatibility
  PRODUCT_ID: 'squarespace-style-analyzer',
  SUCCESS_URL_YEARLY:
    'https://intolos.github.io/squarespace-style-analyzer-pro/success-yearly.html?session_id={CHECKOUT_SESSION_ID}',
  SUCCESS_URL_LIFETIME:
    'https://intolos.github.io/squarespace-style-analyzer-pro/success-lifetime.html?session_id={CHECKOUT_SESSION_ID}',
  CANCEL_URL: 'https://intolos.github.io/squarespace-style-analyzer-pro/cancel.html',
  // ============================================

  // Storage helpers
  storageGet: function (keys) {
    return new Promise(resolve => {
      chrome.storage.local.get(keys, items => resolve(items));
    });
  },

  storageSet: function (obj) {
    return new Promise(resolve => {
      chrome.storage.local.set(obj, () => resolve());
    });
  },

  // Check license with Stripe - checks both yearly and lifetime products
  checkLicense: async function (email) {
    try {
      // First check yearly product
      let resp = await fetch(
        `${this.API_BASE}/check-email?email=${encodeURIComponent(email)}&product_id=${encodeURIComponent(this.PRODUCT_ID_YEARLY)}`,
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
        `${this.API_BASE}/check-email?email=${encodeURIComponent(email)}&product_id=${encodeURIComponent(this.PRODUCT_ID_LIFETIME)}`,
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
  createCheckoutSession: async function (email, isLifetime = false) {
    try {
      const priceId = isLifetime ? this.PRICE_ID_LIFETIME : this.PRICE_ID_YEARLY;
      const productId = isLifetime ? this.PRODUCT_ID_LIFETIME : this.PRODUCT_ID_YEARLY;
      const mode = isLifetime ? 'payment' : 'subscription';

      const requestBody = {
        email,
        product_id: productId,
        cancel_url: this.CANCEL_URL,
        priceId: priceId,
        mode: mode,
      };

      // Send the appropriate success URL field based on mode
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
    } catch (err) {
      console.error('createCheckoutSession error', err);
      return { error: err.message || 'unknown' };
    }
  },

  // Poll for license after checkout
  pollForLicense: function (email, onFound, timeoutMs = 120000, intervalMs = 5000) {
    const self = this;
    const start = Date.now();
    let stopped = false;

    async function tick() {
      if (stopped) return;
      const elapsed = Date.now() - start;
      if (elapsed > timeoutMs) {
        onFound(null);
        return;
      }
      try {
        const data = await self.checkLicense(email);
        console.log('poll check result:', data);
        if (data && data.valid) {
          onFound(data);
          return;
        }
      } catch (e) {
        console.warn('poll error', e);
      }
      setTimeout(tick, intervalMs);
    }
    tick();
    return () => {
      stopped = true;
    };
  },

  // Update UI elements for license status
  updateLicenseUI: async function () {
    const s = await this.storageGet(['isPremium', 'licenseEmail']);
    const statusEl = document.getElementById('statusText');
    const btn = document.getElementById('upgradeButton');
    const btnLifetime = document.getElementById('upgradeButtonLifetime');

    if (s.isPremium) {
      if (statusEl) statusEl.textContent = '✅ Premium active — thank you!';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Premium Activated';
      }
      if (btnLifetime) {
        btnLifetime.style.display = 'none';
      }
    } else {
      if (statusEl) statusEl.textContent = 'Free mode — Upgrade for more features';
      if (btn) {
        btn.disabled = false;
        btn.textContent = '$19.99/Year for Unlimited Use';
      }
      if (btnLifetime) {
        btnLifetime.style.display = 'inline-block';
        btnLifetime.disabled = false;
        btnLifetime.textContent = '$29.99 Lifetime for Unlimited Use Forever';
      }
    }
  },

  // Reset upgrade buttons to default state
  resetUpgradeButtons: function () {
    const yearlyBtn = document.getElementById('upgradeButton');
    const lifetimeBtn = document.getElementById('upgradeButtonLifetime');

    if (yearlyBtn) {
      yearlyBtn.disabled = false;
      yearlyBtn.textContent = '$19.99/Year for Unlimited Use';
    }
    if (lifetimeBtn) {
      lifetimeBtn.disabled = false;
      lifetimeBtn.textContent = '$29.99 Lifetime for Unlimited Use Forever';
    }
  },

  // Handle the upgrade button click
  handleUpgradeFlow: async function (isLifetime = false) {
    const self = this;
    const btn = isLifetime
      ? document.getElementById('upgradeButtonLifetime')
      : document.getElementById('upgradeButton');
    const otherBtn = isLifetime
      ? document.getElementById('upgradeButton')
      : document.getElementById('upgradeButtonLifetime');
    const statusEl = document.getElementById('statusText');

    if (btn) {
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner" style="width: 16px; height: 16px; border-width: 2px; margin-right: 8px;"></span>Loading...';
    }
    if (otherBtn) {
      otherBtn.disabled = true;
    }

    try {
      const priceId = isLifetime ? self.PRICE_ID_LIFETIME : self.PRICE_ID_YEARLY;
      const productId = isLifetime ? self.PRODUCT_ID_LIFETIME : self.PRODUCT_ID_YEARLY;
      console.log(
        'Creating checkout with price:',
        priceId,
        'product:',
        productId,
        'isLifetime:',
        isLifetime
      );

      // Create checkout session without pre-filling email (user enters on Stripe page)
      const session = await self.createCheckoutSession(null, isLifetime);
      console.log('Session response:', session);
      if (session && session.url && session.id) {
        console.log('Session URL:', session.url);
        console.log('Session ID:', session.id);

        // Open Stripe checkout in a new tab
        window.open(session.url, '_blank');
        if (statusEl) statusEl.textContent = 'Checkout opened. Waiting for payment...';

        // Start background polling (works while service worker is active)
        chrome.runtime.sendMessage({
          action: 'startLicensePolling',
          sessionId: session.id,
          productId: productId,
        });

        // Also poll from popup (in case popup stays open)
        self.pollForSessionCompletion(
          session.id,
          productId,
          async data => {
            if (!data) {
              if (statusEl)
                statusEl.textContent =
                  "Payment not detected (timeout). Use 'Check Premium Status' if you completed payment.";
              self.resetUpgradeButtons();
              return;
            }
            // License active — store and update UI
            const email = data.email || (data.record && data.record.email);
            await self.storageSet({ isPremium: true, licenseEmail: email, licenseData: data });
            if (statusEl) statusEl.textContent = '✅ Subscription active. Premium unlocked!';
            if (btn) {
              btn.disabled = true;
              btn.textContent = 'Premium Activated';
            }
            if (otherBtn) {
              otherBtn.style.display = 'none';
            }
            if (typeof window.onLicenseActivated === 'function') {
              try {
                window.onLicenseActivated(data);
              } catch (e) {
                console.warn(e);
              }
            }
          },
          300000,
          5000
        ); // 5 minute timeout, poll every 5 seconds
      } else {
        const msg =
          session && session.error
            ? JSON.stringify(session.error)
            : 'Failed to create checkout session';
        console.error('Checkout failed:', session);
        customAlert('Error: ' + msg);
        if (statusEl) statusEl.textContent = 'Failed to start checkout.';
        self.resetUpgradeButtons();
      }
    } catch (err) {
      console.error('handleUpgradeFlow error:', err);
      customAlert('Network error. Please try again later.');
      self.resetUpgradeButtons();
    }
  },

  // Poll for checkout session completion using session_id
  pollForSessionCompletion: function (
    sessionId,
    productId,
    onComplete,
    timeoutMs = 300000,
    intervalMs = 5000
  ) {
    const self = this;
    const start = Date.now();
    let stopped = false;

    // Use provided productId or default to yearly
    const resolvedProductId = productId || self.PRODUCT_ID_YEARLY;

    async function tick() {
      if (stopped) return;
      const elapsed = Date.now() - start;
      if (elapsed > timeoutMs) {
        onComplete(null);
        return;
      }
      try {
        const resp = await fetch(`${self.API_BASE}/redeem-session`, {
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
    }
    tick();
    return () => {
      stopped = true;
    };
  },

  // Initialize - attach event listeners
  init: function () {
    const self = this;

    // Update UI from storage (this updates the statusText)
    this.updateLicenseUI();

    // Attach the yearly upgrade handler
    const upgradeBtn = document.getElementById('upgradeButton');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', function () {
        self.handleUpgradeFlow(false);
      });
    }

    // Attach the lifetime upgrade handler
    const upgradeBtnLifetime = document.getElementById('upgradeButtonLifetime');
    if (upgradeBtnLifetime) {
      upgradeBtnLifetime.addEventListener('click', function () {
        self.handleUpgradeFlow(true);
      });
    }
  },

  // Verify stored license in background (used on startup)
  verifyStoredLicenseInBackground: async function (analyzer) {
    try {
      const data = await this.storageGet(['licenseEmail', 'isPremium', 'lastLicenseCheck']);

      // Only auto-verify if we have a stored email
      if (data.licenseEmail) {
        const now = Date.now();
        const lastCheck = data.lastLicenseCheck || 0;
        const hoursSinceLastCheck = (now - lastCheck) / (1000 * 60 * 60);

        // Always respect 24-hour cache
        if (hoursSinceLastCheck < 24) {
          console.log('License checked recently, skipping verification');
          return;
        }

        console.log('Verifying license with Stripe in background (24+ hours since last check)');
        const result = await this.checkLicense(data.licenseEmail);

        if (result && result.valid) {
          // License valid - update storage and UI if status changed
          const wasFreeBefore = !analyzer.isPremium;

          await this.storageSet({
            isPremium: true,
            licenseData: result,
            lastLicenseCheck: now,
          });

          // If we just upgraded from free to premium, reload UI
          if (wasFreeBefore) {
            console.log('Premium status activated! Reloading UI...');
            analyzer.isPremium = true;
            analyzer.updateUI();
          }

          console.log('Background verification complete');
        } else {
          // License no longer valid - update for next time
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

  // Check premium status manually (via button)
  checkPremiumStatus: async function (analyzer) {
    const email = await customPrompt('Enter your subscription email to check premium status:');
    if (!email) return;

    const trimmedEmail = email.trim().toLowerCase();

    // Show status message above the button
    const statusMsg = document.getElementById('premiumStatusMessage');
    if (statusMsg) {
      statusMsg.innerHTML =
        '<span class="spinner" style="width: 16px; height: 16px; border-width: 2px; margin-right: 8px; display: inline-block; vertical-align: middle;"></span>Checking premium status...';
      statusMsg.style.display = 'block';
      statusMsg.style.background = '#bee3f8';
      statusMsg.style.color = '#2c5282';
    }

    try {
      console.log('Checking premium status for email:', trimmedEmail);
      const data = await this.checkLicense(trimmedEmail);
      console.log('License check response:', data);

      if (data && data.valid && data.record) {
        const record = data.record;
        const expiresAt = record.expires_at;

        // Handle lifetime licenses (no expiration)
        if (expiresAt) {
          const expiryDate = new Date(expiresAt * 1000);
          const now = new Date();
          const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

          // Update storage with premium status
          await this.storageSet({
            isPremium: true,
            licenseEmail: trimmedEmail,
            licenseData: data,
          });

          // Reload user data and update UI
          await analyzer.loadUserData();
          analyzer.updateUI();

          let message = `✅ Premium Status: Active\n\n`;
          message += `📧 Email: ${trimmedEmail}\n`;
          message += `📅 Expires: ${expiryDate.toLocaleDateString()}\n`;
          message += `⏰ Days Remaining: ${daysRemaining} days\n\n`;
          message += `Your premium status has been activated in the extension!`;

          customAlert(message);
          if (statusMsg) statusMsg.style.display = 'none';
        } else {
          // Lifetime license (no expiration date)
          await this.storageSet({
            isPremium: true,
            licenseEmail: trimmedEmail,
            licenseData: data,
          });

          await analyzer.loadUserData();
          analyzer.updateUI();

          let message = `✅ Premium Status: Active (Lifetime)\n\n`;
          message += `📧 Email: ${trimmedEmail}\n`;
          message += `🎉 Lifetime License - Never Expires\n\n`;
          message += `Your premium status has been activated in the extension!`;

          customAlert(message);
          if (statusMsg) statusMsg.style.display = 'none';
        }
      } else {
        // Provide more detailed error message
        let errorMsg = 'Premium Status: Not Active\n\n';
        if (data && data.error) {
          errorMsg += `Error: ${data.error}\n\n`;
        }
        errorMsg += `No active subscription found for this email.\n\n`;
        errorMsg += `The system checked both yearly subscriptions and lifetime licenses.\n\n`;
        errorMsg += `If you recently purchased, please wait a few minutes and try again.\n\n`;
        errorMsg += `If you believe this is an error, please contact support at: webbyinsights@gmail.com`;

        console.warn('Premium status check failed:', data);
        customAlert(errorMsg);
        if (statusMsg) {
          statusMsg.textContent = 'No active subscription found.';
          statusMsg.style.background = '#fed7d7';
          statusMsg.style.color = '#9b2c2c';
        }
      }
    } catch (error) {
      console.error('Error checking premium status:', error);
      const statusMsg = document.getElementById('premiumStatusMessage');
      if (statusMsg) {
        statusMsg.textContent = `Error: ${error.message || 'Network error'}. Please try again.`;
        statusMsg.style.background = '#fed7d7';
        statusMsg.style.color = '#9b2c2c';
      }
      customAlert(
        `Error checking premium status:\n\n${error.message || 'Network error. Please check your connection and try again.'}`
      );
    }
  },
};

// Make globally available
window.LicenseManager = LicenseManager;

// Also expose checkLicense globally for backward compatibility
window.checkLicense = function (email) {
  return LicenseManager.checkLicense(email);
};
