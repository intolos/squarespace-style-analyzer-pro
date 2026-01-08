// single-page-analysis-manager.js - Single Page Analysis
// Handles the logic for analyzing the current active page

const SinglePageAnalysisManager = {
  // Main method to analyze the current active site page
  analyzeSite: async function (analyzer) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const currentDomain = new URL(tab.url).hostname;

    const isNewDomain = !analyzer.analyzedDomains.includes(currentDomain);

    if (!analyzer.isPremium && isNewDomain && analyzer.usageCount >= 3) {
      analyzer.showError(
        'Please upgrade to analyze more websites. You have used your 3 free websites.'
      );
      return;
    }

    analyzer.showLoading(true);
    analyzer.hideMessages();

    // Clear previous persistent state before starting new analysis
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

      // Start polling immediately so we catch the results even if they come via storage
      this.pollForCompletion(analyzer);

      // "Analyze This Page" always includes mobile analysis
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeMobileViewport',
        url: tab.url, // Pass URL instead of tabId to trigger background clone
        viewportWidth: 375,
      });

      // If the popup stayed open, we get the response here.
      // handleCompletion handles the cleanup and display.
      if (response && response.success) {
        this.handleCompletion(analyzer, response.data);
      } else if (response && !response.success) {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Error:', error);
      this.stopPolling();
      analyzer.showLoading(false);

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

  checkOngoingAnalysis: async function (analyzer) {
    const data = await chrome.storage.local.get([
      'singlePageAnalysisStatus',
      'singlePageProgressText',
      'singlePageAnalysisResults',
      'singlePageAnalysisError',
    ]);

    if (data.singlePageAnalysisStatus === 'in-progress') {
      analyzer.showLoading(true);
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

  pollInterval: null,

  pollForCompletion: function (analyzer) {
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
        analyzer.showLoading(false);
        analyzer.showError('Analysis failed: ' + data.singlePageAnalysisError);
        chrome.storage.local.remove(['singlePageAnalysisStatus', 'singlePageAnalysisError']);
      } else if (data.singlePageAnalysisStatus === 'in-progress' && data.singlePageProgressText) {
        const statusEl = document.getElementById('loadingStatus');
        if (statusEl) statusEl.textContent = data.singlePageProgressText;
      }
    }, 1000);
  },

  stopPolling: function () {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  },

  isHandlingCompletion: false,

  handleCompletion: async function (analyzer, results) {
    if (this.isHandlingCompletion) return;
    this.isHandlingCompletion = true;

    try {
      analyzer.showLoading(false);
      analyzer.currentResults = results;

      // Get current domain for usage tracking
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentDomain = tabs[0] ? new URL(tabs[0].url).hostname : '';
      const isNewDomain = currentDomain && !analyzer.analyzedDomains.includes(currentDomain);

      const merged = analyzer.mergeResults(analyzer.currentResults);

      if (merged) {
        analyzer.displayResults();

        if (!analyzer.isPremium && isNewDomain) {
          analyzer.analyzedDomains.push(currentDomain);
          analyzer.usageCount = analyzer.usageCount + 1;
          await analyzer.saveUserData();
          analyzer.updateUI();
          analyzer.showSuccess(
            'Website analyzed! You have used ' + analyzer.usageCount + ' of 3 free websites.'
          );
        } else if (!analyzer.isPremium) {
          analyzer.showSuccess('Page analyzed!');
        } else {
          analyzer.showSuccess(
            'Page analyzed successfully! Navigate to another page to add more data, or export your results.'
          );
        }

        analyzer.trackUsage('analysis_completed');
      }

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

// Make globally available
window.SinglePageAnalysisManager = SinglePageAnalysisManager;
