import { AnalyzerController } from './domainAnalysisUI';
import { ResultsManager } from '../managers/resultsManager';

export const SinglePageAnalysisUI = {
  pollInterval: null as any,
  isHandlingCompletion: false,

  /**
   * Main method to analyze the current active site page
   */
  async analyzeSite(analyzer: AnalyzerController): Promise<void> {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    let tab = tabs.find(t => t.active);

    // If active tab is internal (like the popup itself in Playwright),
    // find the first available non-internal tab in the current window.
    if (
      !tab ||
      !tab.url ||
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-extension://')
    ) {
      tab = tabs.find(
        t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://')
      );
    }

    if (!tab || !tab.url) {
      analyzer.showError('Cannot find a website to analyze. Please navigate to a regular website.');
      return;
    }

    const currentDomain = new URL(tab.url as string).hostname;
    const isNewDomain = !analyzer.analyzedDomains.includes(currentDomain);

    if (!analyzer.isPremium && isNewDomain && analyzer.usageCount >= 3) {
      analyzer.showError(
        'Please upgrade to analyze more websites. You have used your 3 free websites.'
      );
      return;
    }

    // Show generic loading state
    analyzer.hideMessages();
    const loadingEl = document.getElementById('loading');
    const loadingStatusEl = document.getElementById('loadingStatus');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const cancelBtn = document.getElementById('cancelPageBtn');
    const siteInfo = document.getElementById('siteInfo');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (loadingStatusEl) loadingStatusEl.textContent = 'Analyzing page...';
    if (siteInfo) siteInfo.style.display = 'none';

    // Swap buttons
    if (analyzeBtn) analyzeBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'block';

    // Clear previous persistent state
    await chrome.storage.local.remove([
      'singlePageAnalysisStatus',
      'singlePageProgressText',
      'singlePageAnalysisResults',
      'singlePageAnalysisError',
    ]);

    try {
      console.log('Starting page analysis...');

      if (
        !tab ||
        !tab.url ||
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://')
      ) {
        throw new Error(
          'Cannot analyze Chrome internal pages. Please navigate to a regular website.'
        );
      }

      // Start polling immediately
      this.pollForCompletion(analyzer);

      // "Analyze This Page" always includes mobile analysis
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeMobileViewport',
        url: tab.url,
        viewportWidth: 375,
      });

      if (response && response.success) {
        this.handleCompletion(analyzer, response.data);
      } else if (response && !response.success) {
        throw new Error(response.error);
      }
    } catch (error: any) {
      console.error('Error:', error);
      this.stopPolling();
      const loadingEl = document.getElementById('loading');
      const analyzeBtn = document.getElementById('analyzeBtn');
      const cancelBtn = document.getElementById('cancelPageBtn');
      const siteInfo = document.getElementById('siteInfo');

      if (loadingEl) loadingEl.style.display = 'none';
      if (analyzeBtn) analyzeBtn.style.display = 'block';
      if (cancelBtn) cancelBtn.style.display = 'none';

      if (
        error.message.includes('receiving end') ||
        error.message.includes('Receiving end') ||
        error.message.includes('Could not establish connection')
      ) {
        analyzer.showError(
          'Could not connect to the page. Please refresh the web page, and wait until it has completely loaded, and try again.'
        );
      } else {
        analyzer.showError('Analysis failed: ' + error.message);
      }

      chrome.storage.local.set({
        singlePageAnalysisStatus: 'error',
        singlePageAnalysisError: error.message,
      });
    }
  },

  async cancelAnalysis(analyzer: AnalyzerController): Promise<void> {
    console.log('Cancelling single page analysis...');
    this.stopPolling();

    const loadingEl = document.getElementById('loading');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const cancelBtn = document.getElementById('cancelPageBtn');
    const siteInfo = document.getElementById('siteInfo');

    if (loadingEl) loadingEl.style.display = 'none';
    if (analyzeBtn) analyzeBtn.style.display = 'block'; // Restore analyze button
    if (cancelBtn) cancelBtn.style.display = 'none'; // Hide cancel button

    await chrome.runtime.sendMessage({ action: 'cancelSinglePageAnalysis' });

    analyzer.showSuccess('Analysis cancelled.');

    await chrome.storage.local.remove([
      'singlePageAnalysisStatus',
      'singlePageProgressText',
      'singlePageAnalysisResults',
      'singlePageAnalysisError',
    ]);
  },

  /**
   * Check for ongoing analysis on popup open
   */
  async checkOngoingAnalysis(analyzer: AnalyzerController): Promise<void> {
    const data = await chrome.storage.local.get([
      'singlePageAnalysisStatus',
      'singlePageProgressText',
      'singlePageAnalysisResults',
      'singlePageAnalysisError',
    ]);

    if (data.singlePageAnalysisStatus === 'in-progress') {
      const loadingEl = document.getElementById('loading');
      const analyzeBtn = document.getElementById('analyzeBtn');
      const cancelBtn = document.getElementById('cancelPageBtn');
      const siteInfo = document.getElementById('siteInfo');

      if (loadingEl) loadingEl.style.display = 'flex';
      if (analyzeBtn) analyzeBtn.style.display = 'none';
      if (cancelBtn) cancelBtn.style.display = 'block';
      if (siteInfo) siteInfo.style.display = 'none';

      if (data.singlePageProgressText) {
        const statusEl = document.getElementById('loadingStatus');
        if (statusEl) statusEl.textContent = data.singlePageProgressText;
      }

      // Start polling for completion
      this.pollForCompletion(analyzer);
    } else if (data.singlePageAnalysisStatus === 'complete' && data.singlePageAnalysisResults) {
      this.handleCompletion(analyzer, data.singlePageAnalysisResults);
    } else if (data.singlePageAnalysisStatus === 'error' && data.singlePageAnalysisError) {
      analyzer.showError('Analysis failed: ' + data.singlePageAnalysisError);
      chrome.storage.local.remove(['singlePageAnalysisStatus', 'singlePageAnalysisError']);
    }
  },

  pollForCompletion(analyzer: AnalyzerController): void {
    this.stopPolling();

    this.pollInterval = setInterval(async () => {
      const data = await chrome.storage.local.get([
        'singlePageAnalysisStatus',
        'singlePageProgressText',
        'singlePageAnalysisResults',
        'singlePageAnalysisError',
      ]);

      if (data.singlePageAnalysisStatus === 'complete' && data.singlePageAnalysisResults) {
        this.stopPolling();
        this.handleCompletion(analyzer, data.singlePageAnalysisResults);
      } else if (data.singlePageAnalysisStatus === 'error' && data.singlePageAnalysisError) {
        this.stopPolling();
        const loadingEl = document.getElementById('loading');
        const analyzeBtn = document.getElementById('analyzeBtn');
        const cancelBtn = document.getElementById('cancelPageBtn');
        const siteInfo = document.getElementById('siteInfo');

        if (loadingEl) loadingEl.style.display = 'none';
        if (analyzeBtn) analyzeBtn.style.display = 'block';
        if (cancelBtn) cancelBtn.style.display = 'none';

        analyzer.showError('Analysis failed: ' + data.singlePageAnalysisError);
        chrome.storage.local.remove(['singlePageAnalysisStatus', 'singlePageAnalysisError']);
      } else if (data.singlePageAnalysisStatus === 'in-progress' && data.singlePageProgressText) {
        const statusEl = document.getElementById('loadingStatus');
        if (statusEl) statusEl.textContent = data.singlePageProgressText;
      }
    }, 1000);
  },

  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  },

  async handleCompletion(analyzer: AnalyzerController, results: any): Promise<void> {
    if (this.isHandlingCompletion) return;
    this.isHandlingCompletion = true;

    try {
      const loadingEl = document.getElementById('loading');
      const analyzeBtn = document.getElementById('analyzeBtn');
      const cancelBtn = document.getElementById('cancelPageBtn');
      const siteInfo = document.getElementById('siteInfo');

      if (loadingEl) loadingEl.style.display = 'none';
      if (analyzeBtn) analyzeBtn.style.display = 'block';
      if (cancelBtn) cancelBtn.style.display = 'none';

      // Get current domain for usage tracking
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentDomain = tabs[0] ? new URL(tabs[0].url as string).hostname : '';
      const isNewDomain = currentDomain && !analyzer.analyzedDomains.includes(currentDomain);

      // We need to merge results into analyzer's accumulatedResults
      // The AnalyzerController interface defines accumulatedResults, but relies on updateUI to show it?
      // Actually `AnalyzerController` has distinct methods.

      const mergeResult = ResultsManager.mergeResults(analyzer.accumulatedResults, results);

      if (mergeResult.alreadyAnalyzed) {
        // Handle already analyzed case?
        // Original code: shows alert, returns false.
        // But here we are in a 'success' callback flow usually.
        // If it's already analyzed, we might still want to show it, or just notify.
        // But let's follow the standard pattern:
        // AnalyzerController should probably expose a "mergeResults" method if it needs specific UI logic,
        // but here we can just update the data.
      }

      analyzer.accumulatedResults = mergeResult.merged || mergeResult;
      await analyzer.saveAccumulatedResults();

      analyzer.displayResults();

      if (!analyzer.isPremium && isNewDomain) {
        analyzer.analyzedDomains.push(currentDomain);
        analyzer.usageCount = analyzer.usageCount + 1;
        await analyzer.saveUserData();
        analyzer.updateUI();
      }

      analyzer.showSuccess(
        'Page analyzed successfully! Navigate to another page to add more data, or export your results.'
      );

      analyzer.trackUsage('analysis_completed');

      chrome.storage.local.remove([
        'singlePageAnalysisStatus',
        'singlePageProgressText',
        'singlePageAnalysisResults',
        'singlePageAnalysisError',
      ]);
    } finally {
      this.isHandlingCompletion = false;
    }
  },
};
