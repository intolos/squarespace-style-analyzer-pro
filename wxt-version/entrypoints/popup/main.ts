import { LicenseManager } from '../../src/managers/licenseManager';
import { StorageManager } from '../../src/utils/storage';
import { ResultsManager } from '../../src/managers/resultsManager';
import { ExportManager } from '../../src/export/index';
import { DomainAnalysisUI, AnalyzerController } from '../../src/ui/domainAnalysisUI';
import { SinglePageAnalysisUI } from '../../src/ui/singlePageAnalysisUI';
import { UIHelpers, customAlert, customPrompt } from '../../src/utils/uiHelpers';
import { platformStrings, isSqs } from '../../src/utils/platform';
import { UserData } from '../../src/utils/storage';

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

  // File naming constant
  FILENAME_BRAND: string = platformStrings.filenameVariable;

  // AnalyzerController additional props
  groupedUrls?: any;
  totalPagesForAnalysis?: number;

  constructor() {
    this.init();
  }

  async init() {
    // Basic setup
    this.updatePlatformBranding();
    await this.loadUserData();
    await this.loadAccumulatedResults();
    this.updateUI();
    this.repositionMobileSectionForUser();
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
    });
  }

  updateUI() {
    const upgradeNoticeEl = document.getElementById('upgradeNotice');
    const statusSection = document.getElementById('statusSection');
    const upgradeBtn = document.getElementById('upgradeButton') as HTMLButtonElement;
    const premiumButtonsGroup = document.getElementById('premiumButtonsGroup');
    const mainInterface = document.getElementById('mainInterface');
    const multiPageInfo = document.querySelector('.multi-page-info');
    const actionButtonsContainer = document.getElementById('actionButtonsContainer');
    const statusText = document.getElementById('statusText');
    const domainProgress = document.getElementById('domainProgress');
    const errorDiv = document.getElementById('error');
    const successDiv = document.getElementById('success');
    const loadingDiv = document.getElementById('loading');
    const resultsSection = document.getElementById('resultsSection');
    const pagesAnalyzedInfo = document.getElementById('pagesAnalyzedInfo');

    const loader = document.getElementById('initialLoader');
    if (loader) loader.style.display = 'none';
    if (mainInterface) mainInterface.style.display = 'block';

    if (this.isPremium) {
      document.body.classList.add('premium-active');
      if (statusSection) statusSection.remove(); // Remove from DOM completely so it cannot be shown

      if (upgradeNoticeEl) upgradeNoticeEl.style.display = 'none';
      if (statusText) statusText.style.display = 'none';

      // Do NOT modify upgrade buttons text/style - keep them as is (per user request)
      // Just ensure container has correct positioning class if needed
      if (premiumButtonsGroup) premiumButtonsGroup.classList.add('premium-position');

      // Update the "Check Status" button to reflect active state and type
      const checkStatusBtn = document.getElementById('checkStatusButton');
      if (checkStatusBtn) {
        let statusText = '✅ Premium Activated';

        // Determine license type from stored data
        if (this.licenseData && this.licenseData.record) {
          if (this.licenseData.record.expires_at) {
            statusText += ' - Yearly';
          } else {
            statusText += ' - Lifetime';
          }
        } else {
          // Fallback if data missing but isPremium is true (shouldn't happen often)
          // Do nothing, just keep "Premium Activated"
        }

        checkStatusBtn.textContent = statusText;

        // Match color to subscription type
        if (this.licenseData && this.licenseData.record && !this.licenseData.record.expires_at) {
          checkStatusBtn.style.background = '#44337a'; // Deep Purple for Lifetime
        } else {
          checkStatusBtn.style.background = '#14532d'; // Deep Emerald for Yearly/Active
        }

        checkStatusBtn.setAttribute('disabled', 'true');
      }
    } else {
      // Explicitly show status section only for non-premium users
      if (statusSection) statusSection.style.display = 'block';
      if (statusText) statusText.style.display = 'block';

      const usageCountEl = document.getElementById('usageCount');
      const usageProgressEl = document.getElementById('usageProgress');
      if (usageCountEl) usageCountEl.textContent = this.usageCount.toString();
      if (usageProgressEl) usageProgressEl.style.width = (this.usageCount / 3) * 100 + '%';

      if (this.usageCount >= 3) {
        if (upgradeNoticeEl) upgradeNoticeEl.style.display = 'block';
        const analyzeBtn = document.getElementById('analyzeBtn') as HTMLButtonElement;
        if (analyzeBtn) {
          analyzeBtn.disabled = true;
          analyzeBtn.textContent = '🔒 Upgrade Required';
        }
      }
    }

    if (this.accumulatedResults) {
      this.displayResults();
    }
  }

  updatePlatformBranding() {
    const set = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    const setHtml = (id: string, html: string) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    };
    const setAttr = (id: string, attr: string, value: string) => {
      const el = document.getElementById(id) as any;
      if (el) el[attr] = value;
    };

    set('uiAuditTitle', platformStrings.auditTitle);
    set('uiNotSqsTitle', platformStrings.notSqsTitle);
    set('uiNotSqsDescription', platformStrings.notSqsDescription);
    setAttr('uiBenefitsLink', 'href', platformStrings.benefitsUrl);
    set('uiUseCaseTitle', platformStrings.useCaseTitle);
    set('uiDevPlatform', platformStrings.developerPlatform);
    set('uiDetectionTitle', platformStrings.detectionTitle);
    set('uiSiteType', platformStrings.siteType);
    setAttr('uiShareLink', 'href', platformStrings.shareUrl);
    set('uiToolsBrand', platformStrings.toolsBrand);
    set('uiDevBioTitle', platformStrings.developerBioTitle);
    set('uiDevBioBody', platformStrings.developerBioBody);

    if (!platformStrings.showQuickDetection) {
      const detectionTitleInfo = document.getElementById('uiDetectionTitle');
      if (detectionTitleInfo) {
        const parent = detectionTitleInfo.closest('.use-case-item');
        if (parent) {
          (parent as HTMLElement).style.display = 'none';
        }
      }
    }
  }

  repositionMobileSectionForUser() {
    // Redundant now that order is static
  }

  resetUpgradeButtons() {
    const yearlyBtn = document.getElementById('upgradeButton') as HTMLButtonElement;
    const lifetimeBtn = document.getElementById('upgradeButtonLifetime') as HTMLButtonElement;

    if (yearlyBtn) {
      yearlyBtn.disabled = false;
      yearlyBtn.textContent = '$19.99/Year for Unlimited Use';
      yearlyBtn.innerHTML = '$19.99/Year for Unlimited Use'; // Clear spinner
    }
    if (lifetimeBtn) {
      lifetimeBtn.style.display = 'inline-block';
      lifetimeBtn.disabled = false;
      lifetimeBtn.textContent = '$29.99 Lifetime for Unlimited Use Forever';
      lifetimeBtn.innerHTML = '$29.99 Lifetime for Unlimited Use Forever'; // Clear spinner
    }
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
              this.resetUpgradeButtons();
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
            this.updateUI();

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
        this.resetUpgradeButtons();
      }
    } catch (err: any) {
      console.error('handleUpgradeFlow error:', err);
      customAlert('Network error. Please try again later.');
      this.resetUpgradeButtons();
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

    // Test buttons
    (window as any).enableYearlyTest = async () => {
      console.log('Enabling Yearly Premium Test Mode...');
      this.isPremium = true;
      this.licenseData = {
        valid: true,
        record: { expires_at: Math.floor(Date.now() / 1000) + 31536000 },
      };
      await this.saveUserData();
      this.updateUI();
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
      this.updateUI();
      console.log('✅ Lifetime Test Mode Active');
    };

    (window as any).disablePremiumTest = async () => {
      console.log('Disabling Premium Test Mode...');
      this.isPremium = false;
      this.licenseData = null;
      await this.saveUserData();
      this.updateUI();
      console.log('✅ Test Mode Disabled');
    };
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
    await SinglePageAnalysisUI.analyzeSite(this);
  }

  async analyzeDomain() {
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

      const isSquarespace = await this.checkIfSquarespace(tab.id!);
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
      }
    } catch (e) {
      console.error(e);
    }
  }

  async checkIfSquarespace(tabId: number): Promise<boolean> {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const indicators = [
            document.querySelector('meta[name="generator"][content*="Squarespace"]'),
            document.querySelector('script[src*="squarespace"]'),
            document.querySelector('link[href*="squarespace"]'),
            document.querySelector('[data-squarespace-module]'),
            document.body &&
              document.body.classList &&
              document.body.classList.contains('squarespace'),
            document.querySelector('.sqs-block'),
            document.querySelector('[class*="sqs-"]'),
          ];
          return indicators.some(i => !!i);
        },
      });
      return (results[0] && results[0].result) || false;
    } catch (e) {
      return false;
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
        'domainAnalysisUseMobileViewport',
      ]);
      const analyzeBtn = document.getElementById('analyzeBtn');
      const analyzeDomainBtn = document.getElementById('analyzeDomainBtn');
      const siteInfo = document.getElementById('siteInfo');
      if (analyzeBtn) analyzeBtn.style.display = 'block';
      if (analyzeDomainBtn) analyzeDomainBtn.style.display = 'block';
      // IMPORTANT: resetAnalysis is the ONLY place where siteInfo visibility is restored
      // after it has been hidden by starting an analysis or loading results.
      if (siteInfo) siteInfo.style.display = 'block';
    }
  }

  // --- Exports & Helpers ---

  displayResults() {
    ResultsManager.displayResults(this.accumulatedResults);
  }

  exportCSV() {
    ExportManager.exportCSV(this);
  }
  exportHTMLReport() {
    ExportManager.exportHTMLReport(this);
  }
  exportImagesReport() {
    ExportManager.exportImagesReport(this);
  }
  exportStyleGuide() {
    ExportManager.exportStyleGuide(this);
  }
  exportMobileReport() {
    ExportManager.exportMobileReport(this);
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
      const result = await LicenseManager.checkLicense(trimmedEmail);

      if (result && result.valid) {
        // Success - Save data
        await StorageManager.saveUserData({
          ...data,
          isPremium: true,
          licenseEmail: trimmedEmail,
          licenseData: result,
        });

        // Update local state
        this.isPremium = true;
        this.licenseData = result;

        // IMPORTANT: Update UI immediately to hide free-tier counters
        this.updateUI();

        // Determine text
        let statusText = '✅ Premium Activated';
        if (result.record) {
          if (result.record.expires_at) {
            statusText += ' - Yearly';
          } else {
            statusText += ' - Lifetime';
          }
        }

        btn.textContent = statusText;

        // Apply specific color based on license type
        if (result.record && !result.record.expires_at) {
          btn.style.background = '#44337a'; // Deep Purple for Lifetime
        } else {
          btn.style.background = '#14532d'; // Deep Emerald for Yearly
        }

        // Show Legacy Success Alert
        let message = `✅ Premium Status: Active\n\n`;
        message += `📧 Email: ${trimmedEmail}\n`;
        if (result.record && result.record.expires_at) {
          const expiryDate = new Date(result.record.expires_at * 1000);
          const now = new Date();
          const daysRemaining = Math.ceil(
            (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          message += `📅 Expires: ${expiryDate.toLocaleDateString()}\n`;
          message += `⏰ Days Remaining: ${daysRemaining} days\n\n`;
        } else {
          message += `🎉 Lifetime License - Never Expires\n\n`;
        }
        message += `Your premium status has been activated in the extension!`;

        await customAlert(message);
      } else {
        // Failure
        btn.textContent = '❌ License Not Found';
        btn.style.background = '#7f1d1d';

        // Show Legacy Failure Alert
        let errorMsg = 'Premium Status: Not Active\n\n';
        if (result && result.error) {
          errorMsg += `Error: ${result.error}\n\n`;
        }
        errorMsg += `No active subscription found for email: ${trimmedEmail}\n\n`;
        errorMsg += `The system checked both yearly subscriptions and lifetime licenses.\n\n`;
        errorMsg += `If you recently purchased, please wait a few minutes and try again.\n\n`;
        errorMsg += `If you believe this is an error, please contact support at: webbyinsights@gmail.com`;

        customAlert(errorMsg);

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
}

// Start
document.addEventListener('DOMContentLoaded', () => {
  new SquarespaceAnalyzer();
});
