class SquarespaceAnalyzer {
  constructor() {
    this.usageCount = 0;
    this.isPremium = false;
    this.currentResults = null;
    this.accumulatedResults = null;
    this.domainAnalyzer = null;
    this.isDomainAnalyzing = false;
    // File naming constant - change this to customize all export filenames
    this.FILENAME_BRAND = 'squarespace';
    this.init();
  }

  async init() {
    await this.loadUserData();
    await this.loadAccumulatedResults();
    this.updateUI();
    this.repositionMobileSectionForUser();
    this.bindEvents();
    this.bindDomainAnalysisEvents();
    await this.checkCurrentSite();
    await this.checkOngoingDomainAnalysis();

    // Check license in background AFTER showing UI (non-blocking)
    this.verifyStoredLicenseInBackground();
  }

  async verifyStoredLicenseInBackground() {
    try {
      const data = await chrome.storage.local.get([
        'licenseEmail',
        'isPremium',
        'lastLicenseCheck',
      ]);

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
        const result = await checkLicense(data.licenseEmail);

        if (result && result.valid) {
          // License valid - update storage and UI if status changed
          const wasFreeBefore = !this.isPremium;

          await chrome.storage.local.set({
            isPremium: true,
            licenseData: result,
            lastLicenseCheck: now,
          });

          // If we just upgraded from free to premium, reload UI
          if (wasFreeBefore) {
            console.log('Premium status activated! Reloading UI...');
            this.isPremium = true;
            this.updateUI();
          }

          console.log('Background verification complete');
        } else {
          // License no longer valid - update for next time
          await chrome.storage.local.set({
            isPremium: false,
            lastLicenseCheck: now,
          });
          console.log('License expired or not found');
        }
      }
    } catch (error) {
      console.error('Background license verification failed:', error);
    }
  }

  async loadUserData() {
    const data = await StorageManager.loadUserData();
    this.usageCount = data.usageCount;
    this.isPremium = data.isPremium;
    this.userId = data.userId;
    this.analyzedDomains = data.analyzedDomains;

    console.log(
      '📊 Loaded user data - usageCount:',
      this.usageCount,
      'analyzedDomains:',
      this.analyzedDomains
    );
    await StorageManager.ensureUserId(this.userId);
  }

  async loadAccumulatedResults() {
    this.accumulatedResults = await ResultsManager.loadAccumulatedResults();
  }

  async saveAccumulatedResults() {
    await ResultsManager.saveAccumulatedResults(this.accumulatedResults);
  }

  generateUserId() {
    return StorageManager.generateUserId();
  }

  async saveUserData() {
    await StorageManager.saveUserData({
      usageCount: this.usageCount,
      isPremium: this.isPremium,
      userId: this.userId,
      analyzedDomains: this.analyzedDomains,
    });
  }

  updateUI() {
    const upgradeNoticeEl = document.getElementById('upgradeNotice');
    const statusSection = document.getElementById('statusSection');
    const upgradeBtn = document.getElementById('upgradeButton');
    const premiumButtonsGroup = document.getElementById('premiumButtonsGroup');
    const mainInterface = document.getElementById('mainInterface');
    const multiPageInfo = document.querySelector('.multi-page-info');
    const actionButtonsContainer = document.getElementById('actionButtonsContainer');
    const statusText = document.getElementById('statusText');
    const pageSelectionModal = document.getElementById('pageSelectionModal');
    const errorDiv = document.getElementById('error');
    const successDiv = document.getElementById('success');
    const loadingDiv = document.getElementById('loading');
    const resultsSection = document.getElementById('resultsSection');
    const pagesAnalyzedInfo = document.getElementById('pagesAnalyzedInfo');
    const domainProgress = document.getElementById('domainProgress');

    // Hide loader and show interface after init completes
    const loader = document.getElementById('initialLoader');
    if (loader) loader.style.display = 'none';
    if (mainInterface) mainInterface.style.display = 'block';

    if (this.isPremium) {
      // Hide entire status section for premium
      if (statusSection) statusSection.style.display = 'none';
      if (upgradeNoticeEl) upgradeNoticeEl.style.display = 'none';
      if (statusText) statusText.style.display = 'none';

      // Change upgrade button text
      if (upgradeBtn) {
        upgradeBtn.textContent = 'Premium Activated';
        upgradeBtn.disabled = true;
        upgradeBtn.style.background = '#38a169';
      }

      // Move button containers above multi-page-info in correct order
      if (multiPageInfo && actionButtonsContainer) {
        const container = multiPageInfo.parentElement;

        // Move action buttons
        container.insertBefore(actionButtonsContainer, multiPageInfo);

        // Move premium buttons group above multi-page-info for premium users
        if (premiumButtonsGroup) {
          premiumButtonsGroup.classList.add('premium-position');
        }

        // Move messages, progress, and results to top (after pageSelectionModal)
        if (domainProgress) container.insertBefore(domainProgress, multiPageInfo);
        if (errorDiv) container.insertBefore(errorDiv, multiPageInfo);
        if (successDiv) container.insertBefore(successDiv, multiPageInfo);
        if (loadingDiv) container.insertBefore(loadingDiv, multiPageInfo);
        if (pagesAnalyzedInfo) container.insertBefore(pagesAnalyzedInfo, multiPageInfo);
        if (resultsSection) container.insertBefore(resultsSection, multiPageInfo);
      }
    } else {
      // Show status section for free users
      if (statusSection) statusSection.style.display = 'block';
      if (statusText) statusText.style.display = 'block';

      // Update usage count display
      const usageCountEl = document.getElementById('usageCount');
      const usageProgressEl = document.getElementById('usageProgress');
      if (usageCountEl) usageCountEl.textContent = this.usageCount;
      if (usageProgressEl) usageProgressEl.style.width = (this.usageCount / 3) * 100 + '%';

      if (this.usageCount >= 3) {
        if (upgradeNoticeEl) upgradeNoticeEl.style.display = 'block';
        const analyzeBtn = document.getElementById('analyzeBtn');
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

  repositionMobileSectionForUser() {
    const mobileSection = document.getElementById('mobileAnalysisSection');
    const multiPageInfo = document.querySelector('.multi-page-info');
    const actionButtonsContainer = document.getElementById('actionButtonsContainer');

    if (!mobileSection) return;

    if (this.isPremium) {
      // For premium: move mobile section BEFORE multi-page info
      if (multiPageInfo && mobileSection) {
        multiPageInfo.parentNode.insertBefore(mobileSection, multiPageInfo);
      }
    } else {
      // For free: move mobile section AFTER action buttons
      if (actionButtonsContainer && mobileSection) {
        actionButtonsContainer.parentNode.insertBefore(
          mobileSection,
          actionButtonsContainer.nextSibling
        );
      }
    }
  }

  bindEvents() {
    const self = this;
    document.getElementById('analyzeBtn').addEventListener('click', function () {
      self.analyzeSite();
    });

    //    const upgradeBtn = document.getElementById('upgradeBtn');
    //    if (upgradeBtn) {
    //      upgradeBtn.addEventListener('click', function() {
    //        self.handleUpgrade();
    //      });
    //    }

    document.getElementById('exportCsvBtn').addEventListener('click', function () {
      self.exportCSV();
    });

    document.getElementById('exportHtmlBtn').addEventListener('click', function () {
      self.exportHTMLReport();
    });

    document.getElementById('exportStyleGuideBtn').addEventListener('click', function () {
      self.exportStyleGuide();
    });

    document.getElementById('exportMobileReportBtn').addEventListener('click', function () {
      self.exportMobileReport();
    });

    document.getElementById('resetBtn').addEventListener('click', function () {
      self.resetAnalysis();
    });

    const checkStatusButton = document.getElementById('checkStatusButton');
    if (checkStatusButton) {
      checkStatusButton.addEventListener('click', function () {
        self.checkPremiumStatus();
      });
    }
  }

  bindDomainAnalysisEvents() {
    const self = this;

    document.getElementById('analyzeDomainBtn').addEventListener('click', function () {
      self.analyzeDomain();
    });

    document.getElementById('startWithoutMobileBtn').addEventListener('click', function () {
      self.startDomainAnalysisWithMobileChoice(false, false);
    });

    document.getElementById('startWithMobileBtn').addEventListener('click', function () {
      self.startDomainAnalysisWithMobileChoice(true, false);
    });

    document.getElementById('startOnlyMobileBtn').addEventListener('click', function () {
      self.startDomainAnalysisWithMobileChoice(true, true);
    });

    document.getElementById('cancelDomainBtn').addEventListener('click', function () {
      self.cancelDomainAnalysis();
    });
  }

  startProgressPolling() {
    DomainAnalysisUI.startProgressPolling(this);
  }

  stopProgressPolling() {
    DomainAnalysisUI.stopProgressPolling();
  }

  async cancelDomainAnalysis() {
    await DomainAnalysisUI.cancelDomainAnalysis(this);
  }

  async analyzeDomain() {
    await DomainAnalysisUI.analyzeDomain(this);
  }

  async startDomainAnalysisWithMobileChoice(useMobileViewport, mobileOnly) {
    DomainAnalysisUI.startDomainAnalysisWithMobileChoice(this, useMobileViewport, mobileOnly);
  }

  async resetAnalysis() {
    const wasReset = await ResultsManager.resetAnalysis(
      this.showSuccess.bind(this),
      this.hideMessages.bind(this)
    );

    if (wasReset) {
      // Clear the instance variables
      this.accumulatedResults = null;
      this.currentResults = null;

      // CRITICAL: Also clear domain analysis storage to prevent old results from reappearing
      await chrome.storage.local.remove([
        'domainAnalysisComplete',
        'domainAnalysisResults',
        'domainAnalysisError',
        'domainAnalysisProgress',
      ]);

      // Show the analyze buttons again after reset
      const analyzeBtn = document.getElementById('analyzeBtn');
      const analyzeDomainBtn = document.getElementById('analyzeDomainBtn');
      if (analyzeBtn) analyzeBtn.style.display = 'block';
      if (analyzeDomainBtn) analyzeDomainBtn.style.display = 'block';
    }
  }

  async checkCurrentSite() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      const isSquarespace = await this.checkIfSquarespace(tab);

      document.getElementById('currentUrl').textContent = new URL(tab.url).hostname;

      if (!isSquarespace) {
        document.getElementById('notSquarespace').style.display = 'block';
        // Show current site info right after the not-squarespace message
        const notSqsEl = document.getElementById('notSquarespace');
        const siteInfoEl = document.getElementById('siteInfo');
        siteInfoEl.style.display = 'block';
        siteInfoEl.style.marginTop = '10px';
        // Move siteInfo right after notSquarespace
        notSqsEl.parentNode.insertBefore(siteInfoEl, notSqsEl.nextSibling);
      } else {
        document.getElementById('siteInfo').style.display = 'block';
      }
    } catch (error) {
      console.error('Error checking current site:', error);
    }
  }

  async checkIfSquarespace(tab) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function () {
          var indicators = [
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
          var found = false;
          for (var i = 0; i < indicators.length; i++) {
            if (indicators[i]) {
              found = true;
              break;
            }
          }
          return found;
        },
      });
      return (results[0] && results[0].result) || false;
    } catch (e) {
      return false;
    }
  }

  async checkOngoingDomainAnalysis() {
    await DomainAnalysisUI.checkOngoingDomainAnalysis(this);
  }

  autoExportReportsForQualityIssues() {
    if (!this.accumulatedResults) return;

    const data = this.accumulatedResults;
    const qualityChecks = data.qualityChecks || {};

    // Check each quality check category for errors
    const hasGenericImages = (qualityChecks.genericImageNames || []).length > 0;
    const hasMissingAltText = (qualityChecks.missingAltText || []).length > 0;

    // Auto-export Images Report only if image-related quality check errors found
    if (hasGenericImages || hasMissingAltText) {
      this.exportImagesReport();
    }
  }

  async checkPremiumStatus() {
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
      const data = await checkLicense(trimmedEmail);
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
          await chrome.storage.local.set({
            isPremium: true,
            licenseEmail: trimmedEmail,
            licenseData: data,
          });

          // Reload user data and update UI
          await this.loadUserData();
          this.updateUI();

          let message = `✅ Premium Status: Active\n\n`;
          message += `📧 Email: ${trimmedEmail}\n`;
          message += `📅 Expires: ${expiryDate.toLocaleDateString()}\n`;
          message += `⏰ Days Remaining: ${daysRemaining} days\n\n`;
          message += `Your premium status has been activated in the extension!`;

          customAlert(message);
          if (statusMsg) statusMsg.style.display = 'none';
        } else {
          // Lifetime license (no expiration date)
          await chrome.storage.local.set({
            isPremium: true,
            licenseEmail: trimmedEmail,
            licenseData: data,
          });

          await this.loadUserData();
          this.updateUI();

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
  }

  async analyzeSite() {
    await SinglePageAnalysisManager.analyzeSite(this);
  }

  mergeResults(newResults) {
    const result = ResultsManager.mergeResults(this.accumulatedResults, newResults);

    // Handle the case where mergeResults returns an object with alreadyAnalyzed flag
    if (result.alreadyAnalyzed) {
      customAlert('This page has already been analyzed. Navigate to a different page.');
      return false;
    }

    // Update local reference (result could be the merged object or { merged, alreadyAnalyzed })
    this.accumulatedResults = result.merged || result;
    this.saveAccumulatedResults();
    return true;
  }

  displayResults() {
    ResultsManager.displayResults(this.accumulatedResults);
  }

  // Check if data is from mobile-only analysis (all design fields empty)
  isMobileOnlyData() {
    return ResultsManager.isMobileOnlyData(this.accumulatedResults);
  }

  // Check if data contains mobile analysis results
  hasMobileData() {
    return ResultsManager.hasMobileData(this.accumulatedResults);
  }

  exportCSV() {
    if (this.isMobileOnlyData()) {
      customAlert(
        'No data to export. This analysis only contains mobile usability data. Use the Mobile Report button instead.'
      );
      return;
    }
    ExportCSV.export(
      this.accumulatedResults,
      this.FILENAME_BRAND,
      this.showSuccess.bind(this),
      this.showError.bind(this)
    );
  }

  exportHTMLReport() {
    if (this.isMobileOnlyData()) {
      customAlert(
        'No data to export. This analysis only contains mobile usability data. Use the Mobile Report button instead.'
      );
      return;
    }
    ExportHTMLReports.export(
      this.accumulatedResults,
      this.FILENAME_BRAND,
      this.showSuccess.bind(this),
      this.showError.bind(this)
    );
  }

  exportImagesReport() {
    if (!this.accumulatedResults) {
      customAlert('No data to export. Please analyze a page first.');
      return;
    }

    const qualityChecks = this.accumulatedResults.qualityChecks || {};
    const imagesWithoutAlt = qualityChecks.missingAltText || [];
    const genericImageNames = qualityChecks.genericImageNames || [];

    // Check if there are any image issues to report
    if (imagesWithoutAlt.length === 0 && genericImageNames.length === 0) {
      customAlert(
        'No image issues found. The Images Report is only generated when there are missing alt text or generic image filename issues.'
      );
      return;
    }

    ExportImagesReport.export(
      this.accumulatedResults,
      imagesWithoutAlt,
      genericImageNames,
      this.FILENAME_BRAND,
      this.downloadFile.bind(this)
    );
  }

  exportStyleGuide() {
    if (this.isMobileOnlyData()) {
      customAlert(
        'No data to export. This analysis only contains mobile usability data. Use the Mobile Report button instead.'
      );
      return;
    }
    ExportStyleGuide.export(
      this.accumulatedResults,
      this.FILENAME_BRAND,
      this.showSuccess.bind(this),
      this.downloadFile.bind(this)
    );
  }

  exportMobileReport() {
    if (!this.accumulatedResults) {
      customAlert('No data to export. Please analyze a page first.');
      return;
    }

    // Check if mobile analysis was performed
    if (!this.hasMobileData()) {
      customAlert(
        'No mobile analysis data to export. This analysis was performed without mobile analysis. Please run an analysis with mobile analysis enabled.'
      );
      return;
    }

    const mobileIssues = this.accumulatedResults.mobileIssues?.issues || [];
    const domain = this.accumulatedResults.metadata?.domain || 'website';

    ExportMobileReport.export(
      this.accumulatedResults,
      mobileIssues,
      domain,
      this.FILENAME_BRAND,
      text =>
        text.replace(
          /[&<>"']/g,
          m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]
        ),
      this.downloadFile.bind(this)
    );

    this.showSuccess('✅ Mobile Usability report exported!');
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  trackUsage(event) {
    chrome.runtime.sendMessage({
      action: 'trackUsage',
      event: event,
      userId: this.userId,
      timestamp: Date.now(),
    });
  }

  showLoading(show) {
    UIHelpers.showLoading(show);
  }

  showError(message) {
    UIHelpers.showError(message);
  }

  showSuccess(message) {
    UIHelpers.showSuccess(message);
  }

  hideMessages() {
    UIHelpers.hideMessages();
  }
}

window.enablePremiumTest = function () {
  chrome.storage.local.set({ isPremium: true, usageCount: 0 }, function () {
    console.log('Premium mode enabled for testing!');
    customAlert('Premium mode enabled! Close and reopen the popup.');
  });
};

window.disablePremiumTest = function () {
  chrome.storage.local.set({ isPremium: false, usageCount: 0 }, function () {
    console.log('Returned to free mode.');
    customAlert('Returned to free mode! Close and reopen the popup.');
  });
};

window.resetExtension = function () {
  chrome.storage.local.clear(function () {
    console.log('Extension data cleared!');
    customAlert('Extension reset! Close and reopen the popup.');
  });
};

document.addEventListener('DOMContentLoaded', function () {
  new SquarespaceAnalyzer();

  // Initialize license manager
  LicenseManager.init();

  // Listen for premium status changes (e.g., from success.html after payment)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.isPremium) {
      const wasPremium = changes.isPremium.oldValue;
      const nowPremium = changes.isPremium.newValue;

      // If upgraded from free to premium, reload the popup
      if (!wasPremium && nowPremium) {
        console.log('Premium activated! Reloading popup...');
        window.location.reload();
      }
    }
  });
});
