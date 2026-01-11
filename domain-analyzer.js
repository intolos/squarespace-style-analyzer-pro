// domain-analyzer.js
function DomainAnalyzer() {
  this.isAnalyzing = false;
  this.shouldCancel = false;
  this.currentProgress = { current: 0, total: 0, currentUrl: '' };
  this.failedPages = [];
}

DomainAnalyzer.prototype.waitForContentScript = async function (tabId, maxRetries = 5) {
  let scriptReady = false;
  let retries = 0;

  while (!scriptReady && retries < maxRetries) {
    try {
      const pingResponse = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (pingResponse && pingResponse.success) {
        scriptReady = true;
      }
    } catch (e) {
      retries++;
      if (retries < maxRetries) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  return scriptReady;
};

DomainAnalyzer.prototype.analyzeDomain = async function (domain, options) {
  options = options || {};

  if (this.isAnalyzing) {
    throw new Error('Analysis already in progress');
  }

  this.isAnalyzing = true;
  this.shouldCancel = false;
  this.failedPages = [];

  var settings = {
    maxPages: options.maxPages || 100,
    delayBetweenPages: options.delayBetweenPages || 2000,
    isPremium: options.isPremium || false,
  };

  var settings = {
    maxPages: options.maxPages || 100,
    delayBetweenPages: options.delayBetweenPages || 2000,
    isPremium: options.isPremium || false,
  };

  // Store options for use in analyzePageInBackground
  this.options = {
    useMobileViewport: options.useMobileViewport || false,
    mobileOnly: options.mobileOnly || false,
  };

  try {
    var sitemapUrls = await this.findSitemap(domain);

    if (!sitemapUrls || sitemapUrls.length === 0) {
      throw new Error('No sitemap found. Please use page-by-page analysis instead.');
    }

    var urlsToAnalyze = sitemapUrls;
    var totalPagesInSitemap = sitemapUrls.length;

    if (!settings.isPremium && sitemapUrls.length > 10) {
      urlsToAnalyze = sitemapUrls.slice(0, 10);
    } else if (sitemapUrls.length > settings.maxPages) {
      urlsToAnalyze = sitemapUrls.slice(0, settings.maxPages);
    }

    this.currentProgress.total = urlsToAnalyze.length;
    this.currentProgress.totalInSitemap = totalPagesInSitemap;

    var results = [];
    for (var i = 0; i < urlsToAnalyze.length; i++) {
      if (this.shouldCancel) {
        console.log('Analysis cancelled by user. Returning partial results...');
        var mergedResults = this.mergeAllResults(results);
        if (mergedResults) {
          mergedResults.failedPages = this.failedPages;
          mergedResults.cancelled = true;
        }

        return {
          success: true,
          cancelled: true,
          data: mergedResults,
          stats: {
            totalPages: urlsToAnalyze.length,
            successfulPages: results.length,
            failedPages: this.failedPages.length,
            failedPagesList: this.failedPages,
            cancelledAt: i,
          },
        };
      }

      var url = urlsToAnalyze[i];
      this.currentProgress.current = i + 1;
      this.currentProgress.currentUrl = url;

      this.notifyProgress();

      try {
        var pageResult = await this.analyzePageInBackground(url, settings.timeout);
        if (pageResult) {
          results.push(pageResult);
        }
      } catch (error) {
        console.error('Failed to analyze ' + url + ':', error.message);
        this.failedPages.push({
          url: url,
          reason: error.message,
          timeout: settings.timeout,
          timestamp: new Date().toISOString(),
        });
      }

      if (i < urlsToAnalyze.length - 1) {
        await this.delay(settings.delayBetweenPages);
      }
    }

    var mergedResults = this.mergeAllResults(results);

    if (mergedResults) {
      mergedResults.failedPages = this.failedPages;
    }

    return {
      success: true,
      data: mergedResults,
      stats: {
        totalPages: urlsToAnalyze.length,
        successfulPages: results.length,
        failedPages: this.failedPages.length,
        failedPagesList: this.failedPages,
      },
    };
  } catch (error) {
    throw error;
  } finally {
    this.isAnalyzing = false;
    this.shouldCancel = false;
  }
};

DomainAnalyzer.prototype.analyzeUrlList = async function (urls, options) {
  options = options || {};

  if (this.isAnalyzing) {
    throw new Error('Analysis already in progress');
  }

  this.isAnalyzing = true;
  this.shouldCancel = false;
  this.failedPages = [];

  var settings = {
    delayBetweenPages: options.delayBetweenPages || 2000,
    isPremium: options.isPremium || false,
  };

  var settings = {
    delayBetweenPages: options.delayBetweenPages || 2000,
    isPremium: options.isPremium || false,
  };

  // Store options for use in analyzePageInBackground
  this.options = {
    useMobileViewport: options.useMobileViewport || false,
    mobileOnly: options.mobileOnly || false,
  };

  try {
    this.currentProgress.total = urls.length;

    var results = [];
    for (var i = 0; i < urls.length; i++) {
      if (this.shouldCancel) {
        console.log('Analysis cancelled by user. Returning partial results...');
        var mergedResults = this.mergeAllResults(results);
        if (mergedResults) {
          mergedResults.failedPages = this.failedPages;
          mergedResults.cancelled = true;
        }

        return {
          success: true,
          cancelled: true,
          data: mergedResults,
          stats: {
            totalPages: urls.length,
            successfulPages: results.length,
            failedPages: this.failedPages.length,
            failedPagesList: this.failedPages,
            cancelledAt: i,
          },
        };
      }

      var url = urls[i];
      this.currentProgress.current = i + 1;
      this.currentProgress.currentUrl = url;

      this.notifyProgress();

      try {
        var pageResult = await this.analyzePageInBackground(url, settings.timeout);
        if (pageResult) {
          results.push(pageResult);
        }
      } catch (error) {
        console.error('Failed to analyze ' + url + ':', error.message);
        this.failedPages.push({
          url: url,
          reason: error.message,
          timeout: settings.timeout,
          timestamp: new Date().toISOString(),
        });
      }

      if (i < urls.length - 1) {
        await this.delay(settings.delayBetweenPages);
      }
    }

    var mergedResults = this.mergeAllResults(results);

    if (mergedResults) {
      mergedResults.failedPages = this.failedPages;
    }

    return {
      success: true,
      data: mergedResults,
      stats: {
        totalPages: urls.length,
        successfulPages: results.length,
        failedPages: this.failedPages.length,
        failedPagesList: this.failedPages,
      },
    };
  } catch (error) {
    throw error;
  } finally {
    this.isAnalyzing = false;
    this.shouldCancel = false;
  }
};

DomainAnalyzer.prototype.findSitemap = async function (domain) {
  var sitemapUrls = [
    'https://' + domain + '/sitemap.xml',
    'https://' + domain + '/sitemap_index.xml',
    'https://' + domain + '/sitemap-index.xml',
    'https://www.' + domain + '/sitemap.xml',
    'https://www.' + domain + '/sitemap_index.xml',
  ];

  for (var i = 0; i < sitemapUrls.length; i++) {
    try {
      var urls = await this.fetchAndParseSitemap(sitemapUrls[i]);
      if (urls && urls.length > 0) {
        return urls;
      }
    } catch (error) {
      // Try next sitemap URL
    }
  }

  return null;
};

DomainAnalyzer.prototype.fetchAndParseSitemap = async function (sitemapUrl) {
  try {
    var response = await fetch(sitemapUrl);
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    var text = await response.text();

    var urlMatches = text.matchAll(/<loc>(.*?)<\/loc>/g);
    var urls = Array.from(urlMatches).map(function (match) {
      return match[1].trim();
    });

    if (urls.length === 0) {
      throw new Error('No URLs found in sitemap');
    }

    var isSitemapIndex = text.includes('<sitemap>') || text.includes('<sitemapindex>');

    if (isSitemapIndex) {
      var allUrls = [];
      for (var i = 0; i < urls.length; i++) {
        try {
          var subUrls = await this.fetchAndParseSitemap(urls[i]);
          allUrls = allUrls.concat(subUrls);
        } catch (error) {
          console.error('Failed to fetch sub-sitemap ' + urls[i] + ':', error);
        }
      }
      return allUrls;
    }

    return urls;
  } catch (error) {
    throw new Error('Failed to fetch sitemap: ' + error.message);
  }
};

DomainAnalyzer.prototype.analyzePageInBackground = async function (url, timeout) {
  var timeouts = [15000, 20000, 25000];
  var lastError = null;
  var self = this; // Capture this for use in nested functions

  for (var attempt = 0; attempt < timeouts.length; attempt++) {
    if (self.shouldCancel) throw new Error('Analysis cancelled by user');
    var currentTimeout = timeouts[attempt];
    var timeoutSeconds = currentTimeout / 1000;

    try {
      var result = await new Promise(function (resolve, reject) {
        var timeoutId = setTimeout(function () {
          reject(
            new Error('Timeout - page took longer than ' + timeoutSeconds + ' seconds to load')
          );
        }, currentTimeout);

        chrome.tabs.create({ url: url, active: false }, function (tab) {
          var tabId = tab.id;

          var checkReady = setInterval(async function () {
            try {
              var currentTab = await chrome.tabs.get(tabId);

              if (currentTab.status === 'complete') {
                clearInterval(checkReady);
                clearTimeout(timeoutId);

                setTimeout(async function () {
                  try {
                    var isSquarespace = await chrome.scripting.executeScript({
                      target: { tabId: tabId },
                      func: function () {
                        return !!(
                          document.querySelector(
                            'meta[name="generator"][content*="Squarespace"]'
                          ) ||
                          document.querySelector('[data-section-id]') ||
                          document.querySelector('[data-block-id]') ||
                          document.querySelector('.sqs-block')
                        );
                      },
                    });

                    var additionalDelay =
                      isSquarespace && isSquarespace[0] && isSquarespace[0].result ? 3000 : 1000;

                    setTimeout(async function () {
                      try {
                        var response;

                        console.log('🔍 DOMAIN-ANALYZER: Analyzing page with options:', {
                          useMobileViewport: self.options.useMobileViewport,
                          mobileOnly: self.options.mobileOnly,
                          url: url,
                        });

                        if (self.options.useMobileViewport || self.options.mobileOnly) {
                          console.log(
                            '📱 DOMAIN-ANALYZER: Taking MOBILE path (direct call to MobileLighthouseAnalyzer)'
                          );

                          try {
                            // Step 1: Run Lighthouse mobile analysis
                            const lighthouseResults = await MobileLighthouseAnalyzer.analyzePage(
                              tabId,
                              url
                            );
                            console.log('Lighthouse results:', lighthouseResults);

                            if (self.options.mobileOnly) {
                              // Mobile-only: Skip design analysis
                              console.log('Mobile-only mode: Skipping design analysis');

                              const pageUrl = lighthouseResults.url || url;
                              const domain = new URL(pageUrl).hostname.replace('www.', '');
                              const pathname = new URL(pageUrl).pathname;
                              const mobileIssues = MobileResultsConverter.convertToMobileIssues(
                                lighthouseResults,
                                pageUrl
                              );

                              response = {
                                success: true,
                                data: {
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
                                    viewportMeta: MobileResultsConverter.convertViewportMeta(
                                      lighthouseResults.viewport
                                    ),
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
                                },
                              };

                              console.log(
                                '✅ Mobile-only analysis complete. Found',
                                mobileIssues.length,
                                'issues'
                              );
                            } else {
                              // Full analysis WITH mobile
                              console.log('Running design element analysis...');

                              // Ensure content script is ready
                              await self.waitForContentScript(tabId);

                              const designResponse = await chrome.tabs.sendMessage(tabId, {
                                action: 'analyzeStyles',
                              });

                              if (designResponse && designResponse.success) {
                                const pageUrl = designResponse.data.metadata.url;
                                const mobileIssues = MobileResultsConverter.convertToMobileIssues(
                                  lighthouseResults,
                                  pageUrl
                                );

                                designResponse.data.mobileIssues = {
                                  viewportMeta: MobileResultsConverter.convertViewportMeta(
                                    lighthouseResults.viewport
                                  ),
                                  issues: mobileIssues,
                                };

                                response = designResponse;
                                console.log(
                                  '✅ Mobile + design analysis complete. Found',
                                  mobileIssues.length,
                                  'mobile issues'
                                );
                              } else {
                                throw new Error('Design analysis failed');
                              }
                            }
                          } catch (error) {
                            console.error('Mobile analysis error:', error);
                            throw error;
                          }

                          chrome.tabs.remove(tabId);
                        } else {
                          console.log(
                            '💻 DOMAIN-ANALYZER: Taking DESKTOP path (analyzeStyles only)'
                          );

                          // Ensure content script is ready
                          await self.waitForContentScript(tabId);

                          response = await chrome.tabs.sendMessage(tabId, {
                            action: 'analyzeStyles',
                          });
                          chrome.tabs.remove(tabId);
                        }

                        if (response && response.success) {
                          resolve(response.data);
                        } else {
                          reject(new Error('Analysis failed'));
                        }
                      } catch (error) {
                        chrome.tabs.remove(tabId);
                        reject(error);
                      }
                    }, additionalDelay);
                  } catch (error) {
                    if (self.shouldCancel) return;
                    setTimeout(async function () {
                      try {
                        var response;

                        if (self.options.useMobileViewport || self.options.mobileOnly) {
                          console.log(
                            '📱 DOMAIN-ANALYZER: Taking MOBILE path (direct call - retry attempt)'
                          );

                          try {
                            // Step 1: Run Lighthouse mobile analysis
                            const lighthouseResults = await MobileLighthouseAnalyzer.analyzePage(
                              tabId,
                              url
                            );
                            console.log('Lighthouse results:', lighthouseResults);

                            if (self.options.mobileOnly) {
                              // Mobile-only: Skip design analysis
                              console.log('Mobile-only mode: Skipping design analysis');

                              const pageUrl = lighthouseResults.url || url;
                              const domain = new URL(pageUrl).hostname.replace('www.', '');
                              const pathname = new URL(pageUrl).pathname;
                              const mobileIssues = MobileResultsConverter.convertToMobileIssues(
                                lighthouseResults,
                                pageUrl
                              );

                              response = {
                                success: true,
                                data: {
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
                                    viewportMeta: MobileResultsConverter.convertViewportMeta(
                                      lighthouseResults.viewport
                                    ),
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
                                },
                              };

                              console.log(
                                '✅ Mobile-only analysis complete. Found',
                                mobileIssues.length,
                                'issues'
                              );
                            } else {
                              // Full analysis WITH mobile
                              console.log('Running design element analysis...');

                              // Ensure content script is ready
                              await self.waitForContentScript(tabId);

                              const designResponse = await chrome.tabs.sendMessage(tabId, {
                                action: 'analyzeStyles',
                              });

                              if (designResponse && designResponse.success) {
                                const pageUrl = designResponse.data.metadata.url;
                                const mobileIssues = MobileResultsConverter.convertToMobileIssues(
                                  lighthouseResults,
                                  pageUrl
                                );

                                designResponse.data.mobileIssues = {
                                  viewportMeta: MobileResultsConverter.convertViewportMeta(
                                    lighthouseResults.viewport
                                  ),
                                  issues: mobileIssues,
                                };

                                response = designResponse;
                                console.log(
                                  '✅ Mobile + design analysis complete. Found',
                                  mobileIssues.length,
                                  'mobile issues'
                                );
                              } else {
                                throw new Error('Design analysis failed');
                              }
                            }
                          } catch (error) {
                            console.error('Mobile analysis error:', error);
                            throw error;
                          }

                          chrome.tabs.remove(tabId);
                        } else {
                          console.log(
                            '💻 DOMAIN-ANALYZER: Taking DESKTOP path (analyzeStyles only - retry)'
                          );

                          // Ensure content script is ready
                          await self.waitForContentScript(tabId);

                          response = await chrome.tabs.sendMessage(tabId, {
                            action: 'analyzeStyles',
                          });
                          chrome.tabs.remove(tabId);
                        }

                        if (response && response.success) {
                          resolve(response.data);
                        } else {
                          reject(new Error('Analysis failed'));
                        }
                      } catch (error) {
                        chrome.tabs.remove(tabId);
                        reject(error);
                      }
                    }, 2000);
                  }
                }, 1000);
              }
            } catch (error) {
              clearInterval(checkReady);
              clearTimeout(timeoutId);
              reject(error);
            }
          }, 500);
        });
      });

      console.log(
        '✅ Successfully analyzed ' +
          url +
          ' on attempt ' +
          (attempt + 1) +
          '/' +
          timeouts.length +
          ' (' +
          timeoutSeconds +
          's timeout)'
      );
      return result;
    } catch (error) {
      lastError = error;
      console.log(
        'Attempt ' +
          (attempt + 1) +
          '/' +
          timeouts.length +
          ' failed for ' +
          url +
          ' with ' +
          timeoutSeconds +
          's timeout: ' +
          error.message
      );

      if (attempt < timeouts.length - 1) {
        console.log('Retrying with ' + timeouts[attempt + 1] / 1000 + 's timeout...');
        if (self.shouldCancel) throw new Error('Analysis cancelled by user');
        continue;
      }
    }
  }

  throw lastError;
};

DomainAnalyzer.prototype.mergeAllResults = function (results) {
  if (results.length === 0) return null;

  console.log('🔍 MERGE: Merging', results.length, 'results');
  console.log(
    '🔍 MERGE: Sample result[0] structure:',
    results[0]
      ? {
          hasHeadings: !!results[0].headings,
          headingCount: results[0].headings
            ? Object.values(results[0].headings).reduce(
                (sum, h) => sum + (h.locations?.length || 0),
                0
              )
            : 0,
          hasParagraphs: !!results[0].paragraphs,
          paragraphCount: results[0].paragraphs
            ? Object.values(results[0].paragraphs).reduce(
                (sum, p) => sum + (p.locations?.length || 0),
                0
              )
            : 0,
          hasButtons: !!results[0].buttons,
          buttonCount: results[0].buttons
            ? Object.values(results[0].buttons).reduce(
                (sum, b) => sum + (b.locations?.length || 0),
                0
              )
            : 0,
          hasMobileIssues: !!results[0].mobileIssues,
          mobileIssueCount: results[0].mobileIssues?.issues?.length || 0,
        }
      : 'no results'
  );

  var validResults = results.filter(function (r) {
    return r && r.metadata;
  });
  if (validResults.length === 0) return null;

  var merged = {
    themeStyles: validResults[0].themeStyles || {},
    siteStyles: {},
    buttons: {
      primary: { locations: [] },
      secondary: { locations: [] },
      tertiary: { locations: [] },
      other: { locations: [] },
    },
    links: {
      'in-content': { locations: [] },
    },
    mobileIssues: {
      viewportMeta: { exists: false, content: null, isProper: false },
      issues: [],
    },
    images: [],
    colorPalette: {
      backgrounds: new Set(),
      text: new Set(),
      borders: new Set(),
      all: new Set(),
    },
    colorData: {
      colors: {},
      contrastPairs: [],
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
    qualityChecks: {
      missingH1: [],
      multipleH1: [],
      brokenHeadingHierarchy: [],
      fontSizeInconsistency: [],
      missingAltText: [],
    },
    metadata: {
      domain: validResults[0].metadata.domain || '',
      timestamp: new Date().toISOString(),
      pagesAnalyzed: [],
    },
    squarespaceThemeStyles: validResults[0].squarespaceThemeStyles || {},
    failedPages: [],
  };

  for (var idx = 0; idx < validResults.length; idx++) {
    var result = validResults[idx];

    try {
      if (!result.metadata || !result.metadata.pathname) continue;
      merged.metadata.pagesAnalyzed.push(result.metadata.pathname);

      // Merge site styles
      if (result.siteStyles) {
        for (var style in result.siteStyles) {
          var styleObj = result.siteStyles[style];
          if (!styleObj) continue;

          if (!styleObj.locations) {
            styleObj.locations = [];
          }

          if (!merged.siteStyles[style]) {
            merged.siteStyles[style] = {
              styleDefinition: styleObj.styleDefinition || '',
              locations: styleObj.locations.slice(),
            };
          } else {
            if (!merged.siteStyles[style].locations) {
              merged.siteStyles[style].locations = [];
            }
            merged.siteStyles[style].locations = merged.siteStyles[style].locations.concat(
              styleObj.locations
            );
          }
        }
      }

      // Merge buttons
      if (result.buttons) {
        for (var btnType in result.buttons) {
          var btnObj = result.buttons[btnType];
          if (!btnObj) continue;

          if (!btnObj.locations) {
            btnObj.locations = [];
          }

          if (!merged.buttons[btnType]) {
            merged.buttons[btnType] = { locations: [] };
          }
          if (!merged.buttons[btnType].locations) {
            merged.buttons[btnType].locations = [];
          }
          merged.buttons[btnType].locations = merged.buttons[btnType].locations.concat(
            btnObj.locations
          );
        }
      }

      // Merge headings
      if (result.headings) {
        for (var headingType in result.headings) {
          var headingObj = result.headings[headingType];
          if (!headingObj) continue;

          if (!headingObj.locations) {
            headingObj.locations = [];
          }

          if (!merged.headings[headingType]) {
            merged.headings[headingType] = { locations: [] };
          }
          if (!merged.headings[headingType].locations) {
            merged.headings[headingType].locations = [];
          }
          merged.headings[headingType].locations = merged.headings[headingType].locations.concat(
            headingObj.locations
          );
        }
      }

      // Merge paragraphs
      if (result.paragraphs) {
        for (var paragraphType in result.paragraphs) {
          var paraObj = result.paragraphs[paragraphType];
          if (!paraObj) continue;

          if (!paraObj.locations) {
            paraObj.locations = [];
          }

          if (!merged.paragraphs[paragraphType]) {
            merged.paragraphs[paragraphType] = { locations: [] };
          }
          if (!merged.paragraphs[paragraphType].locations) {
            merged.paragraphs[paragraphType].locations = [];
          }
          merged.paragraphs[paragraphType].locations = merged.paragraphs[
            paragraphType
          ].locations.concat(paraObj.locations);
        }
      }

      // Merge colorPalette
      if (result.colorPalette) {
        if (result.colorPalette.backgrounds) {
          result.colorPalette.backgrounds.forEach(function (c) {
            merged.colorPalette.backgrounds.add(c);
          });
        }
        if (result.colorPalette.text) {
          result.colorPalette.text.forEach(function (c) {
            merged.colorPalette.text.add(c);
          });
        }
        if (result.colorPalette.borders) {
          result.colorPalette.borders.forEach(function (c) {
            merged.colorPalette.borders.add(c);
          });
        }
        if (result.colorPalette.all) {
          result.colorPalette.all.forEach(function (c) {
            merged.colorPalette.all.add(c);
          });
        }
      }

      // Merge colorData
      if (result.colorData) {
        if (result.colorData.colors) {
          for (var hex in result.colorData.colors) {
            var colorInfo = result.colorData.colors[hex];

            if (!merged.colorData.colors[hex]) {
              merged.colorData.colors[hex] = {
                count: colorInfo.count,
                usedAs: (colorInfo.usedAs || []).slice(),
                instances: (colorInfo.instances || []).slice(),
              };
            } else {
              merged.colorData.colors[hex].count += colorInfo.count;

              if (colorInfo.usedAs) {
                for (var u = 0; u < colorInfo.usedAs.length; u++) {
                  var usage = colorInfo.usedAs[u];
                  if (merged.colorData.colors[hex].usedAs.indexOf(usage) === -1) {
                    merged.colorData.colors[hex].usedAs.push(usage);
                  }
                }
              }

              if (colorInfo.instances) {
                merged.colorData.colors[hex].instances = merged.colorData.colors[
                  hex
                ].instances.concat(colorInfo.instances);
              }
            }
          }
        }

        if (result.colorData.contrastPairs && result.colorData.contrastPairs.length > 0) {
          merged.colorData.contrastPairs = merged.colorData.contrastPairs.concat(
            result.colorData.contrastPairs
          );
        }
      }

      // Merge qualityChecks
      for (var check in result.qualityChecks) {
        if (!merged.qualityChecks[check]) {
          merged.qualityChecks[check] = [];
        }
        var checkData = result.qualityChecks[check] || [];
        merged.qualityChecks[check] = merged.qualityChecks[check].concat(checkData);
      }

      // Merge images
      var resultImages = result.images || [];
      for (var i = 0; i < resultImages.length; i++) {
        var newImg = resultImages[i];
        var existingIndex = -1;

        for (var j = 0; j < merged.images.length; j++) {
          if (
            merged.images[j].src === newImg.src &&
            merged.images[j].section === newImg.section &&
            merged.images[j].block === newImg.block
          ) {
            existingIndex = j;
            break;
          }
        }

        if (existingIndex === -1) {
          merged.images.push(newImg);
        } else {
          var existing = merged.images[existingIndex];
          var bothMissingAlt =
            (!existing.alt || existing.alt === '(missing alt text)') &&
            (!newImg.alt || newImg.alt === '(missing alt text)');

          if (bothMissingAlt) {
            if (newImg.url.length > existing.url.length) {
              merged.images[existingIndex] = newImg;
            }
          } else {
            merged.images.push(newImg);
          }
        }
      }

      // Merge links
      if (result.links && result.links['in-content']) {
        if (!result.links['in-content'].locations) {
          result.links['in-content'].locations = [];
        }
        if (!merged.links['in-content']) {
          merged.links['in-content'] = { locations: [] };
        }
        if (!merged.links['in-content'].locations) {
          merged.links['in-content'].locations = [];
        }
        merged.links['in-content'].locations = merged.links['in-content'].locations.concat(
          result.links['in-content'].locations
        );
      }

      // Merge mobile issues
      if (result.mobileIssues) {
        if (result.mobileIssues.viewportMeta && result.mobileIssues.viewportMeta.exists) {
          merged.mobileIssues.viewportMeta = result.mobileIssues.viewportMeta;
        }
        if (result.mobileIssues.issues) {
          merged.mobileIssues.issues = merged.mobileIssues.issues.concat(
            result.mobileIssues.issues
          );
        }
      }
    } catch (error) {
      console.error('Error merging result:', error);
    }
  }

  merged.colorPalette.backgrounds = Array.from(merged.colorPalette.backgrounds);
  merged.colorPalette.text = Array.from(merged.colorPalette.text);
  merged.colorPalette.borders = Array.from(merged.colorPalette.borders);
  merged.colorPalette.all = Array.from(merged.colorPalette.all);

  return merged;
};

DomainAnalyzer.prototype.notifyProgress = function () {
  // Calculate percentage based on COMPLETED pages (current - 1)
  const completed = this.currentProgress.current - 1;
  const total = this.currentProgress.total || 1;
  this.currentProgress.percent = (completed / total) * 100;

  chrome.storage.local.set({
    domainAnalysisProgress: this.currentProgress,
  });
};

DomainAnalyzer.prototype.cancelAnalysis = function () {
  this.shouldCancel = true;
};

DomainAnalyzer.prototype.delay = function (ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
};

DomainAnalyzer.prototype.isRunning = function () {
  return this.isAnalyzing;
};

// Make it available globally (works in both popup and service worker)
if (typeof window !== 'undefined') {
  window.DomainAnalyzer = DomainAnalyzer;
} else {
  // In service worker context
  self.DomainAnalyzer = DomainAnalyzer;
}
