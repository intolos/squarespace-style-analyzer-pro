import { LicenseManager } from '../../src/managers/licenseManager';
import { StorageManager } from '../../src/utils/storage';
import { ResultsManager } from '../../src/managers/resultsManager';
import { ExportManager } from '../../src/export/index';
import { DomainAnalysisUI, AnalyzerController } from '../../src/ui/domainAnalysisUI';
import { SinglePageAnalysisUI } from '../../src/ui/singlePageAnalysisUI';
import { UIHelpers, customAlert } from '../../src/utils/uiHelpers';
import { platformStrings, isSqs } from '../../src/utils/platform';

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
    await this.checkOngoingDomainAnalysis();
    await this.checkOngoingSinglePageAnalysis();

    // Check license in background (non-blocking)
    LicenseManager.verifyStoredLicenseInBackground(this);

    // Listen for background updates
    chrome.runtime.onMessage.addListener(message => {
      if (message.action === 'analysisProgress' && message.status) {
        const statusEl = document.getElementById('loadingStatus');
        if (statusEl) {
          statusEl.textContent = message.status;
        }
      }
    });

    // Premium status listener for instant update
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.isPremium) {
        const wasPremium = changes.isPremium.oldValue;
        const nowPremium = changes.isPremium.newValue;
        if (!wasPremium && nowPremium) {
          console.log('Premium activated! Reloading popup...');
          window.location.reload();
        }
      }
    });
  }

  async loadUserData() {
    const data = await StorageManager.loadUserData();
    this.usageCount = data.usageCount;
    this.isPremium = data.isPremium;
    this.userId = data.userId;
    this.analyzedDomains = data.analyzedDomains || [];

    // Ensure userId exists
    await StorageManager.ensureUserId(this.userId);
  }

  async loadAccumulatedResults() {
    this.accumulatedResults = await ResultsManager.loadAccumulatedResults();
  }

  async saveAccumulatedResults() {
    await ResultsManager.saveAccumulatedResults(this.accumulatedResults);
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
      if (statusSection) statusSection.style.display = 'none';
      if (upgradeNoticeEl) upgradeNoticeEl.style.display = 'none';
      if (statusText) statusText.style.display = 'none';

      if (upgradeBtn) {
        upgradeBtn.textContent = 'Premium Activated';
        upgradeBtn.disabled = true;
        upgradeBtn.style.background = '#38a169';
      }

      if (multiPageInfo && actionButtonsContainer && actionButtonsContainer.parentElement) {
        // Move containers
        const container = multiPageInfo.parentElement;
        container.insertBefore(actionButtonsContainer, multiPageInfo);

        if (premiumButtonsGroup) premiumButtonsGroup.classList.add('premium-position');

        if (domainProgress) container.insertBefore(domainProgress, multiPageInfo);
        if (errorDiv) container.insertBefore(errorDiv, multiPageInfo);
        if (successDiv) container.insertBefore(successDiv, multiPageInfo);
        if (loadingDiv) container.insertBefore(loadingDiv, multiPageInfo);
        if (pagesAnalyzedInfo) container.insertBefore(pagesAnalyzedInfo, multiPageInfo);
        if (resultsSection) container.insertBefore(resultsSection, multiPageInfo);
      }
    } else {
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
    const mobileSection = document.getElementById('mobileAnalysisSection');
    const multiPageInfo = document.querySelector('.multi-page-info');
    const actionButtonsContainer = document.getElementById('actionButtonsContainer');

    if (!mobileSection) return;

    if (this.isPremium && multiPageInfo && multiPageInfo.parentNode) {
      multiPageInfo.parentNode.insertBefore(mobileSection, multiPageInfo);
    } else if (!this.isPremium && actionButtonsContainer && actionButtonsContainer.parentNode) {
      actionButtonsContainer.parentNode.insertBefore(
        mobileSection,
        actionButtonsContainer.nextSibling
      );
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
      .getElementById('cancelSinglePageAnalysisBtn')
      ?.addEventListener('click', () => this.cancelSinglePageAnalysis());

    document
      .getElementById('checkStatusButton')
      ?.addEventListener('click', () => this.checkPremiumStatus());

    // Test buttons
    /* 
    window.enablePremiumTest = ... // WXT handles window context differently, avoid globals if possible
    */
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
          siteInfo.style.display = 'block';
          siteInfo.style.marginTop = '10px';
          notSqs.parentNode.insertBefore(siteInfo, notSqs.nextSibling);
        }
      } else {
        const siteInfo = document.getElementById('siteInfo');
        if (siteInfo) siteInfo.style.display = 'block';
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
      if (analyzeBtn) analyzeBtn.style.display = 'block';
      if (analyzeDomainBtn) analyzeDomainBtn.style.display = 'block';
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

  checkPremiumStatus() {
    LicenseManager.checkPremiumStatus(this);
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
}

// Start
document.addEventListener('DOMContentLoaded', () => {
  new SquarespaceAnalyzer();
});
