// background.js - Service Worker for Background Domain Analysis

importScripts('domain-analyzer.js');
importScripts('mobile-check-scripts.js');
importScripts('mobile-lighthouse-analyzer.js');
importScripts('mobile-results-converter.js');

let domainAnalyzer = null;

chrome.runtime.onInstalled.addListener(function (details) {
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

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log('Background received message:', request.action);

  if (request.action === 'trackUsage') {
    console.log('Usage tracked:', request.data);
    sendResponse({ success: true });
  }

  if (request.action === 'analyzeMobileViewport') {
    console.log('Running Zero-Intrusion mobile analysis for URL:', request.url || 'current');
    (async () => {
      let clonedTabId = null;

      // Helper to send progress to popup and save to storage for persistence
      const sendProgress = status => {
        chrome.storage.local.set({
          singlePageAnalysisStatus: 'in-progress',
          singlePageProgressText: status,
        });

        chrome.runtime
          .sendMessage({
            action: 'analysisProgress',
            status: status,
          })
          .catch(() => {
            // Ignore errors if popup is closed
          });
      };
      try {
        const mobileOnly = request.mobileOnly || false;
        let targetUrl = request.url;

        // If no URL provided, we get it from the active tab but CLONE it for analysis
        if (!targetUrl) {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs.length > 0) {
            targetUrl = tabs[0].url;
          }
        }

        if (!targetUrl) throw new Error('No URL available for analysis');

        // Step 1: Create a hidden background tab for analysis
        sendProgress('Creating background audit tab...');
        const clonedTab = await chrome.tabs.create({
          url: targetUrl,
          active: false,
        });
        clonedTabId = clonedTab.id;

        // Step 2: Wait for tab to load
        sendProgress('Loading target page...');
        await new Promise((resolve, reject) => {
          const listener = (tabId, info) => {
            if (tabId === clonedTabId && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
          // Safety timeout
          setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }, 15000);
        });

        if (mobileOnly) {
          // Mobile-only mode: Just run mobile checks
          sendProgress('Running mobile usability audit...');
          const lighthouseResults = await MobileLighthouseAnalyzer.analyzePage(
            clonedTabId,
            targetUrl
          );

          const pageUrl = lighthouseResults.url || targetUrl;
          const domain = new URL(pageUrl).hostname.replace('www.', '');
          const pathname = new URL(pageUrl).pathname;
          const mobileIssues = MobileResultsConverter.convertToMobileIssues(
            lighthouseResults,
            pageUrl
          );

          const mobileOnlyData = {
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
              'paragraph-4': { locations: [] },
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
              domain: domain,
              pathname: pathname,
              title: 'Mobile Analysis',
              timestamp: Date.now(),
            },
            squarespaceThemeStyles: {},
          };

          await chrome.storage.local.set({
            singlePageAnalysisStatus: 'complete',
            singlePageAnalysisResults: mobileOnlyData,
          });

          sendResponse({ success: true, data: mobileOnlyData });
        } else {
          // Full analysis mode: Desktop analysis FIRST, then mobile checks
          console.log('=== FULL BACKGROUND ANALYSIS MODE ===');

          // Inject script or send message?
          // Since it's a NEW tab, we might need to wait for content scripts or use chrome.scripting
          // Wait for content script to be ready with retries
          let designResponse = null;
          let scriptReady = false;
          let retries = 0;
          const maxRetries = 5;

          while (!scriptReady && retries < maxRetries) {
            try {
              console.log(
                `Checking if content script is ready (Attempt ${retries + 1}/${maxRetries})...`
              );
              const pingResponse = await chrome.tabs.sendMessage(clonedTabId, { action: 'ping' });
              if (pingResponse && pingResponse.success) {
                scriptReady = true;
                console.log('Content script is ready!');
              }
            } catch (e) {
              console.log('Content script not ready yet, waiting...');
              retries++;
              await new Promise(r => setTimeout(r, 1000));
            }
          }

          if (scriptReady) {
            sendProgress('Scanning page styles and accessibility...');
            try {
              designResponse = await chrome.tabs.sendMessage(clonedTabId, {
                action: 'analyzeStyles',
              });
            } catch (e) {
              console.error('Error sending analyzeStyles message:', e);
            }
          } else {
            console.log(
              'Content script did not respond to ping, attempting manual injection fallback...'
            );
            // Optional: Handle manual injection if needed, but ping retry is usually enough
          }

          if (designResponse && designResponse.success) {
            sendProgress('Analyzing mobile usability...');

            // Extract contrast pairs to screenshot during the mobile audit session
            const contrastPairs =
              designResponse.data.colorData && designResponse.data.colorData.contrastPairs
                ? designResponse.data.colorData.contrastPairs
                : [];

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

            sendResponse({ success: true, data: designResponse.data });
          } else {
            // If message failed, it might be because the content script isn't loaded yet
            throw new Error('Could not communicate with background clone. Try again.');
          }
        }
      } catch (error) {
        console.error('Background analysis error:', error);

        await chrome.storage.local.set({
          singlePageAnalysisStatus: 'error',
          singlePageAnalysisError: error.message,
        });

        sendResponse({ success: false, error: error.message });
      } finally {
        // Step 5: Clean up - important to close the tab!
        if (clonedTabId) {
          console.log('Cleaning up background clone:', clonedTabId);
          chrome.tabs.remove(clonedTabId).catch(() => {});
        }
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
          isPremium: request.isPremium || false,
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
      pendingProductId: request.productId,
    });
    startLicensePolling(request.sessionId, request.productId);
    sendResponse({ success: true });
  }

  if (request.action === 'getDomainAnalysisStatus') {
    sendResponse({
      isRunning: domainAnalyzer ? domainAnalyzer.isRunning() : false,
    });
  }

  if (request.action === 'inspectElement') {
    (async () => {
      try {
        const { url, selector } = request.data;
        const tab = await chrome.tabs.create({ url: url, active: true });

        // Wait for page to load
        const listener = async (tabId, info) => {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);

            // Inject highlighting script
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: sel => {
                const el = document.querySelector(sel);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

                  // Create a highlight overlay
                  const rect = el.getBoundingClientRect();
                  const highlight = document.createElement('div');
                  highlight.style.position = 'fixed';
                  highlight.style.top = rect.top + 'px';
                  highlight.style.left = rect.left + 'px';
                  highlight.style.width = rect.width + 'px';
                  highlight.style.height = rect.height + 'px';
                  highlight.style.border = '4px solid #f56565';
                  highlight.style.backgroundColor = 'rgba(245, 101, 101, 0.2)';
                  highlight.style.zIndex = '9999999';
                  highlight.style.pointerEvents = 'none';
                  highlight.style.borderRadius = '4px';
                  highlight.style.boxShadow = '0 0 20px rgba(245, 101, 101, 0.5)';

                  // Add pulsing animation
                  highlight.animate(
                    [
                      { opacity: 0.3, transform: 'scale(1)' },
                      { opacity: 1, transform: 'scale(1.05)' },
                      { opacity: 0.3, transform: 'scale(1)' },
                    ],
                    {
                      duration: 1000,
                      iterations: 5,
                    }
                  );

                  document.body.appendChild(highlight);

                  // Remove after 5 seconds
                  setTimeout(() => {
                    highlight.remove();
                  }, 5000);
                }
              },
              args: [selector],
            });
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.action === 'captureScreenshot') {
    (async () => {
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, {
          format: 'png',
          quality: 100,
        });
        sendResponse({ success: true, screenshot: dataUrl });
      } catch (error) {
        console.error('Screenshot capture failed:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async response
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
      percent: 0,
      currentUrl: 'Fetching sitemap...',
    },
  });

  try {
    console.log('Starting background domain analysis for:', domain);

    const result = await domainAnalyzer.analyzeDomain(domain, {
      maxPages: maxPages,
      timeout: timeout,
      delayBetweenPages: delayBetweenPages,
      isPremium: isPremium,
    });

    console.log('Background domain analysis complete:', result);

    await chrome.storage.local.set({
      domainAnalysisComplete: true,
      domainAnalysisResults: result,
    });

    console.log('Results saved to storage');
  } catch (error) {
    console.error('Background domain analysis error:', error);

    await chrome.storage.local.set({
      domainAnalysisComplete: true,
      domainAnalysisError: error.message,
    });
  } finally {
    domainAnalyzer = null;
  }
}
// License polling using setTimeout (alarms removed)
const API_BASE = 'https://squarespace-style-analyzer-pro.eamass.workers.dev';
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
    licensePollingStartTime: Date.now(),
  });

  // Start polling loop
  checkLicenseStatus();
}

async function checkLicenseStatus() {
  const data = await chrome.storage.local.get([
    'pendingSessionId',
    'pendingProductId',
    'licensePollingStartTime',
  ]);

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
    await chrome.storage.local.remove([
      'pendingSessionId',
      'pendingProductId',
      'licensePollingStartTime',
    ]);
    if (pollingTimeoutId) {
      clearTimeout(pollingTimeoutId);
      pollingTimeoutId = null;
    }
    return;
  }

  try {
    console.log('Background: Polling for license...', data.pendingSessionId);
    const resp = await fetch(`${API_BASE}/redeem-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: data.pendingSessionId,
        product_id: data.pendingProductId,
      }),
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
        lastLicenseCheck: Date.now(),
      });

      // Clean up
      await chrome.storage.local.remove([
        'pendingSessionId',
        'pendingProductId',
        'licensePollingStartTime',
      ]);
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
chrome.storage.local.get(['pendingSessionId', 'pendingProductId'], data => {
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
      percent: 0,
      currentUrl: 'Starting analysis...',
    },
  });

  try {
    console.log(
      'Starting URL-based domain analysis for:',
      domain,
      'with',
      urls.length,
      'URLs',
      'useMobileViewport:',
      useMobileViewport,
      'mobileOnly:',
      mobileOnly
    );

    const result = await domainAnalyzer.analyzeUrlList(urls, {
      timeout: timeout,
      delayBetweenPages: delayBetweenPages,
      isPremium: isPremium,
      useMobileViewport: useMobileViewport,
      mobileOnly: mobileOnly,
    });

    console.log('URL-based domain analysis complete:', result);

    await chrome.storage.local.set({
      domainAnalysisComplete: true,
      domainAnalysisResults: result,
    });

    console.log('Results saved to storage');
  } catch (error) {
    console.error('URL-based domain analysis error:', error);

    await chrome.storage.local.set({
      domainAnalysisComplete: true,
      domainAnalysisError: error.message,
    });
  } finally {
    domainAnalyzer = null;
  }
}
