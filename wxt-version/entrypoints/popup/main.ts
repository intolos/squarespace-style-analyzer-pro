import { LicenseManager } from '../../src/managers/licenseManager';
import { StorageManager } from '../../src/utils/storage';
import { ResultsManager } from '../../src/managers/resultsManager';
import { ExportManager } from '../../src/export/index';
import { DomainAnalysisUI, AnalyzerController } from '../../src/ui/domainAnalysisUI';
import { SinglePageAnalysisUI } from '../../src/ui/singlePageAnalysisUI';
import { UIHelpers, customAlert, customPrompt, showReviewModal } from '../../src/utils/uiHelpers';
import { platformStrings, isSqs } from '../../src/utils/platform';
import { UserData } from '../../src/utils/storage';
import { detectPlatform, checkIfSquarespace } from '../../src/platforms/index';
import { PopupUIManager } from '../../src/ui/popupUI';

class SquarespaceAnalyzer implements AnalyzerController {
  usageCount: number = 0;
  isPremium: boolean = false;
  userId: string = '';
  analyzedDomains: string[] = [];
  currentResults: any = null;
  accumulatedResults: any = null;
  currentDomain: string = '';
  isNewDomain: boolean = false;
  isDomainAnalyzing: boolean = false;
  licenseData: any = null;
  showDomainConfirmation: boolean = true;
  detectedPlatform: any = null; // Stores platform info for reports
  premiumPageAnalyses: number = 0;
  premiumDomainAnalyses: number = 0;
  premiumModalShown: boolean = false;
  reviewModalDismissed: boolean = false;

  // File naming constant
  FILENAME_BRAND: string = platformStrings.filenameVariable;

  // AnalyzerController additional props
  groupedUrls?: any;
  totalPagesForAnalysis?: number;

  constructor() {
    this.init();
  }

  async checkAndShowReviewModal(type: 'page' | 'domain', force: boolean = false): Promise<void> {
    if (!force && this.reviewModalDismissed) return;

    let shouldShow = force;

    if (!force) {
      if (!this.isPremium) {
        if (this.usageCount === 3) {
          shouldShow = true;
        }
      } else {
        if (type === 'page') {
          this.premiumPageAnalyses++;
        } else if (type === 'domain') {
          this.premiumDomainAnalyses++;
        }

        const domainThreshold = 4;
        const pageThreshold = 10;

        if (
          this.premiumDomainAnalyses >= domainThreshold ||
          this.premiumPageAnalyses >= pageThreshold
        ) {
          shouldShow = true;
        }
        await this.saveUserData();
      }
    }

    if (shouldShow) {
      setTimeout(async () => {
        const result = await showReviewModal();
        if (result.dismissed) {
          this.reviewModalDismissed = true;
        } else if (this.isPremium) {
          // Reset counters to start the next schedule
          this.premiumModalShown = true;
          this.premiumDomainAnalyses = 0;
          this.premiumPageAnalyses = 0;
        }
        await this.saveUserData();
      }, 500);
    }
  }

  async init() {
    // Basic setup
    PopupUIManager.updatePlatformBranding();
    await this.loadUserData();
    await this.loadAccumulatedResults();
    PopupUIManager.updateUI(this, () => this.displayResults());
    PopupUIManager.setPremiumBenefits();
    PopupUIManager.repositionMobileSectionForUser();
    this.bindEvents();
    this.bindDomainAnalysisEvents();
    await this.checkCurrentSite();

    // IMPORTANT: Clear stale error states from previous sessions before checking ongoing analyses
    // This prevents spurious "Analysis failed" error messages on popup open
    await chrome.storage.local.remove(['singlePageAnalysisError']);

    await this.checkOngoingDomainAnalysis();
    await this.checkOngoingSinglePageAnalysis();

    // Check license in background (non-blocking)
    LicenseManager.verifyStoredLicenseInBackground();

    // Listen for background updates
    chrome.runtime.onMessage.addListener(message => {
      if (message.action === 'analysisProgress' && message.status) {
        const statusEl = document.getElementById('loadingStatus');
        if (statusEl) {
          statusEl.textContent = message.status;
        }
      }
    });

    // Premium status listener disabled - causes scroll jump on activation
    // chrome.storage.onChanged.addListener((changes, namespace) => {
    //   if (namespace === 'local' && changes.isPremium) {
    //     const wasPremium = changes.isPremium.oldValue;
    //     const nowPremium = changes.isPremium.newValue;
    //     if (!wasPremium && nowPremium) {
    //       console.log('Premium activated! Reloading popup...');
    //       window.location.reload();
    //     }
    //   }
    // });
  }

  async loadUserData() {
    const data = await StorageManager.loadUserData();
    this.usageCount = data.usageCount;
    this.isPremium = data.isPremium;
    this.userId = data.userId;
    this.analyzedDomains = data.analyzedDomains || [];
    this.licenseData = data.licenseData || null;
    this.premiumPageAnalyses = data.premiumPageAnalyses || 0;
    this.premiumDomainAnalyses = data.premiumDomainAnalyses || 0;
    this.premiumModalShown = data.premiumModalShown || false;
    this.reviewModalDismissed = data.reviewModalDismissed || false;

    // Ensure userId exists
    await StorageManager.ensureUserId(this.userId);

    // Fetch session-based confirmation preference from background
    const pref = await chrome.runtime.sendMessage({
      action: 'getPreference',
      key: 'hideDomainConfirmation',
    });
    this.showDomainConfirmation = !pref.value;
  }

  async loadAccumulatedResults() {
    this.accumulatedResults = await ResultsManager.loadAccumulatedResults();
    // Load detected platform if available
    const data = await chrome.storage.local.get(['detectedPlatform']);
    this.detectedPlatform = data.detectedPlatform || null;
  }

  async saveAccumulatedResults() {
    await ResultsManager.saveAccumulatedResults(this.accumulatedResults);
  }

  async saveUserData() {
    // IMPORTANT: licenseEmail and licenseData MUST be included here even if not
    // explicitly modified by every UI action. The StorageManager.saveUserData()
    // call will overwrite the entire record, so omitting these fields will
    // effectively delete the user's premium details. Fixed 2026-01-19.
    await StorageManager.saveUserData({
      usageCount: this.usageCount,
      isPremium: this.isPremium,
      userId: this.userId,
      analyzedDomains: this.analyzedDomains,
      licenseEmail: this.licenseData?.email || this.licenseData?.record?.email,
      licenseData: this.licenseData,
      premiumPageAnalyses: this.premiumPageAnalyses,
      premiumDomainAnalyses: this.premiumDomainAnalyses,
      premiumModalShown: this.premiumModalShown,
      reviewModalDismissed: this.reviewModalDismissed,
    });
  }

  async handleUpgradeFlow(isLifetime = false) {
    const btnId = isLifetime ? 'upgradeButtonLifetime' : 'upgradeButton';
    const otherBtnId = isLifetime ? 'upgradeButton' : 'upgradeButtonLifetime';
    const btn = document.getElementById(btnId) as HTMLButtonElement;
    const otherBtn = document.getElementById(otherBtnId) as HTMLButtonElement;
    const statusEl = document.getElementById('premiumStatusMessage');

    if (btn) {
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner" style="width: 16px; height: 16px; border-width: 2px; margin-right: 8px; display: inline-block; vertical-align: middle;"></span>Loading...';
    }
    if (otherBtn) {
      otherBtn.disabled = true;
    }

    try {
      // Determine IDs from LicenseManager helpers which use platformStrings
      const priceId = isLifetime
        ? LicenseManager.PRICE_ID_LIFETIME
        : LicenseManager.PRICE_ID_YEARLY;
      const productId = isLifetime
        ? LicenseManager.PRODUCT_ID_LIFETIME
        : LicenseManager.PRODUCT_ID_YEARLY;

      console.log('Creating checkout:', { priceId, productId, isLifetime });

      // Create checkout session (user enters email on Stripe)
      const session = await LicenseManager.createCheckoutSession(null, isLifetime);
      console.log('Session response:', session);

      if (session && session.url && session.id) {
        // IMPORTANT: Open the Stripe checkout URL in a new tab. Fixed 2026-01-20.
        window.open(session.url, '_blank');

        // IMPORTANT: Hide siteInfo if we have results.
        // This prevents UI clutter and adheres to the "results first" layout.
        // Verified 2026-01-19.
        // Note: The `siteInfo` element is not directly available in this scope.
        // This comment and logic block seems misplaced based on the original instruction.
        // Assuming the intent was to add a comment about `siteInfo` visibility in relevant functions.
        // However, following the exact placement from the instruction.
        // If `siteInfo` was intended to be hidden here, it would need to be retrieved first.
        // For now, inserting as provided, but noting the potential logical discrepancy.
        // if (siteInfo && this.accumulatedResults) {
        //   siteInfo.style.display = 'none';
        // } else if (siteInfo) {
        //   siteInfo.style.display = 'block';
        // }
        // The above block is commented out as `siteInfo` is not defined here.
        // The instruction's code snippet seems to be a copy-paste error from another context.
        // I will only add the comment as per the instruction's text, not the erroneous code block.
        if (statusEl) {
          statusEl.textContent = 'Checkout opened. Waiting for payment...';
          statusEl.style.background = '#e3f2fd'; // Light blue
          statusEl.style.color = '#0c4a6e';
        }

        // 1. Start background polling (keeps working if popup closes)
        chrome.runtime.sendMessage({
          action: 'startLicensePolling',
          sessionId: session.id,
          productId: productId,
        });

        // 2. Also poll from popup for immediate feedback
        LicenseManager.pollForSessionCompletion(
          session.id,
          productId,
          async data => {
            if (!data) {
              // Timeout
              if (statusEl) {
                statusEl.textContent =
                  "Payment not detected (timeout). Use 'Check Premium Status' if you completed payment.";
                statusEl.style.background = '#fff7ed'; // Light orange
                statusEl.style.color = '#7c2d12';
              }
              PopupUIManager.resetUpgradeButtons();
              return;
            }

            // Success!
            const email = data.email || (data.record && data.record.email);
            // Save to storage
            await this.saveUserData();
            await chrome.storage.local.set({
              isPremium: true,
              licenseEmail: email,
              licenseData: data,
              lastLicenseCheck: Date.now(),
            });

            // Update local state
            this.isPremium = true;
            this.licenseData = data;
            PopupUIManager.updateUI(this, () => this.displayResults());

            // Show success message
            if (statusEl) {
              statusEl.textContent = '✅ Subscription active. Premium unlocked!';
              statusEl.style.background = '#dcfce7'; // Light green
              statusEl.style.color = '#14532d';
            }

            customAlert('Premium actived successfully! Thank you for your purchase.');
          },
          300000, // 5 min timeout
          5000 // 5s interval
        );
      } else {
        // Error creating session
        const msg = session && session.error ? JSON.stringify(session.error) : 'Unknown error';
        console.error('Checkout failed:', session);
        customAlert('Error creating checkout session: ' + msg);
        PopupUIManager.resetUpgradeButtons();
      }
    } catch (err: any) {
      console.error('handleUpgradeFlow error:', err);
      customAlert('Network error. Please try again later.');
      PopupUIManager.resetUpgradeButtons();
    }
  }

  bindEvents() {
    document.getElementById('analyzeBtn')?.addEventListener('click', () => this.analyzeSite());
    document.getElementById('exportCsvBtn')?.addEventListener('click', () => this.exportCSV());
    document
      .getElementById('exportHtmlBtn')
      ?.addEventListener('click', () => this.exportHTMLReport());
    document
      .getElementById('exportStyleGuideBtn')
      ?.addEventListener('click', () => this.exportStyleGuide());
    document
      .getElementById('exportMobileReportBtn')
      ?.addEventListener('click', () => this.exportMobileReport());
    document.getElementById('resetBtn')?.addEventListener('click', () => this.resetAnalysis());
    document
      .getElementById('cancelPageBtn')
      ?.addEventListener('click', () => this.cancelSinglePageAnalysis());

    document
      .getElementById('checkStatusButton')
      ?.addEventListener('click', () => this.checkPremiumStatus());

    document.getElementById('upgradeButton')?.addEventListener('click', () => {
      this.handleUpgradeFlow(false);
    });
    document.getElementById('upgradeButtonLifetime')?.addEventListener('click', () => {
      this.handleUpgradeFlow(true);
    });

    // Test buttons - Only exposed in development builds
    if (import.meta.env.DEV) {
      (window as any).enableYearlyTest = async () => {
        console.log('Enabling Yearly Premium Test Mode...');
        this.isPremium = true;
        this.licenseData = {
          valid: true,
          record: { expires_at: Math.floor(Date.now() / 1000) + 31536000 },
        };
        await this.saveUserData();
        PopupUIManager.updateUI(this, () => this.displayResults());
        console.log('✅ Yearly Test Mode Active');
      };

      (window as any).enableLifetimeTest = async () => {
        console.log('Enabling Lifetime Premium Test Mode...');
        this.isPremium = true;
        this.licenseData = {
          valid: true,
          record: { expires_at: null },
        };
        await this.saveUserData();
        PopupUIManager.updateUI(this, () => this.displayResults());
        console.log('✅ Lifetime Test Mode Active');
      };

      (window as any).disablePremiumTest = async () => {
        console.log('Disabling Premium Test Mode...');
        this.isPremium = false;
        this.licenseData = null;
        await this.saveUserData();
        PopupUIManager.updateUI(this, () => this.displayResults());
        console.log('✅ Test Mode Disabled');
      };
    }
  }

  bindDomainAnalysisEvents() {
    document
      .getElementById('analyzeDomainBtn')
      ?.addEventListener('click', () => this.analyzeDomain());
    document
      .getElementById('startWithoutMobileBtn')
      ?.addEventListener('click', () => this.startDomainAnalysisWithMobileChoice(false, false));
    document
      .getElementById('startWithMobileBtn')
      ?.addEventListener('click', () => this.startDomainAnalysisWithMobileChoice(true, false));
    document
      .getElementById('startOnlyMobileBtn')
      ?.addEventListener('click', () => this.startDomainAnalysisWithMobileChoice(true, true));
    document
      .getElementById('cancelDomainBtn')
      ?.addEventListener('click', () => this.cancelDomainAnalysis());
  }

  // --- Actions ---

  async analyzeSite() {
    // Show platform banner in post-analysis position immediately
    if (!isSqs && this.detectedPlatform && this.detectedPlatform.message) {
      PopupUIManager.showPlatformBanner(this.detectedPlatform.message, true);
    }
    await SinglePageAnalysisUI.analyzeSite(this);
  }

  async analyzeDomain() {
    // Show platform banner in post-analysis position immediately
    if (!isSqs && this.detectedPlatform && this.detectedPlatform.message) {
      PopupUIManager.showPlatformBanner(this.detectedPlatform.message, true);
    }
    await DomainAnalysisUI.analyzeDomain(this);
  }

  async checkOngoingDomainAnalysis() {
    await DomainAnalysisUI.checkOngoingDomainAnalysis(this);
  }

  async checkOngoingSinglePageAnalysis() {
    await SinglePageAnalysisUI.checkOngoingAnalysis(this);
  }

  async cancelDomainAnalysis() {
    await DomainAnalysisUI.cancelDomainAnalysis(this);
  }

  async cancelSinglePageAnalysis() {
    await SinglePageAnalysisUI.cancelAnalysis(this);
  }

  async startDomainAnalysisWithMobileChoice(useMobile: boolean, mobileOnly: boolean) {
    DomainAnalysisUI.startDomainAnalysisWithMobileChoice(this, useMobile, mobileOnly);
  }

  async checkCurrentSite() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab.url) return;

      // Skip script injection for restricted URLs (browser internal pages)
      const restrictedSchemes = [
        'chrome:',
        'about:',
        'edge:',
        'chrome-extension:',
        'moz-extension:',
      ];
      const isRestricted = restrictedSchemes.some(scheme => tab.url?.startsWith(scheme));

      if (isRestricted) {
        console.log('Restricted URL detected, skipping platform detection');
        const currentUrlEl = document.getElementById('currentUrl');
        if (currentUrlEl) currentUrlEl.textContent = new URL(tab.url).hostname || tab.url;
        return;
      }

      const isSquarespace = await checkIfSquarespace(tab.id!);
      const hostname = new URL(tab.url).hostname;
      const currentUrlEl = document.getElementById('currentUrl');
      if (currentUrlEl) currentUrlEl.textContent = hostname;

      if (!isSquarespace && isSqs) {
        const notSqs = document.getElementById('notSquarespace');
        const siteInfo = document.getElementById('siteInfo');
        if (notSqs) notSqs.style.display = 'block';
        if (siteInfo && notSqs && notSqs.parentNode) {
          // IMPORTANT: Only show siteInfo if no results are currently displayed.
          // This keeps the UI clean during and after analysis. Fixed 2026-01-19.
          siteInfo.style.display = this.accumulatedResults ? 'none' : 'block';
          siteInfo.style.marginTop = '10px';
          notSqs.parentNode.insertBefore(siteInfo, notSqs.nextSibling);
        }
      } else {
        const siteInfo = document.getElementById('siteInfo');
        if (siteInfo) {
          // IMPORTANT: Only show siteInfo if no results are currently displayed.
          siteInfo.style.display = this.accumulatedResults ? 'none' : 'block';
        }

        // IMPORTANT: Handle Platform Detection Banner
        // Check if we already have results (Post-Analysis state)
        if (this.accumulatedResults) {
          // If we have stored platform info, show it in the post-analysis position
          if (this.detectedPlatform && this.detectedPlatform.message) {
            PopupUIManager.showPlatformBanner(this.detectedPlatform.message, true); // Show Post-Analysis Banner
          }
        } else {
          // No results yet (Pre-Analysis state)
          // Run detection if needed and show Pre-Analysis banner
          if (tab.id) {
            await this.detectPlatformForBanner(tab.id);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Sets the Premium Benefits list based on the extension version (SQS vs Generic).
   * Reorders items and adds version-specific bullets as requested by the user.
   */

  /**
   * IMPORTANT: Detects the website platform and shows a banner in the generic version.
   * This runs the detectPlatform function in the page context and updates the banner UI.
   * Only runs for the generic version (!isSqs).
   */
  async detectPlatformForBanner(tabId: number): Promise<void> {
    // Only show platform banner in generic version
    if (isSqs) return;

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: detectPlatform,
      });

      const platformInfo = results[0]?.result;
      if (platformInfo && platformInfo.message) {
        this.detectedPlatform = platformInfo; // Save for reports
        // Persist to storage
        chrome.storage.local.set({ detectedPlatform: platformInfo });
        PopupUIManager.showPlatformBanner(platformInfo.message, false /* not post-analysis */);
      }
    } catch (e) {
      console.error('Platform detection failed:', e);
    }
  }

  async resetAnalysis() {
    const wasReset = await ResultsManager.resetAnalysis(
      this.showSuccess.bind(this),
      this.hideMessages.bind(this)
    );
    if (wasReset) {
      this.accumulatedResults = null;
      this.currentResults = null;
      await chrome.storage.local.remove([
        'domainAnalysisComplete',
        'domainAnalysisResults',
        'domainAnalysisError',
        'domainAnalysisProgress',
        'singlePageAnalysisStatus',
        'singlePageProgressText',
        'singlePageAnalysisResults',
        'singlePageAnalysisError',
        'domainAnalysisMobileOnly',
        'singlePageAnalysisError',
        'domainAnalysisMobileOnly',
        'domainAnalysisUseMobileViewport',
        'detectedPlatform', // Clear platform info on reset
      ]);
      this.detectedPlatform = null;
      const analyzeBtn = document.getElementById('analyzeBtn');
      const analyzeDomainBtn = document.getElementById('analyzeDomainBtn');
      const siteInfo = document.getElementById('siteInfo');
      if (analyzeBtn) analyzeBtn.style.display = 'block';
      if (analyzeDomainBtn) analyzeDomainBtn.style.display = 'block';
      // IMPORTANT: resetAnalysis is the ONLY place where siteInfo visibility is restored
      // after it has been hidden by starting an analysis or loading results.
      if (siteInfo) siteInfo.style.display = 'block';

      // Hide platform banners and re-detect platform (for generic version)
      PopupUIManager.hidePlatformBanners();
      await this.checkCurrentSite();
    }
  }

  // --- Exports & Helpers ---

  displayResults() {
    ResultsManager.displayResults(this.accumulatedResults);
  }

  async exportCSV() {
    await ExportManager.exportCSV(this);
  }
  async exportHTMLReport() {
    await ExportManager.exportHTMLReport(this);
  }
  async exportImagesReport() {
    await ExportManager.exportImagesReport(this);
  }
  async exportStyleGuide() {
    await ExportManager.exportStyleGuide(this);
  }
  async exportMobileReport() {
    await ExportManager.exportMobileReport(this);
  }

  async checkPremiumStatus() {
    const btn = document.getElementById('checkStatusButton');
    if (!btn) return;

    const originalText = btn.textContent;
    btn.textContent = 'Checking license status...';
    btn.setAttribute('disabled', 'true');

    try {
      const data = await StorageManager.loadUserData();
      // ALWAYS prompt for email (no pre-fill as per user request)
      const input = await customPrompt('Enter your subscription email to check premium status:');

      if (input === null || input.trim() === '') {
        btn.textContent = originalText;
        btn.removeAttribute('disabled');
        return;
      }

      const trimmedEmail = input.trim().toLowerCase();

      // LOG: Show exactly what we are checking to verify strict matching
      console.log(
        `Checking Premium Status for ${trimmedEmail} (Product: ${isSqs ? 'SQS' : 'Generic'})`
      );

      const result = await LicenseManager.checkLicense(trimmedEmail);

      // DEBUG: Log full result for troubleshooting missing dates
      console.log('Premium Status Result:', result);

      // CRITICAL FIX: Ensure Yearly subscriptions have an expiration date
      // If checking a Yearly sub, it MUST have an expiration date to be considered valid.
      // Lifetime subs do not need expiration date.
      let isValid = result && result.valid;
      if (isValid && result.record && result.record.is_yearly && !result.record.expires_at) {
        // Found yearly record but usage is invalid due to missing date
        console.warn('Yearly subscription found WITHOUT expires_at:', result.record);
        isValid = false;
        // Inject specific error for UI handling below
        if (!result.error) result.error = 'Missing expiration date for yearly subscription.';
      }

      if (isValid) {
        // Success - Save data
        await StorageManager.saveUserData({
          ...data,
          isPremium: true,
          licenseEmail: trimmedEmail,
        });

        // IMPORTANT: Clear the expiration notification flag so they can be notified again
        // if their subscription expires in the future. Fixed 2026-01-23.
        await chrome.storage.local.remove(['licenseExpiredNotificationShown']);

        // Update local state
        this.isPremium = true;
        this.licenseData = result;

        // IMPORTANT: Update UI immediately to hide free-tier counters
        PopupUIManager.updateUI(this, () => this.displayResults());

        // Determine text
        let statusText = '✅ Premium Activated';
        if (result.record) {
          const isLifetime = result.record.is_lifetime === true;
          const isYearly = result.record.is_yearly === true;

          if (isLifetime) {
            statusText += ' - Lifetime';
          } else if (isYearly) {
            statusText += ' - Yearly';
          }
        }

        btn.textContent = statusText;

        // Apply specific color based on license type
        const isLifetime = result.record && result.record.is_lifetime === true;

        if (isLifetime) {
          btn.style.background = '#44337a'; // Deep Purple for Lifetime
        } else {
          btn.style.background = '#14532d'; // Deep Emerald for Yearly/Active
        }

        // Show Legacy Success Alert
        let message = `✅ Premium Status: Active\n\n`;
        message += `📧 Email: ${trimmedEmail}\n\n`;

        const isRecordLifetime = result.record && result.record.is_lifetime === true;
        const isRecordYearly = result.record && result.record.is_yearly === true;

        if (result.record && result.record.expires_at) {
          const expiryDate = new Date(result.record.expires_at * 1000);
          const now = new Date();
          const daysRemaining = Math.ceil(
            (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          message += `📅 Expires: ${expiryDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
          message += `⏰ Days Remaining: ${daysRemaining} days\n\n`;
        } else if (isRecordLifetime) {
          message += `🎉 Lifetime License - Never Expires\n\n`;
        } else {
          // Should not happen given initial validation, but safe fallback
          message += `Note: License details unavailable.\n\n`;
        }

        message += `Your premium status has been activated in the extension!`;

        await customAlert(message);
      } else {
        // Failure
        btn.textContent = '❌ License Not Found';
        btn.style.background = '#7f1d1d';

        // Show Legacy Failure Alert
        let errorMsg = 'Premium Status: Not Active\n\n';

        // Custom error for strict date check
        if (result && result.record && result.record.is_yearly && !result.record.expires_at) {
          errorMsg += `⚠️ No expiration date found.\n`;
          errorMsg += `Please contact support at: ${platformStrings.questionsEmail}`;
        } else {
          if (result && result.error) {
            errorMsg += `Error: ${result.error}\n\n`;
          }
          errorMsg += `No active subscription found for email: ${trimmedEmail}\n\n`;
          errorMsg += `The system checked both yearly subscriptions and lifetime licenses.\n\n`;
          errorMsg += `If you recently purchased, please wait a few minutes and try again.\n\n`;
          errorMsg += `If you believe this is an error, please contact support at: ${platformStrings.questionsEmail}`;
        }

        const overlay = document.getElementById('customModalOverlay');
        if (overlay) overlay.classList.add('license-failure-modal');

        await customAlert(errorMsg);

        if (overlay) overlay.classList.remove('license-failure-modal');

        // Reset button after delay
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = ''; // Revert to CSS class style
          btn.removeAttribute('disabled');
        }, 3000);
      }
    } catch (e: any) {
      console.error('License check failed:', e);
      btn.textContent = 'Error Checking';
      btn.removeAttribute('disabled');
      customAlert(
        `Error checking premium status:\n\n${e.message || 'Network error. Please check your connection and try again.'}`
      );
    }
  }

  trackUsage(event: string) {
    chrome.runtime.sendMessage({
      action: 'trackUsage',
      event: event,
      userId: this.userId,
      timestamp: Date.now(),
    });
  }

  showLoading(show: boolean) {
    UIHelpers.showLoading(show);
  }
  showError(msg: string) {
    UIHelpers.showError(msg);
  }
  showSuccess(msg: string) {
    UIHelpers.showSuccess(msg);
  }
  hideMessages() {
    UIHelpers.hideMessages();
  }

  async setHideDomainConfirmation(hide: boolean) {
    this.showDomainConfirmation = !hide;
    await chrome.runtime.sendMessage({
      action: 'setPreference',
      key: 'hideDomainConfirmation',
      value: hide,
    });
  }
  async reportUnknownId(email: string, productId: string) {
    const key = `reported_unknown_${productId}`;
    const data = await chrome.storage.local.get(key);
    const lastReported = typeof data[key] === 'number' ? data[key] : 0;
    const now = Date.now();

    // Debounce: Report only once every 24 hours
    if (!lastReported || now - lastReported > 24 * 60 * 60 * 1000) {
      console.warn(`Reporting unknown Product ID: ${productId}`);
      LicenseManager.reportIssue('UNKNOWN_PRODUCT_ID', { email, productId });
      await chrome.storage.local.set({ [key]: now });
    }
  }
}

// Start
document.addEventListener('DOMContentLoaded', () => {
  new SquarespaceAnalyzer();
});
