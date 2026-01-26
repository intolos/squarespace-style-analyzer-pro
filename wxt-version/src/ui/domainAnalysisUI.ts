import { DomainAnalysisManager } from '../managers/domainAnalysis';
import { PageSelectionUI } from './pageSelectionUI';
import { UIHelpers, customAlert, customConfirm } from '../utils/uiHelpers';

export interface AnalyzerController {
  isDomainAnalyzing: boolean;
  currentDomain: string;
  isNewDomain: boolean;
  analyzedDomains: string[];
  isPremium: boolean;
  usageCount: number;
  accumulatedResults: any;
  showError: (msg: string) => void;
  showSuccess: (msg: string) => void;
  hideMessages: () => void;
  saveAccumulatedResults: () => Promise<void>;
  displayResults: () => void;
  updateUI: () => void;
  saveUserData: () => Promise<void>;
  trackUsage: (event: string) => void;
  groupedUrls?: any;
  totalPagesForAnalysis?: number;
  showDomainConfirmation: boolean;
  setHideDomainConfirmation: (hide: boolean) => Promise<void>;
}

export const DomainAnalysisUI = {
  // polling state
  progressInterval: null as any,
  completionInterval: null as any,
  cancellationTimeout: null as any,
  cancellationRequested: false,
  lastProgressUpdate: 0,

  // Check for ongoing analysis on popup load
  async checkOngoingDomainAnalysis(analyzer: AnalyzerController): Promise<void> {
    const data = await chrome.storage.local.get([
      'domainAnalysisComplete',
      'domainAnalysisProgress',
      'isPremium',
      'domainAnalysisMobileOnly',
      'domainAnalysisUseMobileViewport',
    ]);

    if (data.domainAnalysisProgress && !data.domainAnalysisComplete) {
      // Re-connect to ongoing analysis
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0].url) {
        const currentDomain = new URL(tabs[0].url).hostname.replace('www.', '');

        analyzer.isDomainAnalyzing = true;
        analyzer.currentDomain = currentDomain;
        analyzer.isNewDomain = !analyzer.analyzedDomains.includes(currentDomain);

        const progressEl = document.getElementById('domainProgress');
        const analyzeBtn = document.getElementById('analyzeBtn');
        const analyzeDomainBtn = document.getElementById('analyzeDomainBtn');
        const cancelDomainBtn = document.getElementById('cancelDomainBtn');
        const siteInfo = document.getElementById('siteInfo');

        if (progressEl) progressEl.style.display = 'block';
        if (analyzeBtn) analyzeBtn.style.display = 'none';
        if (analyzeDomainBtn) analyzeDomainBtn.style.display = 'none';
        if (cancelDomainBtn) cancelDomainBtn.style.display = 'block';
        if (siteInfo) siteInfo.style.display = 'none';

        this.updateDomainProgress(
          (data.domainAnalysisProgress as any) || { analyzed: 0, total: 0 },
          (data.isPremium as boolean) || false
        );
        this.startProgressPolling(analyzer); // Pass check for completion inside polling or start separate
        this.checkForCompletion(
          analyzer,
          currentDomain,
          analyzer.isNewDomain,
          (data.domainAnalysisMobileOnly as boolean) || false,
          (data.domainAnalysisUseMobileViewport as boolean) || false
        );
      }
    }
  },

  // Main entry point for domain analysis
  async analyzeDomain(analyzer: AnalyzerController): Promise<void> {
    if (analyzer.isDomainAnalyzing) {
      customAlert('Domain analysis already in progress');
      return;
    }

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length || !tabs[0].url) return;

    const tab = tabs[0];
    const currentDomain = new URL(tab.url || '').hostname.replace('www.', '');
    analyzer.currentDomain = currentDomain;
    analyzer.isNewDomain = !analyzer.analyzedDomains.includes(currentDomain);

    if (!analyzer.isPremium && analyzer.isNewDomain && analyzer.usageCount >= 3) {
      analyzer.showError(
        'Please upgrade to analyze more websites. You have used your 3 free websites.'
      );
      return;
    }

    // Use personalized confirmation message
    const msgFree = `This will automatically analyze up to 10 pages found in the sitemap.\n\nAfter you start the analysis in the extension, you can close the extension (simply click off of it or go to another web page) and continue working - the analysis will run in the background.\n\nIn the Premium version, the full domain is analyzed without page limitation. It includes an extra feature of being able to select pages for analysis. This is specifically helpful for larger websites where you are able to select groups of pages to analyze your entire site in sections if desired to save time.\n\nAnalyzing multiple pages takes some time. It takes the same time as loading the page in full, after all lazy-loading elements and all, plus the time to actually do the extensive analyses that we perform. Now you know.\n\nContinue?`;

    const msgPremium = `After you start the analysis in the extension, you can close the extension (simply click off of it or go to another web page) and continue working - the analysis will run in the background.\n\nIn your Premium version, the full domain is analyzed without page limitation. It includes an extra feature of being able to select pages for analysis. This is specifically helpful for larger websites where you are able to select groups of pages to analyze your entire site in sections if desired to save time.\n\nAnalyzing multiple pages takes some time. It takes the same time as loading the page in full, after all lazy-loading elements and all, plus the time to actually do the extensive analyses that we perform. Now you know.\n\nContinue?`;

    let confirmed = true;
    if (analyzer.isPremium && !analyzer.showDomainConfirmation) {
      confirmed = true;
    } else {
      const result = await customConfirm(
        analyzer.isPremium ? msgPremium : msgFree,
        'Analyze Entire Domain',
        analyzer.isPremium
      );
      confirmed = result.confirmed;

      if (result.confirmed && result.checkboxChecked) {
        await analyzer.setHideDomainConfirmation(true);
      }
    }

    if (!confirmed) return;

    // For premium users, fetch sitemap first and show page selection
    if (analyzer.isPremium) {
      const siteInfo = document.getElementById('siteInfo');
      if (siteInfo) siteInfo.style.display = 'none';

      analyzer.showSuccess('Fetching sitemap and navigation...');

      try {
        const [sitemapUrls, navStructure] = await Promise.all([
          DomainAnalysisManager.fetchSitemap(currentDomain),
          DomainAnalysisManager.fetchNavigationStructure(currentDomain),
        ]);

        if (!sitemapUrls || sitemapUrls.length === 0) {
          analyzer.showError('No sitemap found. Please use page-by-page analysis instead.');
          return;
        }

        console.log('✅ Fetched sitemap:', sitemapUrls.length, 'pages');
        this.showPageSelectionModal(
          analyzer,
          sitemapUrls.length,
          currentDomain,
          analyzer.isNewDomain,
          sitemapUrls,
          navStructure
        );
      } catch (error: any) {
        analyzer.showError('Could not fetch sitemap: ' + error.message);
      }
    } else {
      // Free users flow
      const analyzeDomainBtn = document.getElementById('analyzeDomainBtn');
      const mobileAnalysisChoice = document.getElementById('mobileAnalysisChoice');

      if (analyzeDomainBtn) analyzeDomainBtn.style.display = 'none';
      if (mobileAnalysisChoice) mobileAnalysisChoice.style.display = 'block';

      analyzer.totalPagesForAnalysis = 10;

      const mobileTimeAddition = document.getElementById('mobileTimeAddition');
      if (mobileTimeAddition) {
        const mobileMinutes = Math.ceil((10 * 2) / 60);
        mobileTimeAddition.innerHTML = `<br>(+ ~${mobileMinutes} min)`;
      }
    }
  },

  showPageSelectionModal(
    analyzer: AnalyzerController,
    totalPages: number,
    domain: string,
    isNewDomain: boolean,
    sitemapUrls: string[],
    navStructure: any
  ): void {
    analyzer.currentDomain = domain;
    analyzer.isNewDomain = isNewDomain;

    // Step 1: Try nav detection grouping
    let groupedUrls = DomainAnalysisManager.groupUrlsByNavigation(
      sitemapUrls,
      navStructure,
      domain
    );
    let detectionMethod = 'nav';

    // Check detection quality
    let quality = DomainAnalysisManager.checkDetectionQuality(
      navStructure,
      groupedUrls,
      totalPages
    );

    if (quality.isPoor) {
      console.log('⚠️ Step 1 detection poor: ' + quality.reason);
      console.log(
        '⏭️ Skipping Step 2 (rendered DOM), proceeding to Step 3 (path pattern grouping)...'
      );

      // Step 3: Use path pattern grouping
      groupedUrls = DomainAnalysisManager.groupUrlsByPathPattern(sitemapUrls, domain);
      detectionMethod = 'pathPattern';

      // Re-check quality
      const navStructForCheck = {
        sections: Object.keys(groupedUrls.sections).map(k => ({
          name: k,
          pathname: '',
          url: '',
          isGroup: false,
        })),
        blogSection: null,
        allNavUrls: new Set<string>(),
      };

      let pathQuality = DomainAnalysisManager.checkDetectionQuality(
        navStructForCheck,
        groupedUrls,
        totalPages
      );
      console.log('📊 Path pattern quality: ' + (pathQuality.isPoor ? 'still poor' : 'acceptable'));
    }

    analyzer.groupedUrls = groupedUrls;

    PageSelectionUI.show(
      totalPages,
      domain,
      sitemapUrls,
      navStructure,
      groupedUrls,
      () => {}, // onCancel
      (urlsToAnalyze, useMobileViewport, mobileOnly) => {
        // onStartAnalysis
        this.startDomainAnalysisWithUrls(
          analyzer,
          domain,
          urlsToAnalyze,
          isNewDomain,
          useMobileViewport,
          mobileOnly
        );
      },
      detectionMethod,
      quality
    );
  },

  startDomainAnalysisWithUrls(
    analyzer: AnalyzerController,
    currentDomain: string,
    urls: string[],
    isNewDomain: boolean,
    useMobileViewport: boolean,
    mobileOnly: boolean
  ): void {
    analyzer.isDomainAnalyzing = true;
    analyzer.hideMessages();

    const siteInfo = document.getElementById('siteInfo');

    document.getElementById('domainProgress')!.style.display = 'block';
    document.getElementById('analyzeBtn')!.style.display = 'none';
    document.getElementById('analyzeDomainBtn')!.style.display = 'none';
    document.getElementById('cancelDomainBtn')!.style.display = 'block';
    if (siteInfo) siteInfo.style.display = 'none';

    chrome.storage.local.remove([
      'domainAnalysisComplete',
      'domainAnalysisResults',
      'domainAnalysisError',
      'domainAnalysisMobileOnly',
      'domainAnalysisUseMobileViewport',
    ]);

    chrome.storage.local.set({
      domainAnalysisMobileOnly: mobileOnly,
      domainAnalysisUseMobileViewport: useMobileViewport,
    });

    chrome.runtime.sendMessage({
      action: 'startDomainAnalysisWithUrls',
      data: {
        domain: currentDomain,
        urls: urls,
        delayBetweenPages: 2000,
        isPremium: analyzer.isPremium,
        useMobileViewport: useMobileViewport,
        mobileOnly: mobileOnly,
      },
    });

    this.startProgressPolling(analyzer);
    this.checkForCompletion(analyzer, currentDomain, isNewDomain, mobileOnly, useMobileViewport);
  },

  startDomainAnalysisWithMobileChoice(
    analyzer: AnalyzerController,
    useMobileViewport: boolean,
    mobileOnly: boolean
  ): void {
    const currentDomain = analyzer.currentDomain;
    const isNewDomain = analyzer.isNewDomain;

    analyzer.isDomainAnalyzing = true;
    analyzer.hideMessages();

    const siteInfo = document.getElementById('siteInfo');

    document.getElementById('mobileAnalysisChoice')!.style.display = 'none';
    document.getElementById('domainProgress')!.style.display = 'block';
    document.getElementById('analyzeBtn')!.style.display = 'none';
    document.getElementById('analyzeDomainBtn')!.style.display = 'none';
    document.getElementById('cancelDomainBtn')!.style.display = 'block';
    if (siteInfo) siteInfo.style.display = 'none';

    chrome.storage.local.remove([
      'domainAnalysisComplete',
      'domainAnalysisResults',
      'domainAnalysisError',
      'domainAnalysisProgress',
      'domainAnalysisMobileOnly',
      'domainAnalysisUseMobileViewport',
    ]);

    chrome.storage.local.set({
      domainAnalysisMobileOnly: mobileOnly,
      domainAnalysisUseMobileViewport: useMobileViewport,
    });

    const maxPages = analyzer.isPremium ? 500 : 10;

    const progressHeader = document.querySelector('#domainProgress h4');
    if (progressHeader) {
      progressHeader.textContent = '🔄 Analyzing Domain...';
    }

    chrome.runtime.sendMessage({
      action: 'startDomainAnalysis',
      data: {
        domain: currentDomain,
        maxPages: maxPages,
        delayBetweenPages: 2000,
        isPremium: analyzer.isPremium,
        useMobileViewport: useMobileViewport,
        mobileOnly: mobileOnly,
      },
    });

    this.startProgressPolling(analyzer);
    this.checkForCompletion(analyzer, currentDomain, isNewDomain, mobileOnly, useMobileViewport);
  },

  async startProgressPolling(analyzer: AnalyzerController): Promise<void> {
    this.stopProgressPolling();
    const { isPremium } = await chrome.storage.local.get(['isPremium']);

    this.progressInterval = setInterval(async () => {
      const data = await chrome.storage.local.get(['domainAnalysisProgress']);
      if (data.domainAnalysisProgress) {
        this.updateDomainProgress(
          (data.domainAnalysisProgress as any) || { analyzed: 0, total: 0 },
          (isPremium as boolean) || false
        );
      }
    }, 1000);
  },

  stopProgressPolling(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  },

  updateDomainProgress(progress: any, isPremium: boolean): void {
    const fill = document.getElementById('domainProgressFill');
    const text = document.getElementById('domainProgressText');
    const urlEl = document.getElementById('domainProgressUrl');

    if (fill) {
      fill.style.width = (progress.percent || 0) + '%';
      fill.textContent = Math.round(progress.percent || 0) + '%';
    }
    if (text) text.textContent = `Page ${progress.current} of ${progress.total}`;
    if (urlEl) {
      let content = progress.currentUrl || 'Analyzing...';
      if (!isPremium) {
        content += ' (estimated 3-4 minutes)';
      }
      urlEl.textContent = content;
    }

    this.lastProgressUpdate = Date.now();
  },

  checkForCompletion(
    analyzer: AnalyzerController,
    currentDomain: string,
    isNewDomain: boolean,
    mobileOnly = false,
    useMobileViewport = false
  ): void {
    this.lastProgressUpdate = Date.now();

    this.completionInterval = setInterval(async () => {
      const data = await chrome.storage.local.get([
        'domainAnalysisComplete',
        'domainAnalysisError',
      ]);

      if (data.domainAnalysisError) {
        this.handleDomainAnalysisError(
          analyzer,
          (data.domainAnalysisError as string) || 'Unknown error'
        );
      } else if (data.domainAnalysisComplete) {
        const resultsData = await chrome.storage.local.get(['domainAnalysisResults']);
        this.handleDomainAnalysisComplete(
          analyzer,
          resultsData.domainAnalysisResults,
          currentDomain,
          isNewDomain,
          mobileOnly,
          useMobileViewport
        );
      } else {
        // Hang detection
        if (this.cancellationRequested && Date.now() - this.lastProgressUpdate > 10000) {
          console.warn('No progress update for 10 seconds after cancellation - forcing cleanup');
          this.handleHangDetected(analyzer);
        } else if (!this.cancellationRequested && Date.now() - this.lastProgressUpdate > 30000) {
          console.warn('No progress update for 30 seconds - analysis may be stuck');
          this.handleHangDetected(analyzer);
        }
      }
    }, 2000);
  },

  async handleDomainAnalysisComplete(
    analyzer: AnalyzerController,
    result: any,
    currentDomain: string,
    isNewDomain: boolean,
    mobileOnly = false,
    useMobileViewport = false
  ): Promise<void> {
    clearInterval(this.completionInterval);
    this.stopProgressPolling();
    analyzer.isDomainAnalyzing = false;

    if (this.cancellationTimeout) {
      clearTimeout(this.cancellationTimeout);
      this.cancellationTimeout = null;
    }
    this.cancellationRequested = false;

    const progressEl = document.getElementById('domainProgress');
    const analyzeDomainBtn = document.getElementById('analyzeDomainBtn');
    const cancelBtn = document.getElementById('cancelDomainBtn');
    const siteInfo = document.getElementById('siteInfo');

    if (progressEl) progressEl.style.display = 'none';
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) analyzeBtn.style.display = 'block';
    if (analyzeDomainBtn) analyzeDomainBtn.style.display = 'block';
    if (cancelBtn) cancelBtn.style.display = 'none';
    // Removed siteInfo.style.display = 'block' per user request - 2026-01-19
    // siteInfo should only reappear on Reset.

    if (result && result.success) {
      const data = result.data || {
        metadata: {
          url: currentDomain,
          domain: currentDomain,
          pagesAnalyzed: [],
          timestamp: new Date().toISOString(),
        },
        headings: {},
        paragraphs: {},
        buttons: {},
        links: {},
        siteStyles: {},
        mobileIssues:
          mobileOnly || useMobileViewport
            ? {
                viewportMeta: { exists: true, content: 'Analysis cancelled', isProper: false },
                issues: [],
              }
            : { issues: [] },
        squarespaceThemeStyles: {},
      };

      if (mobileOnly || useMobileViewport) {
        if (!data.mobileIssues) data.mobileIssues = { issues: [] };
        if (!data.mobileIssues.viewportMeta) data.mobileIssues.viewportMeta = {};
        if (
          data.mobileIssues.viewportMeta.content === null ||
          data.mobileIssues.viewportMeta.content === undefined
        ) {
          data.mobileIssues.viewportMeta.content = 'Requested (incomplete)';
          data.mobileIssues.viewportMeta.exists = true;
        }
      }

      analyzer.accumulatedResults = data;
      await analyzer.saveAccumulatedResults();

      const resultsSection = document.getElementById('resultsSection');
      const pagesAnalyzedInfo = document.getElementById('pagesAnalyzedInfo');
      if (resultsSection) resultsSection.style.display = 'block';
      if (pagesAnalyzedInfo) pagesAnalyzedInfo.style.display = 'block';

      analyzer.displayResults();

      if (mobileOnly) {
        if (!result.cancelled) {
          if (!analyzer.isPremium && isNewDomain) {
            analyzer.analyzedDomains.push(currentDomain);
            analyzer.usageCount = analyzer.usageCount + 1;
            await analyzer.saveUserData();
            analyzer.updateUI();
          }

          const mobileIssues = data.mobileIssues?.issues || [];
          if (mobileIssues.length > 0) {
            analyzer.showSuccess(
              `✅ Mobile analysis complete! Found ${mobileIssues.length} issue${
                mobileIssues.length === 1 ? '' : 's'
              }. Click the Mobile Report button to export.`
            );
          } else {
            analyzer.showSuccess(
              '✅ Mobile analysis complete! No issues found. Click the Mobile Report button to view the report.'
            );
          }
        } else {
          const pagesAnalyzed = result.stats ? result.stats.successfulPages : 0;
          analyzer.showSuccess(
            `Analysis cancelled. ${pagesAnalyzed} page${
              pagesAnalyzed === 1 ? '' : 's'
            } analyzed before cancellation.`
          );
        }
        return;
      }

      if (!result.cancelled && !analyzer.isPremium && isNewDomain) {
        analyzer.analyzedDomains.push(currentDomain);
        analyzer.usageCount = analyzer.usageCount + 1;
        await analyzer.saveUserData();
      }

      if (result.cancelled) {
        const pagesAnalyzed = result.stats ? result.stats.successfulPages : 0;
        if (pagesAnalyzed > 0) {
          analyzer.showSuccess(
            `Analysis cancelled. Successfully analyzed ${pagesAnalyzed} page${
              pagesAnalyzed === 1 ? '' : 's'
            } before cancellation. Results are available for export.`
          );
        } else {
          analyzer.showSuccess('Analysis cancelled. No pages were completed before cancellation.');
        }
      } else {
        if (result.stats && result.stats.failedPages > 0) {
          analyzer.showSuccess(
            `Analyzed ${result.stats.successfulPages} of ${result.stats.totalPages} pages successfully (${result.stats.failedPages} failed). This can occur due to differences in how pages load during automated analysis versus in a browser. After reviewing your CSV file, you can retry each failed page individually using the 'Analyze This Page' button.`
          );
        } else {
          analyzer.showSuccess(
            `Domain analysis complete! Analyzed ${
              result.stats ? result.stats.successfulPages : ''
            } of ${result.stats ? result.stats.totalPages : ''} pages successfully.`
          );
        }
      }

      if (resultsSection) resultsSection.style.setProperty('display', 'block', 'important');
      if (pagesAnalyzedInfo) pagesAnalyzedInfo.style.setProperty('display', 'block', 'important');

      analyzer.updateUI();
      analyzer.trackUsage('domain_analysis_completed');
    }

    chrome.storage.local.remove([
      'domainAnalysisComplete',
      'domainAnalysisResults',
      'domainAnalysisProgress',
      'domainAnalysisMobileOnly',
      'domainAnalysisUseMobileViewport',
    ]);
  },

  handleDomainAnalysisError(analyzer: AnalyzerController, errorMessage: string): void {
    clearInterval(this.completionInterval);
    this.stopProgressPolling();
    analyzer.isDomainAnalyzing = false;

    if (this.cancellationTimeout) {
      clearTimeout(this.cancellationTimeout);
      this.cancellationTimeout = null;
    }
    this.cancellationRequested = false;

    const siteInfo = document.getElementById('siteInfo');

    document.getElementById('domainProgress')!.style.display = 'none';
    document.getElementById('analyzeBtn')!.style.display = 'block';
    document.getElementById('analyzeDomainBtn')!.style.display = 'block';
    document.getElementById('cancelDomainBtn')!.style.display = 'none';
    if (siteInfo) siteInfo.style.display = 'block';

    const cleanMessage = errorMessage.startsWith('Analysis error: ')
      ? errorMessage
      : errorMessage === 'Analysis cancelled by user'
        ? errorMessage
        : 'Analysis error: ' + errorMessage;

    analyzer.showError(cleanMessage);
    chrome.storage.local.remove(['domainAnalysisError']);
  },

  async handleHangDetected(analyzer: AnalyzerController): Promise<void> {
    console.warn('Hang detected - forcing UI cleanup and showing partial results');

    clearInterval(this.completionInterval);
    clearInterval(this.progressInterval);
    this.stopProgressPolling();
    analyzer.isDomainAnalyzing = false;

    const progressEl = document.getElementById('domainProgress');
    const analyzeDomainBtn = document.getElementById('analyzeDomainBtn');
    const cancelBtn = document.getElementById('cancelDomainBtn');
    const siteInfo = document.getElementById('siteInfo');

    if (progressEl) progressEl.style.display = 'none';
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) analyzeBtn.style.display = 'block';
    if (analyzeDomainBtn) analyzeDomainBtn.style.display = 'block';
    if (cancelBtn) cancelBtn.style.display = 'none';
    // Removed siteInfo.style.display = 'block' per user request - 2026-01-19
    // siteInfo should only reappear on Reset.

    const storageData = await chrome.storage.local.get(['domainAnalysisResults']);
    const partialResults = storageData.domainAnalysisResults;

    if (partialResults && (partialResults as any).data) {
      analyzer.accumulatedResults = (partialResults as any).data;
      await analyzer.saveAccumulatedResults();

      const resultsSection = document.getElementById('resultsSection');
      const pagesAnalyzedInfo = document.getElementById('pagesAnalyzedInfo');
      if (resultsSection) resultsSection.style.display = 'block';
      if (pagesAnalyzedInfo) pagesAnalyzedInfo.style.display = 'block';

      analyzer.displayResults();

      const pagesAnalyzed = (partialResults as any).stats
        ? (partialResults as any).stats.successfulPages
        : 0;
      if (pagesAnalyzed > 0) {
        analyzer.showSuccess(
          `Analysis cancelled. Showing results for ${pagesAnalyzed} page${
            pagesAnalyzed === 1 ? '' : 's'
          } analyzed before cancellation.`
        );
      } else {
        analyzer.showSuccess('Analysis cancelled before any pages completed.');
      }
    } else {
      analyzer.showSuccess('Analysis cancelled before any pages completed.');
    }

    chrome.storage.local.remove([
      'domainAnalysisComplete',
      'domainAnalysisResults',
      'domainAnalysisProgress',
      'domainAnalysisError',
      'domainAnalysisMobileOnly',
      'domainAnalysisUseMobileViewport',
    ]);
  },

  cancelDomainAnalysis(analyzer: AnalyzerController): void {
    this.cancellationRequested = true;

    if (this.cancellationTimeout) {
      clearTimeout(this.cancellationTimeout);
    }
    this.cancellationTimeout = setTimeout(() => {
      if (this.cancellationRequested) {
        console.warn('Cancellation timeout (5s) - forcing UI cleanup');
        this.handleHangDetected(analyzer);
      }
    }, 5000);

    chrome.runtime.sendMessage({ action: 'cancelDomainAnalysis' });

    analyzer.showSuccess('Cancelling... generating report for pages analyzed so far.');
  },
};
