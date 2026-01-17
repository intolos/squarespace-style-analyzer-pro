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
    await this.checkOngoingSinglePageAnalysis();

    // Check license in background AFTER showing UI (non-blocking)
    LicenseManager.verifyStoredLicenseInBackground(this);

    // Listen for background progress updates
    chrome.runtime.onMessage.addListener(message => {
      if (message.action === 'analysisProgress' && message.status) {
        const statusEl = document.getElementById('loadingStatus');
        if (statusEl) {
          statusEl.textContent = message.status;
        }
      }
    });
  }

  async verifyStoredLicenseInBackground() {
    await LicenseManager.verifyStoredLicenseInBackground(this);
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

      // CRITICAL: Also clear domain and single-page analysis storage to prevent old results from reappearing
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
    ExportManager.exportImagesReport(this);
  }

  async checkPremiumStatus() {
    await LicenseManager.checkPremiumStatus(this);
  }

  async analyzeSite() {
    await SinglePageAnalysisManager.analyzeSite(this);
  }

  async checkOngoingSinglePageAnalysis() {
    await SinglePageAnalysisManager.checkOngoingAnalysis(this);
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
