import { defineBackground } from 'wxt/sandbox';
import { DomainAnalyzer } from '../src/analyzers/domain';
import { MobileLighthouseAnalyzer } from '../src/analyzers/mobileLighthouse';
import { MobileResultsConverter } from '../src/analyzers/mobileConverter';

export default defineBackground(() => {
  console.log('Squarespace Style Analyzer background service worker loaded');

  // State
  let domainAnalyzer: DomainAnalyzer | null = null;
  let lastScreenshotTime = 0;
  const SCREENSHOT_MIN_INTERVAL = 750; // ms

  // License Polling
  const API_BASE = 'https://squarespace-style-analyzer-pro.eamass.workers.dev';
  let pollingTimeoutId: any = null;

  // Installation Handler
  chrome.runtime.onInstalled.addListener(details => {
    if (details.reason === 'install') {
      chrome.storage.local.set({
        usageCount: 0,
        isPremium: false,
        installDate: Date.now(),
      });
      chrome.tabs.create({
        url: chrome.runtime.getURL('welcome.html'),
      });
    }
  });

  // Resume polling on startup
  chrome.storage.local.get(['pendingSessionId', 'pendingProductId'], data => {
    if (chrome.runtime.lastError) return;
    if (data && data.pendingSessionId && data.pendingProductId) {
      console.log('Background: Found pending session on startup, resuming polling');
      checkLicenseStatus();
    }
  });

  // Message Handler
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request.action);

    if (request.action === 'trackUsage') {
      console.log('Usage tracked:', request.data);
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'analyzeMobileViewport') {
      handleMobileAnalysis(request).then(sendResponse);
      return true; // Keep channel open
    }

    if (request.action === 'analyzeDomain') {
      (async () => {
        try {
          // One-off synchronous-like analysis??
          // Legacy code had this, but usually we use startDomainAnalysis
          domainAnalyzer = new DomainAnalyzer();
          const result = await domainAnalyzer.analyzeDomain(request.domain, {
            maxPages: request.maxPages || 10,
            delayBetweenPages: 2000,
            isPremium: request.isPremium || false,
          });
          sendResponse({ success: true, data: result });
        } catch (error: any) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
    }

    if (request.action === 'startDomainAnalysis') {
      startDomainAnalysisInBackground(request.data);
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'startDomainAnalysisWithUrls') {
      startDomainAnalysisWithUrlsInBackground(request.data);
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'cancelDomainAnalysis') {
      if (domainAnalyzer) {
        domainAnalyzer.cancelAnalysis();
      }
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'startLicensePolling') {
      chrome.storage.local.set({
        pendingSessionId: request.sessionId,
        pendingProductId: request.productId,
      });
      startLicensePolling(request.sessionId, request.productId);
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'getDomainAnalysisStatus') {
      sendResponse({
        isRunning: domainAnalyzer ? domainAnalyzer.isRunning() : false,
      });
      return true;
    }

    if (request.action === 'inspectElement') {
      handleInspectElement(request.data).then(sendResponse);
      return true;
    }

    if (request.action === 'captureScreenshot') {
      handleScreenshotCapture(sender).then(sendResponse);
      return true;
    }
  });

  // --- Handlers ---

  async function handleMobileAnalysis(request: any) {
    console.log('Running Zero-Intrusion mobile analysis for URL:', request.url || 'current');

    let clonedTabId: number | null = null;
    let targetUrl = request.url;

    const sendProgress = (status: string) => {
      chrome.storage.local.set({
        singlePageAnalysisStatus: 'in-progress',
        singlePageProgressText: status,
      });
      chrome.runtime.sendMessage({ action: 'analysisProgress', status }).catch(() => {});
    };

    try {
      const mobileOnly = request.mobileOnly || false;

      if (!targetUrl) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.url) targetUrl = tabs[0].url;
      }

      if (!targetUrl) throw new Error('No URL available for analysis');

      sendProgress('Creating background audit tab...');
      const clonedTab = await chrome.tabs.create({ url: targetUrl, active: false });
      clonedTabId = clonedTab.id!;

      sendProgress('Loading target page...');
      // Wait for load
      await new Promise<void>(resolve => {
        const listener = (tabId: number, info: any) => {
          if (tabId === clonedTabId && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }, 15000);
      });

      if (mobileOnly) {
        sendProgress('Running mobile usability audit...');
        const lighthouseResults = await MobileLighthouseAnalyzer.analyzePage(
          clonedTabId,
          targetUrl
        );

        const pageUrl = lighthouseResults.url || targetUrl;
        const mobileIssues = MobileResultsConverter.convertToMobileIssues(
          lighthouseResults,
          pageUrl
        );

        // Construct simplified result
        // TODO: Populate with full empty structure if needed, but for now partial is ok
        const mobileOnlyData: any = {
          themeStyles: {},
          siteStyles: {},
          buttons: {
            primary: { locations: [] },
            secondary: { locations: [] },
            tertiary: { locations: [] },
            other: { locations: [] },
          },
          links: { 'in-content': { locations: [] } },
          images: [],
          colorPalette: { backgrounds: [], text: [], borders: [], all: [] },
          colorData: { colors: {}, contrastPairs: [] },
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
          },
          qualityChecks: {
            missingH1: [],
            multipleH1: [],
            brokenHeadingHierarchy: [],
            fontSizeInconsistency: [],
            missingAltText: [],
          },
          mobileIssues: {
            viewportMeta: MobileResultsConverter.convertViewportMeta(lighthouseResults.viewport),
            issues: mobileIssues,
          },
          metadata: {
            url: pageUrl,
            domain: new URL(pageUrl).hostname.replace('www.', ''),
            pathname: new URL(pageUrl).pathname,
            title: 'Mobile Analysis',
            timestamp: Date.now(),
          },
          squarespaceThemeStyles: {},
        };

        await chrome.storage.local.set({
          singlePageAnalysisStatus: 'complete',
          singlePageAnalysisResults: mobileOnlyData,
        });

        return { success: true, data: mobileOnlyData };
      } else {
        // Full Analysis
        console.log('=== FULL BACKGROUND ANALYSIS MODE ===');
        let designResponse: any = null;
        let retries = 0;
        const maxRetries = 5;

        // Content script should be auto-injected by manifest logic or defineContentScript
        // We wait for it to be ready
        while (retries < maxRetries) {
          try {
            const ping = await chrome.tabs.sendMessage(clonedTabId, { action: 'ping' });
            if (ping?.success) break;
          } catch (e) {
            retries++;
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        if (retries >= maxRetries) {
          console.warn('Content script did not respond, attempting manual fallback or failing');
        }

        sendProgress('Scanning page styles and accessibility...');
        designResponse = await chrome.tabs.sendMessage(clonedTabId, { action: 'analyzeStyles' });

        if (designResponse && designResponse.success) {
          sendProgress('Analyzing mobile usability...');
          const contrastPairs = designResponse.data.colorData?.contrastPairs || [];

          const lighthouseResults = await MobileLighthouseAnalyzer.analyzePage(
            clonedTabId,
            targetUrl,
            contrastPairs
          );

          const mobileIssues = MobileResultsConverter.convertToMobileIssues(
            lighthouseResults,
            targetUrl
          );

          designResponse.data.mobileIssues = {
            viewportMeta: MobileResultsConverter.convertViewportMeta(lighthouseResults.viewport),
            issues: mobileIssues,
          };

          await chrome.storage.local.set({
            singlePageAnalysisStatus: 'complete',
            singlePageAnalysisResults: designResponse.data,
          });

          return { success: true, data: designResponse.data };
        } else {
          throw new Error('Analysis failed or content script error');
        }
      }
    } catch (error: any) {
      console.error('Background analysis error:', error);
      await chrome.storage.local.set({
        singlePageAnalysisStatus: 'error',
        singlePageAnalysisError: error.message,
      });
      return { success: false, error: error.message };
    } finally {
      if (clonedTabId) chrome.tabs.remove(clonedTabId).catch(() => {});
    }
  }

  async function handleInspectElement(data: any) {
    try {
      const { url, selector } = data;
      const tab = await chrome.tabs.create({ url, active: true });
      // Add param to URL to trigger auto-inspect?
      // Actually the original implementation created a tab THEN injected script.
      // But we have LiveInspector in content script now checking URL params.
      // The original injected script manually.
      // Let's rely on URL params if possible, BUT the original code injected.

      // We will duplicate the injection logic using scripting API for robustness
      const listener = async (tabId: number, info: any) => {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);

          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: sel => {
              // ... minimal highlight logic as backup or trigger ...
              // But our content script listens for 'ssa-inspect-selector' param.
              // We should probably redirect to URL with param?
              // The original code DID NOT redirect, it injected.
              // Let's stick to injection for immediate feedback.
              const el = document.querySelector(sel);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Rely on content script LiveInspector if loaded, or manual inject.
              // We'll trust our content script is loaded.
            },
            args: [selector],
          });
        }
      };
      chrome.tabs.onUpdated.addListener(listener);

      // Also try to update the URL to include the param so our new LiveInspector picks it up?
      // Or just assume `analyzeStyles` injection works.

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async function handleScreenshotCapture(sender: chrome.runtime.MessageSender) {
    try {
      let windowId = sender?.tab?.windowId;
      if (!windowId) {
        // Fallback to current window
        const win = await chrome.windows.getCurrent();
        windowId = win.id;
      }

      const now = Date.now();
      let waitTime = 0;
      if (now - lastScreenshotTime < SCREENSHOT_MIN_INTERVAL) {
        lastScreenshotTime += SCREENSHOT_MIN_INTERVAL;
        waitTime = lastScreenshotTime - now;
      } else {
        lastScreenshotTime = now;
      }

      if (waitTime > 0) await new Promise(r => setTimeout(r, waitTime));

      const dataUrl = await chrome.tabs.captureVisibleTab(windowId!, {
        format: 'png',
        quality: 100,
      });
      return { success: true, screenshot: dataUrl };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async function startDomainAnalysisInBackground(data: any) {
    domainAnalyzer = new DomainAnalyzer();

    await chrome.storage.local.set({
      domainAnalysisProgress: {
        current: 0,
        total: 0,
        percent: 0,
        currentUrl: 'Fetching sitemap...',
      },
    });

    try {
      const result = await domainAnalyzer.analyzeDomain(data.domain, {
        maxPages: data.maxPages,
        timeout: data.timeout,
        delayBetweenPages: data.delayBetweenPages,
        isPremium: data.isPremium,
      });

      await chrome.storage.local.set({
        domainAnalysisComplete: true,
        domainAnalysisResults: result,
      });
    } catch (error: any) {
      await chrome.storage.local.set({
        domainAnalysisComplete: true,
        domainAnalysisError: error.message,
      });
    } finally {
      domainAnalyzer = null;
    }
  }

  async function startDomainAnalysisWithUrlsInBackground(data: any) {
    domainAnalyzer = new DomainAnalyzer();

    await chrome.storage.local.set({
      domainAnalysisProgress: {
        current: 0,
        total: data.urls.length,
        percent: 0,
        currentUrl: 'Starting analysis...',
      },
    });

    try {
      const result = await domainAnalyzer.analyzeUrlList(data.urls, {
        timeout: data.timeout,
        delayBetweenPages: data.delayBetweenPages,
        isPremium: data.isPremium,
        // ... mobile options need to be passed down if Analyzer supports them
      });

      await chrome.storage.local.set({
        domainAnalysisComplete: true,
        domainAnalysisResults: result,
      });
    } catch (error: any) {
      await chrome.storage.local.set({
        domainAnalysisComplete: true,
        domainAnalysisError: error.message,
      });
    } finally {
      domainAnalyzer = null;
    }
  }

  function startLicensePolling(sessionId: string, productId: string) {
    if (pollingTimeoutId) clearTimeout(pollingTimeoutId);

    chrome.storage.local.set({
      pendingSessionId: sessionId,
      pendingProductId: productId,
      licensePollingStartTime: Date.now(),
    });

    checkLicenseStatus();
  }

  async function checkLicenseStatus() {
    const data = await chrome.storage.local.get([
      'pendingSessionId',
      'pendingProductId',
      'licensePollingStartTime',
    ]);

    if (!data.pendingSessionId || !data.pendingProductId) return;

    if (Date.now() - (data.licensePollingStartTime || 0) > 300000) {
      await chrome.storage.local.remove([
        'pendingSessionId',
        'pendingProductId',
        'licensePollingStartTime',
      ]);
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/redeem-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: data.pendingSessionId,
          product_id: data.pendingProductId,
        }),
      });
      const result = await resp.json();

      if (result && result.ok && result.email) {
        await chrome.storage.local.set({
          isPremium: true,
          licenseEmail: result.email,
          licenseData: result,
          lastLicenseCheck: Date.now(),
        });
        await chrome.storage.local.remove([
          'pendingSessionId',
          'pendingProductId',
          'licensePollingStartTime',
        ]);
        return;
      }
    } catch (e) {
      console.warn('Poll error', e);
    }

    pollingTimeoutId = setTimeout(checkLicenseStatus, 5000);
  }
});
