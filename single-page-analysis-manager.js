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

      // "Analyze This Page" always includes mobile analysis
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeMobileViewport',
        tabId: tab.id,
        viewportWidth: 375,
      });

      if (response && response.success) {
        analyzer.currentResults = response.data;

        const merged = analyzer.mergeResults(analyzer.currentResults);

        // Only proceed if merge was successful (page wasn't already analyzed)
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
      } else {
        throw new Error(response ? response.error : 'No response from content script');
      }
    } catch (error) {
      console.error('Error:', error);

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
    } finally {
      analyzer.showLoading(false);
    }
  },
};

// Make globally available
window.SinglePageAnalysisManager = SinglePageAnalysisManager;
