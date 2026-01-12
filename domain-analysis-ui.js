// domain-analysis-ui.js - Domain Analysis UI Management
// Handles modals, progress bars, and coordination for domain-level analysis

const DomainAnalysisUI = {
  // ============================================
  // DOMAIN ANALYSIS FLOW
  // ============================================

  // Check for ongoing analysis on popup load
  checkOngoingDomainAnalysis: async function (analyzer) {
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
      if (tabs.length > 0) {
        const currentDomain = new URL(tabs[0].url).hostname.replace('www.', '');

        analyzer.isDomainAnalyzing = true;
        analyzer.currentDomain = currentDomain;
        analyzer.isNewDomain = !analyzer.analyzedDomains.includes(currentDomain);

        document.getElementById('domainProgress').style.display = 'block';
        document.getElementById('analyzeBtn').style.display = 'none';
        document.getElementById('analyzeDomainBtn').style.display = 'none';
        document.getElementById('cancelDomainBtn').style.display = 'block';

        this.updateDomainProgress(data.domainAnalysisProgress, data.isPremium);
        this.startProgressPolling(analyzer);
        this.checkForCompletion(
          analyzer,
          currentDomain,
          analyzer.isNewDomain,
          data.domainAnalysisMobileOnly || false,
          data.domainAnalysisUseMobileViewport || false
        );
      }
    }
  },

  // Main entry point for domain analysis
  analyzeDomain: async function (analyzer) {
    if (analyzer.isDomainAnalyzing) {
      customAlert('Domain analysis already in progress');
      return;
    }

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const currentDomain = new URL(tab.url).hostname.replace('www.', '');
    analyzer.currentDomain = currentDomain;
    analyzer.isNewDomain = !analyzer.analyzedDomains.includes(currentDomain);

    if (!analyzer.isPremium && analyzer.isNewDomain && analyzer.usageCount >= 3) {
      analyzer.showError(
        'Please upgrade to analyze more websites. You have used your 3 free websites.'
      );
      return;
    }

    // For premium users, fetch sitemap first and show page selection
    if (analyzer.isPremium) {
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
      } catch (error) {
        analyzer.showError('Could not fetch sitemap: ' + error.message);
      }
    } else {
      // Free users flow
      if (
        !(await customConfirm(
          `This will automatically analyze up to 10 pages found in the sitemap.\n\nYou can close this popup and continue working - the analysis will run in the background.\n\nIn the Premium version, the full domain is analyzed without page limitation. It includes an extra feature of being able to select pages for analysis. This is specifically helpful for larger websites where you are able to select groups of pages to analyze your entire site in sections if desired to save time.\n\nContinue?`,
          'Analyze Entire Domain'
        ))
      ) {
        return;
      }

      document.getElementById('analyzeDomainBtn').style.display = 'none';
      document.getElementById('mobileAnalysisChoice').style.display = 'block';

      analyzer.totalPagesForAnalysis = 10;

      const mobileTimeAddition = document.getElementById('mobileTimeAddition');
      if (mobileTimeAddition) {
        const mobileMinutes = Math.ceil((10 * 2) / 60);
        mobileTimeAddition.innerHTML = `<br>(+ ~${mobileMinutes} min)`;
      }
    }
  },

  // Show the page selection modal (Premium feature)
  showPageSelectionModal: function (
    analyzer,
    totalPages,
    domain,
    isNewDomain,
    sitemapUrls,
    navStructure
  ) {
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

      // Re-check quality with path pattern grouping
      let pathQuality = DomainAnalysisManager.checkDetectionQuality(
        {
          sections: Object.keys(groupedUrls.sections).map(k => ({ name: k })),
        },
        groupedUrls,
        totalPages
      );
      console.log('📊 Path pattern quality: ' + (pathQuality.isPoor ? 'still poor' : 'acceptable'));
    }

    analyzer.groupedUrls = groupedUrls;

    // Use the existing PageSelectionUI
    if (typeof PageSelectionUI !== 'undefined') {
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
    } else {
      console.error('PageSelectionUI not found!');
      analyzer.showError('Internal error: PageSelectionUI missing.');
    }
  },

  // Start analysis with specific URLs
  startDomainAnalysisWithUrls: function (
    analyzer,
    currentDomain,
    urls,
    isNewDomain,
    useMobileViewport,
    mobileOnly
  ) {
    analyzer.isDomainAnalyzing = true;
    analyzer.hideMessages();

    document.getElementById('domainProgress').style.display = 'block';
    document.getElementById('analyzeBtn').style.display = 'none';
    document.getElementById('analyzeDomainBtn').style.display = 'none';
    document.getElementById('cancelDomainBtn').style.display = 'block';

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

  // Start analysis with mobile choice (Free users)
  startDomainAnalysisWithMobileChoice: function (analyzer, useMobileViewport, mobileOnly) {
    const currentDomain = analyzer.currentDomain;
    const isNewDomain = analyzer.isNewDomain;

    analyzer.isDomainAnalyzing = true;
    analyzer.hideMessages();

    document.getElementById('mobileAnalysisChoice').style.display = 'none';
    document.getElementById('domainProgress').style.display = 'block';
    document.getElementById('analyzeBtn').style.display = 'none';
    document.getElementById('analyzeDomainBtn').style.display = 'none';
    document.getElementById('cancelDomainBtn').style.display = 'block';

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

    // Reverted to original text as requested
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

  // ============================================
  // PROGRESS TRACKING
  // ============================================

  startProgressPolling: async function (analyzer) {
    this.stopProgressPolling();
    // Fetch premium status once for the polling loop
    const { isPremium } = await chrome.storage.local.get(['isPremium']);

    this.progressInterval = setInterval(async () => {
      const data = await chrome.storage.local.get(['domainAnalysisProgress']);
      if (data.domainAnalysisProgress) {
        this.updateDomainProgress(data.domainAnalysisProgress, isPremium);
      }
    }, 1000);
  },

  stopProgressPolling: function () {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  },

  updateDomainProgress: function (progress, isPremium) {
    const fill = document.getElementById('domainProgressFill');
    const text = document.getElementById('domainProgressText');
    const url = document.getElementById('domainProgressUrl');

    if (fill) {
      fill.style.width = (progress.percent || 0) + '%';
      fill.textContent = Math.round(progress.percent || 0) + '%';
    }
    if (text) text.textContent = `Page ${progress.current} of ${progress.total}`;
    if (url) {
      let content = progress.url || 'Analyzing...';
      if (!isPremium) {
        content += ' (estimated 3-4 minutes)';
      }
      url.textContent = content;
    }

    // Track last progress update for hang detection
    this.lastProgressUpdate = Date.now();
  },

  checkForCompletion: function (
    analyzer,
    currentDomain,
    isNewDomain,
    mobileOnly = false,
    useMobileViewport = false
  ) {
    // Initialize last progress update timestamp
    this.lastProgressUpdate = Date.now();

    this.completionInterval = setInterval(async () => {
      const data = await chrome.storage.local.get([
        'domainAnalysisComplete',
        'domainAnalysisError',
      ]);

      if (data.domainAnalysisError) {
        this.handleDomainAnalysisError(analyzer, data.domainAnalysisError);
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
        // Check for hang - if no progress update for 10 seconds after cancellation was requested
        if (this.cancellationRequested && Date.now() - this.lastProgressUpdate > 10000) {
          console.warn('No progress update for 10 seconds after cancellation - forcing cleanup');
          this.handleHangDetected(analyzer);
        }
        // Also check for general hang - no progress for 30 seconds during normal operation
        else if (!this.cancellationRequested && Date.now() - this.lastProgressUpdate > 30000) {
          console.warn('No progress update for 30 seconds - analysis may be stuck');
          this.handleHangDetected(analyzer);
        }
      }
    }, 2000);
  },

  handleDomainAnalysisComplete: async function (
    analyzer,
    result,
    currentDomain,
    isNewDomain,
    mobileOnly = false,
    useMobileViewport = false
  ) {
    clearInterval(this.completionInterval);
    this.stopProgressPolling();
    analyzer.isDomainAnalyzing = false;

    // Clear cancellation flags and timeout
    if (this.cancellationTimeout) {
      clearTimeout(this.cancellationTimeout);
      this.cancellationTimeout = null;
    }
    this.cancellationRequested = false;

    // Force hide progress, show buttons
    const progressEl = document.getElementById('domainProgress');
    const analyzeDomainBtn = document.getElementById('analyzeDomainBtn');
    const cancelBtn = document.getElementById('cancelDomainBtn');

    if (progressEl) progressEl.style.display = 'none';
    if (analyzeDomainBtn) analyzeDomainBtn.style.display = 'block';
    if (cancelBtn) cancelBtn.style.display = 'none';

    if (result && result.success) {
      // Ensure we have at least a skeleton data object so ResultsManager doesn't hide the section
      const data = result.data || {
        metadata: {
          url: currentDomain,
          domain: currentDomain,
          pagesAnalyzed: [],
          timestamp: new Date().toISOString(),
        },
        headings: {
          'heading-1': { locations: [] },
          'heading-2': { locations: [] },
          'heading-3': { locations: [] },
          'heading-4': { locations: [] },
        },
        paragraphs: {
          'paragraph-1': { locations: [] },
          'paragraph-2': { locations: [] },
          'paragraph-3': { locations: [] },
          'paragraph-4': { locations: [] },
        },
        buttons: {
          primary: { locations: [] },
          secondary: { locations: [] },
          tertiary: { locations: [] },
          other: { locations: [] },
        },
        links: { 'in-content': { locations: [] } },
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

      // Patch mobile data if it was requested but is missing/incomplete in the actual data
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

      // Save results
      analyzer.accumulatedResults = data;
      await analyzer.saveAccumulatedResults();

      // Display results section even for empty/cancelled results to show the state
      const resultsSection = document.getElementById('resultsSection');
      const pagesAnalyzedInfo = document.getElementById('pagesAnalyzedInfo');
      if (resultsSection) resultsSection.style.display = 'block';
      if (pagesAnalyzedInfo) pagesAnalyzedInfo.style.display = 'block';

      analyzer.displayResults();

      // For mobile-only analysis, just display results (NO auto-export)
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
              `✅ Mobile analysis complete! Found ${mobileIssues.length} issue${mobileIssues.length === 1 ? '' : 's'}. Click the Mobile Report button to export.`
            );
          } else {
            analyzer.showSuccess(
              '✅ Mobile analysis complete! No issues found. Click the Mobile Report button to view the report.'
            );
          }
        } else {
          // Cancelled during mobile analysis
          const pagesAnalyzed = result.stats ? result.stats.successfulPages : 0;
          analyzer.showSuccess(
            `Analysis cancelled. ${pagesAnalyzed} page${pagesAnalyzed === 1 ? '' : 's'} analyzed before cancellation.`
          );
        }
        return;
      }

      // Normal analysis (with or without mobile)
      if (!result.cancelled && !analyzer.isPremium && isNewDomain) {
        analyzer.analyzedDomains.push(currentDomain);
        analyzer.usageCount = analyzer.usageCount + 1;
        await analyzer.saveUserData();
      }

      // Show appropriate message based on whether it was cancelled
      if (result.cancelled) {
        const pagesAnalyzed = result.stats ? result.stats.successfulPages : 0;
        if (pagesAnalyzed > 0) {
          analyzer.showSuccess(
            `Analysis cancelled. Successfully analyzed ${pagesAnalyzed} page${pagesAnalyzed === 1 ? '' : 's'} before cancellation. Results are available for export.`
          );
        } else {
          analyzer.showSuccess('Analysis cancelled. No pages were completed before cancellation.');
        }
      } else {
        // Normal completion message with failure count if any pages failed
        if (result.stats && result.stats.failedPages > 0) {
          analyzer.showSuccess(
            `Analyzed ${result.stats.successfulPages} of ${result.stats.totalPages} pages successfully (${result.stats.failedPages} failed). This can occur due to differences in how pages load during automated analysis versus in a browser. After reviewing your CSV file, you can retry each failed page individually using the 'Analyze This Page' button.`
          );
        } else {
          analyzer.showSuccess(
            `Domain analysis complete! Analyzed ${result.stats ? result.stats.successfulPages : ''} of ${result.stats ? result.stats.totalPages : ''} pages successfully.`
          );
        }
      }

      // Re-force visibility just in case showSuccess or something else interfered
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

  handleDomainAnalysisError: function (analyzer, errorMessage) {
    clearInterval(this.completionInterval);
    this.stopProgressPolling();
    analyzer.isDomainAnalyzing = false;

    // Clear cancellation flags and timeout
    if (this.cancellationTimeout) {
      clearTimeout(this.cancellationTimeout);
      this.cancellationTimeout = null;
    }
    this.cancellationRequested = false;

    document.getElementById('domainProgress').style.display = 'none';
    document.getElementById('analyzeBtn').style.display = 'block';
    document.getElementById('analyzeDomainBtn').style.display = 'block';
    document.getElementById('cancelDomainBtn').style.display = 'none';

    const cleanMessage = errorMessage.startsWith('Analysis error: ')
      ? errorMessage
      : errorMessage === 'Analysis cancelled by user'
        ? errorMessage
        : 'Analysis error: ' + errorMessage;

    analyzer.showError(cleanMessage);
    chrome.storage.local.remove(['domainAnalysisError']);
  },

  handleHangDetected: async function (analyzer) {
    console.warn('Hang detected - forcing UI cleanup and showing partial results');

    // Stop all polling intervals
    clearInterval(this.completionInterval);
    clearInterval(this.progressInterval);
    this.stopProgressPolling();
    analyzer.isDomainAnalyzing = false;

    // Hide progress bar and cancel button
    const progressEl = document.getElementById('domainProgress');
    const analyzeDomainBtn = document.getElementById('analyzeDomainBtn');
    const cancelBtn = document.getElementById('cancelDomainBtn');

    if (progressEl) progressEl.style.display = 'none';
    if (analyzeDomainBtn) analyzeDomainBtn.style.display = 'block';
    if (cancelBtn) cancelBtn.style.display = 'none';

    // Try to fetch any partial results from storage
    const storageData = await chrome.storage.local.get(['domainAnalysisResults']);
    const partialResults = storageData.domainAnalysisResults;

    if (partialResults && partialResults.data) {
      // We have partial results - save and display them
      analyzer.accumulatedResults = partialResults.data;
      await analyzer.saveAccumulatedResults();

      const resultsSection = document.getElementById('resultsSection');
      const pagesAnalyzedInfo = document.getElementById('pagesAnalyzedInfo');
      if (resultsSection) resultsSection.style.display = 'block';
      if (pagesAnalyzedInfo) pagesAnalyzedInfo.style.display = 'block';

      analyzer.displayResults();

      const pagesAnalyzed = partialResults.stats ? partialResults.stats.successfulPages : 0;
      if (pagesAnalyzed > 0) {
        analyzer.showSuccess(
          `Analysis cancelled. Showing results for ${pagesAnalyzed} page${pagesAnalyzed === 1 ? '' : 's'} analyzed before cancellation.`
        );
      } else {
        analyzer.showSuccess('Analysis cancelled before any pages completed.');
      }
    } else {
      // No results found
      analyzer.showSuccess('Analysis cancelled before any pages completed.');
    }

    // Clean up storage
    chrome.storage.local.remove([
      'domainAnalysisComplete',
      'domainAnalysisResults',
      'domainAnalysisProgress',
      'domainAnalysisError',
      'domainAnalysisMobileOnly',
      'domainAnalysisUseMobileViewport',
    ]);
  },

  cancelDomainAnalysis: function (analyzer) {
    // Set flag that cancellation was requested
    this.cancellationRequested = true;

    // Set a 5-second timeout as fallback - if background doesn't respond, force cleanup
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
    // We don't call handleDomainAnalysisError here anymore because we want the
    // background analyzer to finish merging what it has and trigger
    // handleDomainAnalysisComplete automatically.

    analyzer.showSuccess('Cancelling... generating report for pages analyzed so far.');
  },
};

// Make globally available
window.DomainAnalysisUI = DomainAnalysisUI;
