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
      const data = await chrome.storage.local.get(['licenseEmail', 'isPremium', 'lastLicenseCheck']);
      
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
            lastLicenseCheck: now
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
            lastLicenseCheck: now
          });
          console.log('License expired or not found');
        }
      }
    } catch (error) {
      console.error('Background license verification failed:', error);
    }
  }

  async loadUserData() {
    const data = await chrome.storage.local.get(['usageCount', 'isPremium', 'userId', 'analyzedDomains']);
    this.usageCount = data.usageCount || 0;
    this.isPremium = data.isPremium || false;
    this.userId = data.userId || this.generateUserId();
    this.analyzedDomains = data.analyzedDomains || [];
    console.log('📊 Loaded user data - usageCount:', this.usageCount, 'analyzedDomains:', this.analyzedDomains);
    
    if (!data.userId) {
      await chrome.storage.local.set({ userId: this.userId });
    }
  }

  async loadAccumulatedResults() {
    this.accumulatedResults = await ResultsManager.loadAccumulatedResults();
  }
  
  async saveAccumulatedResults() {
    await ResultsManager.saveAccumulatedResults(this.accumulatedResults);
  }

  generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  async saveUserData() {
    console.log('💾 Saving user data - usageCount:', this.usageCount, 'analyzedDomains:', this.analyzedDomains);
    await chrome.storage.local.set({
      usageCount: this.usageCount,
      isPremium: this.isPremium,
      userId: this.userId,
      analyzedDomains: this.analyzedDomains
    });
    console.log('✅ User data saved successfully');
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
        actionButtonsContainer.parentNode.insertBefore(mobileSection, actionButtonsContainer.nextSibling);
      }
    }
  }

  bindEvents() {
    const self = this;
    document.getElementById('analyzeBtn').addEventListener('click', function() {
      self.analyzeSite();
    });
    
//    const upgradeBtn = document.getElementById('upgradeBtn');
//    if (upgradeBtn) {
//      upgradeBtn.addEventListener('click', function() {
//        self.handleUpgrade();
//      });
//    }
    
    document.getElementById('exportCsvBtn').addEventListener('click', function() {
      self.exportCSV();
    });
    
    document.getElementById('exportHtmlBtn').addEventListener('click', function() {
      self.exportHTMLReport();
    });
    
    document.getElementById('exportStyleGuideBtn').addEventListener('click', function() {
      self.exportStyleGuide();
    });
    
    document.getElementById('exportMobileReportBtn').addEventListener('click', function() {
      self.exportMobileReport();
    });
    
    document.getElementById('resetBtn').addEventListener('click', function() {
      self.resetAnalysis();
    });

    const checkStatusButton = document.getElementById('checkStatusButton');
    if (checkStatusButton) {
      checkStatusButton.addEventListener('click', function() {
        self.checkPremiumStatus();
      });
    }
  }

  bindDomainAnalysisEvents() {
    const self = this;
    
    document.getElementById('analyzeDomainBtn').addEventListener('click', function() {
      self.analyzeDomain();
    });
    
    document.getElementById('startWithoutMobileBtn').addEventListener('click', function() {
      self.startDomainAnalysisWithMobileChoice(false, false);
    });
    
    document.getElementById('startWithMobileBtn').addEventListener('click', function() {
      self.startDomainAnalysisWithMobileChoice(true, false);
    });
    
    document.getElementById('startOnlyMobileBtn').addEventListener('click', function() {
      self.startDomainAnalysisWithMobileChoice(true, true);
    });
    
    document.getElementById('cancelDomainBtn').addEventListener('click', function() {
      self.cancelDomainAnalysis();
    });
  }

  startProgressPolling() {
    const self = this;
    this.progressInterval = setInterval(async () => {
      const data = await chrome.storage.local.get(['domainAnalysisProgress']);
      if (data.domainAnalysisProgress) {
        self.updateDomainProgress(data.domainAnalysisProgress);
      }
    }, 500); // Poll every 500ms
  }

  stopProgressPolling() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

async analyzeDomain() {
    if (this.isDomainAnalyzing) {
      customAlert('Domain analysis already in progress');
      return;
    }

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const currentDomain = new URL(tab.url).hostname.replace('www.', '');
    this.currentDomain = currentDomain;
    this.isNewDomain = !this.analyzedDomains.includes(currentDomain);
    
    if (!this.isPremium && this.isNewDomain && this.usageCount >= 3) {
      this.showError('Please upgrade to analyze more websites. You have used your 3 free websites.');
      return;
    }

    // For premium users, fetch sitemap first and show page selection
    if (this.isPremium) {
      const analyzeDomainBtn = document.getElementById('analyzeDomainBtn');
      const successDiv = document.getElementById('success');
  
      if (analyzeDomainBtn && successDiv) {
        analyzeDomainBtn.parentNode.insertBefore(successDiv, analyzeDomainBtn.nextSibling);
      }
  
      this.showSuccess('Fetching sitemap and navigation...');
      
      try {
        const [sitemapUrls, navStructure] = await Promise.all([
          this.fetchSitemap(currentDomain),
          this.fetchNavigationStructure(currentDomain)
        ]);
        
        if (!sitemapUrls || sitemapUrls.length === 0) {
          this.showError('No sitemap found. Please use page-by-page analysis instead.');
          return;
        }
        
        console.log('✅ Fetched sitemap:', sitemapUrls.length, 'pages');
        console.log('✅ Fetched navigation:', navStructure);
        
        this.showPageSelectionModal(sitemapUrls.length, currentDomain, this.isNewDomain, sitemapUrls, navStructure);
        
      } catch (error) {
        this.showError('Could not fetch sitemap: ' + error.message);
      }
      
    } else {
      // Free users - show confirmation then 3-button choice
      if (!(await customConfirm(`Analyze entire domain: ${currentDomain}\n\nThis will automatically analyze up to 10 pages found in the sitemap.\n\nYou can close this popup and continue working - the analysis will run in the background.\n\nContinue?`))) {
        return;
      }
      
      // Hide analyze domain button, show 3-button choice
      document.getElementById('analyzeDomainBtn').style.display = 'none';
      document.getElementById('mobileAnalysisChoice').style.display = 'block';
      
      // Store totalPagesForAnalysis for time estimate
      this.totalPagesForAnalysis = 10;
      
      // Update time estimate on the "With Mobile" button
      const mobileTimeAddition = document.getElementById('mobileTimeAddition');
      if (mobileTimeAddition) {
        const mobileMinutes = Math.ceil((10 * 2) / 60);
        mobileTimeAddition.innerHTML = `<br>(+ ~${mobileMinutes} min)`;
      }
    }
  }
  
  async startDomainAnalysisWithMobileChoice(useMobileViewport, mobileOnly) {
    const currentDomain = this.currentDomain;
    const isNewDomain = this.isNewDomain;
    
    this.isDomainAnalyzing = true;
    this.hideMessages();
    
    // Hide the 3-button choice, show progress
    document.getElementById('mobileAnalysisChoice').style.display = 'none';
    document.getElementById('domainProgress').style.display = 'block';
    document.getElementById('analyzeBtn').style.display = 'none';
    document.getElementById('analyzeDomainBtn').style.display = 'none';
    document.getElementById('cancelDomainBtn').style.display = 'block';
    
    // Clear any previous results
    await chrome.storage.local.remove(['domainAnalysisComplete', 'domainAnalysisResults', 'domainAnalysisError', 'domainAnalysisProgress']);
    
    const maxPages = this.isPremium ? 500 : 10;
    
    chrome.runtime.sendMessage({
      action: 'startDomainAnalysis',
      data: {
        domain: currentDomain,
        maxPages: maxPages,
        delayBetweenPages: 2000,
        isPremium: this.isPremium,
        useMobileViewport: useMobileViewport,
        mobileOnly: mobileOnly
      }
    });
    
    this.startProgressPolling();
    this.checkForCompletion(currentDomain, isNewDomain, mobileOnly);
  }

  async fetchSitemap(domain) {
    return DomainAnalysisManager.fetchSitemap(domain);
  }

  async fetchNavigationStructure(domain) {
    return DomainAnalysisManager.fetchNavigationStructure(domain);
  }

  groupUrlsByNavigation(sitemapUrls, navStructure, domain) {
    return DomainAnalysisManager.groupUrlsByNavigation(sitemapUrls, navStructure, domain);
  }

  showPageSelectionModal(totalPages, domain, isNewDomain, sitemapUrls, navStructure) {
  this.currentDomain = domain;
  this.isNewDomain = isNewDomain;
  this.totalPagesInSitemap = totalPages;
  this.sitemapUrls = sitemapUrls;
  this.navStructure = navStructure;
  
  // Step 1: Try nav detection grouping
  var groupedUrls = this.groupUrlsByNavigation(sitemapUrls, navStructure, domain);
  var detectionMethod = 'nav';
  
  // Check detection quality
  var quality = DomainAnalysisManager.checkDetectionQuality(navStructure, groupedUrls, totalPages);
  
  if (quality.isPoor) {
    console.log('⚠️ Step 1 detection poor: ' + quality.reason);
    console.log('⏭️ Skipping Step 2 (rendered DOM), proceeding to Step 3 (path pattern grouping)...');
    
    // Step 3: Use path pattern grouping (skipping Step 2 for now - can add later)
    groupedUrls = DomainAnalysisManager.groupUrlsByPathPattern(sitemapUrls, domain);
    detectionMethod = 'pathPattern';
    
    // Re-check quality with path pattern grouping
    var pathQuality = DomainAnalysisManager.checkDetectionQuality(
      { sections: Object.keys(groupedUrls.sections).map(function(k) { return { name: k }; }) },
      groupedUrls,
      totalPages
    );
    console.log('📊 Path pattern quality: ' + (pathQuality.isPoor ? 'still poor' : 'acceptable'));
  }
  
  this.groupedUrls = groupedUrls;
  
  const self = this;
  
  PageSelectionUI.show(
    totalPages,
    domain,
    sitemapUrls,
    navStructure,
    groupedUrls,
    function() { /* onCancel - nothing needed */ },
    function(urlsToAnalyze, useMobileViewport, mobileOnly) {
      self.startDomainAnalysisWithUrls(domain, urlsToAnalyze, isNewDomain, useMobileViewport, mobileOnly);
    },
    detectionMethod,
    quality
  );
}

  handleNavigationSelection() {
  const items = document.querySelectorAll('.nav-section-item');
  const selectedUrls = [];
  
  items.forEach(item => {
    const checkbox = item.querySelector('input[type="checkbox"]');
    if (!checkbox || !checkbox.checked) return;
    
    const type = item.dataset.type;
    const index = item.dataset.index;
    
    if (type === 'child') {
      // Individual child - get URLs for this child's pathname
      const parentIndex = parseInt(item.dataset.parentIndex);
      const childPathname = item.dataset.childPathname;
      
      const keys = Object.keys(this.groupedUrls.sections);
      let sectionIndex = 0;
      for (const key of keys) {
        if (sectionIndex === parentIndex) {
          const section = this.groupedUrls.sections[key];
          if (section.childUrls && section.childUrls[childPathname]) {
            selectedUrls.push(...section.childUrls[childPathname].urls);
          }
          break;
        }
        sectionIndex++;
      }
    } else if (type === 'subgroup') {
      // Subgroup - get all child URLs for this section
      const parentIndex = parseInt(item.dataset.parentIndex);
      
      const keys = Object.keys(this.groupedUrls.sections);
      let sectionIndex = 0;
      for (const key of keys) {
        if (sectionIndex === parentIndex) {
          const section = this.groupedUrls.sections[key];
          // Get all URLs except the parent page itself
          let subgroupUrls = section.urls.filter(url => {
            try {
              const urlObj = new URL(url);
              return urlObj.pathname !== section.pathname;
            } catch (e) {
              return true;
            }
          });
          
          // Check for limit
          const enableLimit = item.querySelector('.enable-limit');
          const limitInput = item.querySelector('.section-limit');
          
          if (limitInput && enableLimit && enableLimit.checked) {
            const limit = parseInt(limitInput.value) || subgroupUrls.length;
            subgroupUrls = subgroupUrls.slice(0, limit);
          }
          
          selectedUrls.push(...subgroupUrls);
          break;
        }
        sectionIndex++;
      }
    } else if (type === 'section') {
      // Check if this is a parent with children or subgroup
      const hasChildren = item.dataset.hasChildren === 'true';
      const hasSubgroup = item.dataset.hasSubgroup === 'true';
      
      const keys = Object.keys(this.groupedUrls.sections);
      const idx = parseInt(index);
      
      if (idx < keys.length) {
        const section = this.groupedUrls.sections[keys[idx]];
        
        if (hasChildren) {
          // Parent with individual children - add only the parent page URL
          selectedUrls.push(section.navUrl);
        } else if (hasSubgroup) {
          // Parent with subgroup - add only the parent page URL
          selectedUrls.push(section.navUrl);
        } else {
          // Regular section - add all URLs
          let sectionUrls = section.urls;
          
          // Check for limit
          const enableLimit = item.querySelector('.enable-limit');
          const limitInput = item.querySelector('.section-limit');
          
          if (limitInput && enableLimit && enableLimit.checked) {
            const limit = parseInt(limitInput.value) || sectionUrls.length;
            sectionUrls = sectionUrls.slice(0, limit);
          }
          
          selectedUrls.push(...sectionUrls);
        }
      }
    } else if (type === 'otherNavLinks') {
      selectedUrls.push(...this.groupedUrls.otherNavLinks.urls);
    } else if (type === 'blog') {
      selectedUrls.push(...this.groupedUrls.blog.urls);
    } else if (type === 'other') {
      selectedUrls.push(...this.groupedUrls.other.urls);
    }
  });
  
  // Remove duplicates
  const uniqueUrls = [...new Set(selectedUrls)];
  const urlsToAnalyze = uniqueUrls;
  
  console.log('🎯 Selected URLs for analysis:', urlsToAnalyze.length);
  
  if (urlsToAnalyze.length === 0) {
    customAlert('Please select at least one section to analyze.');
    return;
  }
  
  // Hide modal and start analysis
  document.getElementById('pageSelectionModal').style.display = 'none';
  this.startDomainAnalysisWithUrls(this.currentDomain, urlsToAnalyze, this.isNewDomain);
}

  startDomainAnalysisWithUrls(currentDomain, urls, isNewDomain, useMobileViewport, mobileOnly) {
    this.isDomainAnalyzing = true;
    this.hideMessages();
    
    document.getElementById('domainProgress').style.display = 'block';
    document.getElementById('analyzeBtn').style.display = 'none';
    document.getElementById('analyzeDomainBtn').style.display = 'none';
    document.getElementById('cancelDomainBtn').style.display = 'block';

    // Clear any previous results
    chrome.storage.local.remove(['domainAnalysisComplete', 'domainAnalysisResults', 'domainAnalysisError']);

    // Start analysis in background with pre-selected URLs
    chrome.runtime.sendMessage({
      action: 'startDomainAnalysisWithUrls',
      data: {
        domain: currentDomain,
        urls: urls,
        delayBetweenPages: 2000,
        isPremium: this.isPremium,
        useMobileViewport: useMobileViewport,
        mobileOnly: mobileOnly
      }
    });

    // Start polling for progress AND completion
    this.startProgressPolling();
    this.checkForCompletion(currentDomain, isNewDomain, mobileOnly);
    
//    this.showSuccess(`Domain analysis started! Analyzing ${urls.length} selected pages. You can close this popup and the analysis will continue in the background.`);
  }

  async checkForCompletion(currentDomain, isNewDomain, mobileOnly = false) {
    const self = this;
    
    this.completionInterval = setInterval(async () => {
      const data = await chrome.storage.local.get(['domainAnalysisComplete', 'domainAnalysisResults', 'domainAnalysisError']);
      
      if (data.domainAnalysisComplete) {
        clearInterval(self.completionInterval);
        self.stopProgressPolling();
        
        if (data.domainAnalysisError) {
          self.handleDomainAnalysisError(data.domainAnalysisError);
        } else if (data.domainAnalysisResults) {
          await self.handleDomainAnalysisComplete(data.domainAnalysisResults, currentDomain, isNewDomain, mobileOnly);
        }
        
        // Clean up
        self.isDomainAnalyzing = false;
        await chrome.storage.local.remove(['domainAnalysisComplete', 'domainAnalysisResults', 'domainAnalysisError', 'domainAnalysisProgress']);
        
        // Reset UI and force display results
        document.getElementById('domainProgress').style.display = 'none';
        document.getElementById('analyzeBtn').style.display = 'block';
        document.getElementById('analyzeDomainBtn').style.display = 'block';
        document.getElementById('resultsSection').style.display = 'block';
        
        const cancelBtn = document.getElementById('cancelDomainBtn');
        cancelBtn.style.display = 'none';
        cancelBtn.disabled = false;
        cancelBtn.textContent = 'Cancel Analysis';
        
        // Force scroll to results
        document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
      }
    }, 1000);
  }

  async handleDomainAnalysisComplete(result, currentDomain, isNewDomain, mobileOnly = false) {
    console.log('handleDomainAnalysisComplete called', result);
    
    // Stop progress polling and hide progress UI
    this.stopProgressPolling();
    this.isDomainAnalyzing = false;
    
    // Force hide progress, show buttons
    const progressEl = document.getElementById('domainProgress');
    const analyzeDomainBtn = document.getElementById('analyzeDomainBtn');
    const cancelBtn = document.getElementById('cancelDomainBtn');
    const resultsSection = document.getElementById('resultsSection');
    
    if (progressEl) progressEl.style.display = 'none';
    if (analyzeDomainBtn) analyzeDomainBtn.style.display = 'block';
    if (cancelBtn) cancelBtn.style.display = 'none';
    
    if (result && result.success && result.data) {
      // ALWAYS save results first (even for mobileOnly), so cancelled analyses have data to export
      this.accumulatedResults = result.data;
      await this.saveAccumulatedResults();
      
      // For mobile-only analysis, just display results (NO auto-export)
      if (mobileOnly) {
        this.displayResults();
        
        if (!this.isPremium && isNewDomain) {
          this.analyzedDomains.push(currentDomain);
          this.usageCount = this.usageCount + 1;
          await this.saveUserData();
          this.updateUI();
        }
        
        const mobileIssues = result.data.mobileIssues?.issues || [];
        if (mobileIssues.length > 0) {
          this.showSuccess(`✅ Mobile analysis complete! Found ${mobileIssues.length} issue${mobileIssues.length === 1 ? '' : 's'}. Click the Mobile Report button to export.`);
        } else {
          this.showSuccess('✅ Mobile analysis complete! No issues found. Click the Mobile Report button to view the report.');
        }
        
        return;
      }
      
      // For non-mobileOnly analysis, continue normally
      this.displayResults();
      
      if (!this.isPremium && isNewDomain) {
        this.analyzedDomains.push(currentDomain);
        this.usageCount = this.usageCount + 1;
        await this.saveUserData();
        this.updateUI();
      }

      // Show appropriate message based on whether it was cancelled
      if (result.cancelled) {
        const pagesAnalyzed = result.stats.successfulPages;
        if (pagesAnalyzed > 0) {
          this.showSuccess(`Analysis cancelled. Successfully analyzed ${pagesAnalyzed} page${pagesAnalyzed === 1 ? '' : 's'} before cancellation. Results are available for export.`);
        } else {
          this.showSuccess('Analysis cancelled. No pages were completed before cancellation.');
        }
      } else {
        // Normal completion message with failure count if any pages failed
        if (result.stats.failedPages > 0) {
          this.showSuccess(`Analyzed ${result.stats.successfulPages} of ${result.stats.totalPages} pages successfully (${result.stats.failedPages} failed). This can occur due to differences in how pages load during automated analysis versus in a browser. After reviewing your CSV file, you can retry each failed page individually using the 'Analyze This Page' button.`);
        } else {
          this.showSuccess(`Domain analysis complete! Analyzed ${result.stats.successfulPages} of ${result.stats.totalPages} pages successfully.`);
        }
      }

      // Automatically export reports for any quality check errors
      this.autoExportReportsForQualityIssues();

      this.trackUsage('domain_analysis_completed');
    }
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

    // Note: CSV, Website Analysis Report, Page-by-Page Report, and Style Guides
    // are NOT auto-exported - user must click their respective buttons
  }

  handleDomainAnalysisError(errorMessage) {
    if (errorMessage.includes('No sitemap')) {
      this.showError('No sitemap found for this domain. Please use page-by-page analysis instead.');
    } else if (errorMessage.includes('cancelled')) {
      this.showSuccess('Domain analysis cancelled.');
    } else {
      this.showError('Domain analysis failed: ' + errorMessage);
    }
  }

  async checkOngoingDomainAnalysis() {
    // Check if domain analysis is currently running
    const data = await chrome.storage.local.get(['domainAnalysisProgress', 'domainAnalysisComplete']);
    
    // If we have progress data but no completion flag, analysis is still running
    if (data.domainAnalysisProgress && !data.domainAnalysisComplete) {
      this.isDomainAnalyzing = true;
      
      // Show progress UI
      document.getElementById('domainProgress').style.display = 'block';
      document.getElementById('analyzeBtn').style.display = 'none';
      document.getElementById('analyzeDomainBtn').style.display = 'none';
      document.getElementById('cancelDomainBtn').style.display = 'block';
      
      // Update progress bar with current progress
      this.updateDomainProgress(data.domainAnalysisProgress);
      
      // Start polling for updates
      this.startProgressPolling();
      
      // Get current domain to pass to completion handler
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        const currentDomain = new URL(tabs[0].url).hostname.replace('www.', '');
        const isNewDomain = !this.analyzedDomains.includes(currentDomain);
        this.checkForCompletion(currentDomain, isNewDomain);
      }
      
      this.showSuccess('Domain analysis in progress. You can close this popup - the analysis will continue in the background.');
    }
    
    // If analysis completed while popup was closed, show completion state
    if (data.domainAnalysisComplete) {
      const resultsData = await chrome.storage.local.get(['domainAnalysisResults', 'domainAnalysisError']);
      
      if (resultsData.domainAnalysisError) {
        this.handleDomainAnalysisError(resultsData.domainAnalysisError);
      } else if (resultsData.domainAnalysisResults) {
        // Get current domain
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          const currentDomain = new URL(tabs[0].url).hostname.replace('www.', '');
          const isNewDomain = !this.analyzedDomains.includes(currentDomain);
          await this.handleDomainAnalysisComplete(resultsData.domainAnalysisResults, currentDomain, isNewDomain);
        }
      }
      
      // Clean up
      await chrome.storage.local.remove(['domainAnalysisComplete', 'domainAnalysisResults', 'domainAnalysisError', 'domainAnalysisProgress']);
    }
  }

  cancelDomainAnalysis() {
    // Send cancel message to background
    chrome.runtime.sendMessage({ action: 'cancelDomainAnalysis' });
    
    // DON'T clear completion interval - we still need to check when cancellation finishes!
    // The background script will return partial results
    
    // Stop progress polling since we don't need live updates anymore
    this.stopProgressPolling();
    
    // Update UI to show we're cancelling
    this.showSuccess('Cancelling domain analysis... Please wait for current page to finish.');
    
    // Keep the cancel button visible but disable it
    const cancelBtn = document.getElementById('cancelDomainBtn');
    if (cancelBtn) {
      cancelBtn.disabled = true;
      cancelBtn.textContent = 'Cancelling...';
    }
  }

  updateDomainProgress(progress) {
    // Calculate percentage based on completed pages (current - 1), not the page being analyzed
    // Only show 100% when analysis is actually complete
    const completedPages = Math.max(0, progress.current - 1);
    const percent = progress.total > 0 ? Math.round((completedPages / progress.total) * 100) : 0;
    
    document.getElementById('domainProgressFill').style.width = percent + '%';
    document.getElementById('domainProgressFill').textContent = percent + '%';
    
    let progressText = `Page ${progress.current} of ${progress.total}`;
    
    // Show if we're analyzing a limited subset
    if (progress.totalInSitemap && progress.totalInSitemap > progress.total) {
      progressText += ` (${progress.totalInSitemap} total pages found, analyzing ${progress.total})`;
    }
    
    document.getElementById('domainProgressText').textContent = progressText;
    
    const url = progress.currentUrl || 'Preparing...';
    const maxLength = 50;
    const displayUrl = url.length > maxLength ? url.substring(0, maxLength) + '...' : url;
    document.getElementById('domainProgressUrl').textContent = displayUrl;
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
        func: function() {
          var indicators = [
            document.querySelector('meta[name="generator"][content*="Squarespace"]'),
            document.querySelector('script[src*="squarespace"]'),
            document.querySelector('link[href*="squarespace"]'),
            document.querySelector('[data-squarespace-module]'),
            document.body && document.body.classList && document.body.classList.contains('squarespace'),
            document.querySelector('.sqs-block'),
            document.querySelector('[class*="sqs-"]')
          ];
          var found = false;
          for (var i = 0; i < indicators.length; i++) {
            if (indicators[i]) {
              found = true;
              break;
            }
          }
          return found;
        }
      });
      return results[0] && results[0].result || false;
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
    // Clear the instance variables
    this.accumulatedResults = null;
    this.currentResults = null;
    
    // CRITICAL: Also clear domain analysis storage to prevent old results from reappearing
    await chrome.storage.local.remove([
      'domainAnalysisComplete', 
      'domainAnalysisResults', 
      'domainAnalysisError', 
      'domainAnalysisProgress'
    ]);
    
    // Show the analyze buttons again after reset
    const analyzeBtn = document.getElementById('analyzeBtn');
    const analyzeDomainBtn = document.getElementById('analyzeDomainBtn');
    if (analyzeBtn) analyzeBtn.style.display = 'block';
    if (analyzeDomainBtn) analyzeDomainBtn.style.display = 'block';
  }
}

  async checkPremiumStatus() {
    const email = await customPrompt("Enter your subscription email to check premium status:");
    if (!email) return;
    
    const trimmedEmail = email.trim().toLowerCase();
    
    // Show status message above the button
    const statusMsg = document.getElementById('premiumStatusMessage');
    if (statusMsg) {
      statusMsg.innerHTML = '<span class="spinner" style="width: 16px; height: 16px; border-width: 2px; margin-right: 8px; display: inline-block; vertical-align: middle;"></span>Checking premium status...';
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
            licenseData: data 
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
            licenseData: data 
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
      customAlert(`Error checking premium status:\n\n${error.message || 'Network error. Please check your connection and try again.'}`);
    }
  }

  async analyzeSite() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const currentDomain = new URL(tab.url).hostname;

    const isNewDomain = !this.analyzedDomains.includes(currentDomain);
    
    if (!this.isPremium && isNewDomain && this.usageCount >= 3) {
      this.showError('Please upgrade to analyze more websites. You have used your 3 free websites.');
      return;
    }

    this.showLoading(true);
    this.hideMessages();

    try {
      console.log('Starting page analysis...');

      if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        throw new Error('Cannot analyze Chrome internal pages. Please navigate to a regular website.');
      }

      // "Analyze This Page" always includes mobile analysis
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeMobileViewport',
        tabId: tab.id,
        viewportWidth: 375
      });  
      
      if (response && response.success) {
        this.currentResults = response.data;
        
        const merged = this.mergeResults(this.currentResults);
        
        // Only proceed if merge was successful (page wasn't already analyzed)
        if (merged) {
          this.displayResults();
          
          if (!this.isPremium && isNewDomain) {
            this.analyzedDomains.push(currentDomain);
            this.usageCount = this.usageCount + 1;
            await this.saveUserData();
            this.updateUI();
            this.showSuccess('Website analyzed! You have used ' + this.usageCount + ' of 3 free websites.');
          } else if (!this.isPremium) {
            this.showSuccess('Page analyzed!');
          } else {
            this.showSuccess('Page analyzed successfully! Navigate to another page to add more data, or export your results.');
          }
          
          this.trackUsage('analysis_completed');
        }
      } else {
        throw new Error(response ? response.error : 'No response from content script');
      }
      
    } catch (error) {
      console.error('Error:', error);
      
      if (error.message.includes('receiving end') || error.message.includes('Receiving end') || 
          error.message.includes('Could not establish connection')) {
        this.showError('Could not connect to the page. Please refresh the web page, and wait until it has completely loaded, and try again.');
      } else {
        this.showError('Analysis failed: ' + error.message);
      }
    } finally {
      this.showLoading(false);
    }
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
    if (!this.accumulatedResults) return false;

    // Check if all design data is empty (mobile-only analysis)
    const headingCount = Object.values(this.accumulatedResults.headings || {})
      .reduce((sum, h) => sum + (h.locations?.length || 0), 0);
    const paragraphCount = Object.values(this.accumulatedResults.paragraphs || {})
      .reduce((sum, p) => sum + (p.locations?.length || 0), 0);
    const buttonCount = Object.values(this.accumulatedResults.buttons || {})
      .reduce((sum, b) => sum + (b.locations?.length || 0), 0);

    return headingCount === 0 && paragraphCount === 0 && buttonCount === 0;
  }

  // Check if data contains mobile analysis results
  hasMobileData() {
    if (!this.accumulatedResults) return false;

    // Check if mobileIssues exists
    const mobileIssues = this.accumulatedResults.mobileIssues;
    if (!mobileIssues) return false;

    // Check if there are any mobile issues
    const issues = mobileIssues.issues || [];
    if (issues.length > 0) return true;

    // Check if viewport meta was actually analyzed (content will not be null if analyzed)
    // When mobile analysis is performed, viewport.content will be a string (even if empty "")
    // When no mobile analysis is performed, content remains null (default state)
    const viewportMeta = mobileIssues.viewportMeta;
    if (viewportMeta && viewportMeta.content !== null) {
      return true; // Mobile analysis was performed
    }

    // If viewport exists but was never analyzed, mobile analysis was still performed
    if (viewportMeta && (viewportMeta.exists === true || viewportMeta.isProper === true)) {
      return true;
    }

    return false; // No mobile analysis was performed
  }
    
    exportCSV() {
      if (this.isMobileOnlyData()) {
        customAlert('No data to export. This analysis only contains mobile usability data. Use the Mobile Report button instead.');
        return;
      }
      ExportCSV.export(this.accumulatedResults, this.FILENAME_BRAND, this.showSuccess.bind(this), this.showError.bind(this));
    }

  exportHTMLReport() {
    if (this.isMobileOnlyData()) {
      customAlert('No data to export. This analysis only contains mobile usability data. Use the Mobile Report button instead.');
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
      customAlert('No image issues found. The Images Report is only generated when there are missing alt text or generic image filename issues.');
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
    customAlert('No data to export. This analysis only contains mobile usability data. Use the Mobile Report button instead.');
    return;
  }
  ExportStyleGuide.export(this.accumulatedResults, this.FILENAME_BRAND, this.showSuccess.bind(this), this.downloadFile.bind(this));
}

  exportMobileReport() {
    if (!this.accumulatedResults) {
      customAlert('No data to export. Please analyze a page first.');
      return;
    }

    // Check if mobile analysis was performed
    if (!this.hasMobileData()) {
      customAlert('No mobile analysis data to export. This analysis was performed without mobile analysis. Please run an analysis with mobile analysis enabled.');
      return;
    }

    const mobileIssues = this.accumulatedResults.mobileIssues?.issues || [];
    const domain = this.accumulatedResults.metadata?.domain || 'website';

    ExportMobileReport.export(
      this.accumulatedResults,
      mobileIssues,
      domain,
      this.FILENAME_BRAND,
      (text) => text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),
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
      timestamp: Date.now()
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

window.enablePremiumTest = function() {
  chrome.storage.local.set({ isPremium: true, usageCount: 0 }, function() {
    console.log('Premium mode enabled for testing!');
    customAlert('Premium mode enabled! Close and reopen the popup.');
  });
};

window.disablePremiumTest = function() {
  chrome.storage.local.set({ isPremium: false, usageCount: 0 }, function() {
    console.log('Returned to free mode.');
    customAlert('Returned to free mode! Close and reopen the popup.');
  });
};

window.resetExtension = function() {
  chrome.storage.local.clear(function() {
    console.log('Extension data cleared!');
    customAlert('Extension reset! Close and reopen the popup.');
  });
};

document.addEventListener('DOMContentLoaded', function() {
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
