// background.js - Service Worker for Background Domain Analysis

importScripts('domain-analyzer.js');
importScripts('mobile-lighthouse-analyzer.js');
importScripts('mobile-results-converter.js');

let domainAnalyzer = null;

chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      usageCount: 0,
      isPremium: false,
      installDate: Date.now()
    });
    
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome.html')
    });
  }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background received message:', request.action);
  
  if (request.action === 'trackUsage') {
    console.log('Usage tracked:', request.data);
    sendResponse({ success: true });
  }
  
  if (request.action === 'analyzeMobileViewport') {
    console.log('Running Lighthouse-quality mobile analysis for tab:', request.tabId, 'mobileOnly:', request.mobileOnly);
    (async () => {
      try {
        const tabId = request.tabId;
        const mobileOnly = request.mobileOnly || false;

        if (mobileOnly) {
          // Mobile-only mode: Just run mobile checks
          console.log('Step 1: Running mobile-only checks...');
          const tab = await chrome.tabs.get(tabId);
          const lighthouseResults = await MobileLighthouseAnalyzer.analyzePage(tabId, tab.url);
          console.log('Lighthouse results:', lighthouseResults);
          // Mobile-only: Skip design analysis, only return mobile issues
          console.log('Mobile-only mode: Skipping design analysis');
          
          // Create complete structure with empty design fields (required for merge)
          const pageUrl = lighthouseResults.url || 'unknown';
          const domain = new URL(pageUrl).hostname.replace('www.', '');
          const pathname = new URL(pageUrl).pathname;
          const mobileIssues = MobileResultsConverter.convertToMobileIssues(lighthouseResults, pageUrl);
          
          const mobileOnlyData = {
            themeStyles: {},
            siteStyles: {},
            buttons: {
              primary: { locations: [] },
              secondary: { locations: [] },
              tertiary: { locations: [] },
              other: { locations: [] }
            },
            links: {
              'in-content': { locations: [] }
            },
            images: [],
            colorPalette: {
              backgrounds: [],
              text: [],
              borders: [],
              all: []
            },
            colorData: {
              colors: {},
              contrastPairs: []
            },
            headings: { 
              'heading-1': { locations: [] }, 
              'heading-2': { locations: [] }, 
              'heading-3': { locations: [] },
              'heading-4': { locations: [] }
            },
            paragraphs: { 
              'paragraph-1': { locations: [] }, 
              'paragraph-2': { locations: [] }, 
              'paragraph-3': { locations: [] }, 
              'paragraph-4': { locations: [] } 
            },
            qualityChecks: {
              missingH1: [],
              multipleH1: [],
              brokenHeadingHierarchy: [],
              fontSizeInconsistency: [],
              missingAltText: []
            },
            mobileIssues: {
              viewportMeta: MobileResultsConverter.convertViewportMeta(lighthouseResults.viewport),
              issues: mobileIssues
            },
            metadata: {
              url: pageUrl,
              domain: domain,
              pathname: pathname,
              title: 'Mobile Analysis',
              timestamp: Date.now()
            },
            squarespaceThemeStyles: {}
          };
          
          console.log('✅ Mobile-only analysis complete. Found', mobileIssues.length, 'issues');
          console.log('🔍 VERIFICATION: mobileOnly=true, returning data with:');
          console.log('  - headings:', Object.keys(mobileOnlyData.headings).length, 'types, total locations:', Object.values(mobileOnlyData.headings).reduce((sum, h) => sum + h.locations.length, 0));
          console.log('  - paragraphs:', Object.keys(mobileOnlyData.paragraphs).length, 'types, total locations:', Object.values(mobileOnlyData.paragraphs).reduce((sum, p) => sum + p.locations.length, 0));
          console.log('  - buttons:', Object.keys(mobileOnlyData.buttons).length, 'types, total locations:', Object.values(mobileOnlyData.buttons).reduce((sum, b) => sum + b.locations.length, 0));
          console.log('  - mobileIssues:', mobileOnlyData.mobileIssues.issues.length, 'issues');
          sendResponse({ success: true, data: mobileOnlyData });
        } else {
          // Full analysis mode: Desktop analysis FIRST, then mobile checks
          console.log('=== FULL ANALYSIS MODE ===');
          console.log('Step 1: Running design element analysis in DESKTOP viewport...');
          console.log('⏱️ Desktop analysis START:', new Date().toISOString());
          const designResponse = await chrome.tabs.sendMessage(tabId, { action: 'analyzeStyles' });
          console.log('⏱️ Desktop analysis COMPLETE:', new Date().toISOString());

          if (designResponse && designResponse.success) {
            // Log color data captured from desktop
            const colorCount = Object.keys(designResponse.data.colorData?.colors || {}).length;
            console.log('📊 Desktop analysis captured', colorCount, 'unique colors');

            // Step 2: NOW run mobile analysis (switches to mobile viewport)
            console.log('Step 2: Running Lighthouse mobile checks (switches to MOBILE viewport)...');
            console.log('⏱️ Mobile checks START:', new Date().toISOString());
            const tab = await chrome.tabs.get(tabId);
            const lighthouseResults = await MobileLighthouseAnalyzer.analyzePage(tabId, tab.url);
            console.log('⏱️ Mobile checks COMPLETE:', new Date().toISOString());
            console.log('Lighthouse results:', lighthouseResults);

            // Step 3: Convert Lighthouse results to extension format
            const pageUrl = designResponse.data.metadata.url;
            const mobileIssues = MobileResultsConverter.convertToMobileIssues(lighthouseResults, pageUrl);

            // Step 4: Merge with design analysis results
            designResponse.data.mobileIssues = {
              viewportMeta: MobileResultsConverter.convertViewportMeta(lighthouseResults.viewport),
              issues: mobileIssues
            };

            console.log('✅ Analysis complete. Mobile issues:', mobileIssues.length);
            console.log('🔍 VERIFICATION: mobileOnly=false, returning data with:');
            console.log('  - colors:', Object.keys(designResponse.data.colorData?.colors || {}).length, 'unique colors');
            console.log('  - headings:', Object.keys(designResponse.data.headings).length, 'types, total locations:', Object.values(designResponse.data.headings).reduce((sum, h) => sum + (h.locations?.length || 0), 0));
            console.log('  - paragraphs:', Object.keys(designResponse.data.paragraphs).length, 'types, total locations:', Object.values(designResponse.data.paragraphs).reduce((sum, p) => sum + (p.locations?.length || 0), 0));
            console.log('  - buttons:', Object.keys(designResponse.data.buttons).length, 'types, total locations:', Object.values(designResponse.data.buttons).reduce((sum, b) => sum + (b.locations?.length || 0), 0));
            console.log('  - mobileIssues:', designResponse.data.mobileIssues.issues.length, 'issues');
            sendResponse({ success: true, data: designResponse.data });
          } else {
            sendResponse({ success: false, error: 'Design analysis failed' });
          }
        }
        
      } catch (error) {
        console.error('Mobile analysis error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (request.action === 'analyzeDomain') {
    console.log('Analyzing domain...');
    (async () => {
      try {
        const domainAnalyzer = new DomainAnalyzer();
        const result = await domainAnalyzer.analyzeDomain(request.domain, {
          maxPages: request.maxPages || 10,
          delayBetweenPages: 2000,
          isPremium: request.isPremium || false
        });
        sendResponse({ success: true, data: result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (request.action === 'startDomainAnalysis') {
    console.log('Starting domain analysis in background...');
    startDomainAnalysisInBackground(request.data);
    sendResponse({ success: true });
  }
  
  if (request.action === 'startDomainAnalysisWithUrls') {
    console.log('Starting URL-based domain analysis in background...');
    startDomainAnalysisWithUrlsInBackground(request.data);
    sendResponse({ success: true });
  }
  
  if (request.action === 'cancelDomainAnalysis') {
    console.log('Cancelling domain analysis...');
    if (domainAnalyzer) {
      domainAnalyzer.cancelAnalysis();
    }
    sendResponse({ success: true });
  }
  
  if (request.action === 'startLicensePolling') {
    console.log('Starting license polling in background...');
    // Store pending session info in case extension reloads
    chrome.storage.local.set({
      pendingSessionId: request.sessionId,
      pendingProductId: request.productId
    });
    startLicensePolling(request.sessionId, request.productId);
    sendResponse({ success: true });
  }
  
  if (request.action === 'getDomainAnalysisStatus') {
    sendResponse({ 
      isRunning: domainAnalyzer ? domainAnalyzer.isRunning() : false 
    });
  }
  
  return true;
});

async function startDomainAnalysisInBackground(data) {
  const domain = data.domain;
  const maxPages = data.maxPages;
  const timeout = data.timeout;
  const delayBetweenPages = data.delayBetweenPages;
  const isPremium = data.isPremium;
  
  domainAnalyzer = new DomainAnalyzer();
  
  // Initialize progress immediately so popup shows something
  await chrome.storage.local.set({
    domainAnalysisProgress: {
      current: 0,
      total: 0,
      currentUrl: 'Fetching sitemap...'
    }
  });  
  
  try {
    console.log('Starting background domain analysis for:', domain);
    
    const result = await domainAnalyzer.analyzeDomain(domain, {
      maxPages: maxPages,
      timeout: timeout,
      delayBetweenPages: delayBetweenPages,
      isPremium: isPremium
    });
    
    console.log('Background domain analysis complete:', result);
    
    await chrome.storage.local.set({
      domainAnalysisComplete: true,
      domainAnalysisResults: result
    });
    
    console.log('Results saved to storage');
    
  } catch (error) {
    console.error('Background domain analysis error:', error);
    
    await chrome.storage.local.set({
      domainAnalysisComplete: true,
      domainAnalysisError: error.message
    });
  } finally {
    domainAnalyzer = null;
  }
}
// License polling using setTimeout (alarms removed)
const API_BASE = "https://squarespace-style-analyzer-pro.eamass.workers.dev";
let pollingTimeoutId = null;

async function startLicensePolling(sessionId, productId) {
  console.log('Background: Starting license polling for session:', sessionId);
  
  // Clear any existing polling
  if (pollingTimeoutId) {
    clearTimeout(pollingTimeoutId);
    pollingTimeoutId = null;
  }
  
  // Store session info and start time
  await chrome.storage.local.set({
    pendingSessionId: sessionId,
    pendingProductId: productId,
    licensePollingStartTime: Date.now()
  });
  
  // Start polling loop
  checkLicenseStatus();
}

async function checkLicenseStatus() {
  const data = await chrome.storage.local.get(['pendingSessionId', 'pendingProductId', 'licensePollingStartTime']);
  
  if (!data.pendingSessionId || !data.pendingProductId) {
    console.log('Background: No pending session, stopping polling');
    if (pollingTimeoutId) {
      clearTimeout(pollingTimeoutId);
      pollingTimeoutId = null;
    }
    return;
  }
  
  // Check timeout (5 minutes)
  const elapsed = Date.now() - (data.licensePollingStartTime || 0);
  if (elapsed > 300000) {
    console.log('Background: License polling timed out');
    await chrome.storage.local.remove(['pendingSessionId', 'pendingProductId', 'licensePollingStartTime']);
    if (pollingTimeoutId) {
      clearTimeout(pollingTimeoutId);
      pollingTimeoutId = null;
    }
    return;
  }
  
  try {
    console.log('Background: Polling for license...', data.pendingSessionId);
    const resp = await fetch(`${API_BASE}/redeem-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        session_id: data.pendingSessionId,
        product_id: data.pendingProductId
      })
    });
    const result = await resp.json();
    console.log('Background: Poll result:', result);
    
    if (result && result.ok && result.email) {
      console.log('Background: License activated for:', result.email);
      
      // Store premium status
      await chrome.storage.local.set({ 
        isPremium: true, 
        licenseEmail: result.email, 
        licenseData: result,
        lastLicenseCheck: Date.now()
      });
      
      // Clean up
      await chrome.storage.local.remove(['pendingSessionId', 'pendingProductId', 'licensePollingStartTime']);
      if (pollingTimeoutId) {
        clearTimeout(pollingTimeoutId);
        pollingTimeoutId = null;
      }
      
      console.log('Background: Premium status saved!');
      return; // Stop polling
    }
  } catch (e) {
    console.warn('Background: Poll error', e);
  }
  
  // Schedule next poll in 5 seconds
  pollingTimeoutId = setTimeout(() => {
    checkLicenseStatus();
  }, 5000);
}

// Resume polling on startup if there's a pending session
chrome.storage.local.get(['pendingSessionId', 'pendingProductId'], (data) => {
  if (data.pendingSessionId && data.pendingProductId) {
    console.log('Background: Found pending session on startup, resuming polling');
    checkLicenseStatus();
  }
});
async function startDomainAnalysisWithUrlsInBackground(data) {
  const domain = data.domain;
  const urls = data.urls;
  const timeout = data.timeout;
  const delayBetweenPages = data.delayBetweenPages;
  const isPremium = data.isPremium;
  const useMobileViewport = data.useMobileViewport || false;
  const mobileOnly = data.mobileOnly || false;
  
  domainAnalyzer = new DomainAnalyzer();
  
  // Initialize progress immediately so popup shows something
  await chrome.storage.local.set({
    domainAnalysisProgress: {
      current: 0,
      total: urls.length,
      currentUrl: 'Starting analysis...'
    }
  });  
  
  try {
    console.log('Starting URL-based domain analysis for:', domain, 'with', urls.length, 'URLs', 'useMobileViewport:', useMobileViewport, 'mobileOnly:', mobileOnly);
    
    const result = await domainAnalyzer.analyzeUrlList(urls, {
      timeout: timeout,
      delayBetweenPages: delayBetweenPages,
      isPremium: isPremium,
      useMobileViewport: useMobileViewport,
      mobileOnly: mobileOnly
    });
    
    console.log('URL-based domain analysis complete:', result);
    
    await chrome.storage.local.set({
      domainAnalysisComplete: true,
      domainAnalysisResults: result
    });
    
    console.log('Results saved to storage');
    
  } catch (error) {
    console.error('URL-based domain analysis error:', error);
    
    await chrome.storage.local.set({
      domainAnalysisComplete: true,
      domainAnalysisError: error.message
    });
  } finally {
    domainAnalyzer = null;
  }
}