import { DomainAnalysisOptions } from './types';
import { MobileLighthouseAnalyzer } from '../mobileLighthouse';
import { MobileResultsConverter } from '../mobileConverter';
import { ReportData } from '../../export/types';

const DEBUG_DA = false;

export class PageAnalyzer {
  private openTabs: number[] = [];

  constructor() {}

  /**
   * analyzePageInBackground wrapper that handles multiple timeout attempts
   */
  async analyzePage(
    url: string,
    options: DomainAnalysisOptions,
    signal?: AbortSignal
  ): Promise<ReportData | null> {
    const timeouts = [15000, 20000, 25000];
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < timeouts.length; attempt++) {
      if (signal?.aborted) throw new Error('Analysis cancelled by user');

      const currentTimeout = timeouts[attempt];
      const timeoutSeconds = currentTimeout / 1000;

      try {
        const result = await this.analyzePageAttempt(url, options, currentTimeout, signal);
        console.log(
          `✅ Successfully analyzed ${url} on attempt ${attempt + 1}/${timeouts.length} (${timeoutSeconds}s timeout)`
        );
        return result;
      } catch (error: any) {
        lastError = error;
        console.log(
          `Attempt ${attempt + 1}/${timeouts.length} failed for ${url} with ${timeoutSeconds}s timeout: ${error.message}`
        );

        if (attempt < timeouts.length - 1) {
          if (DEBUG_DA) console.log(`Retrying with ${timeouts[attempt + 1] / 1000}s timeout...`);
          if (signal?.aborted) throw new Error('Analysis cancelled by user');
          continue;
        }
      }
    }

    throw lastError;
  }

  /**
   * Single attempt to analyze a page
   */
  private async analyzePageAttempt(
    url: string,
    options: DomainAnalysisOptions,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<ReportData | null> {
    return new Promise((resolve, reject) => {
      // Setup timeout
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout - page took longer than ${timeoutMs / 1000} seconds to load`));
      }, timeoutMs);

      let checkReadyInterval: any = null;
      let tabId: number | null = null;

      // Cleanup function
      const cleanup = () => {
        clearTimeout(timeoutId);
        if (checkReadyInterval) clearInterval(checkReadyInterval);
        if (tabId !== null) {
          chrome.tabs.remove(tabId).catch(() => {});
          const idx = this.openTabs.indexOf(tabId);
          if (idx > -1) this.openTabs.splice(idx, 1);
        }
      };

      // Check cancellation
      if (signal?.aborted) {
        clearTimeout(timeoutId);
        reject(new Error('Analysis cancelled by user'));
        return;
      }

      // Create tab
      chrome.tabs.create({ url: url, active: false }, tab => {
        if (!tab.id) {
          clearTimeout(timeoutId);
          reject(new Error('Failed to create tab'));
          return;
        }

        tabId = tab.id;
        this.openTabs.push(tabId);

        // Poll for completion
        checkReadyInterval = setInterval(async () => {
          if (signal?.aborted) {
            cleanup();
            reject(new Error('Analysis cancelled by user'));
            return;
          }

          try {
            const currentTab = await chrome.tabs.get(tabId!);
            if (currentTab.status === 'complete') {
              clearInterval(checkReadyInterval);
              checkReadyInterval = null;

              // Give a small delay for scripts to initialize
              setTimeout(async () => {
                try {
                  if (signal?.aborted) {
                    cleanup();
                    reject(new Error('Analysis cancelled by user'));
                    return;
                  }

                  // Check if Squarespace
                  const isSquarespaceResults = await chrome.scripting.executeScript({
                    target: { tabId: tabId! },
                    func: () => {
                      return !!(
                        document.querySelector('meta[name="generator"][content*="Squarespace"]') ||
                        document.querySelector('[data-section-id]') ||
                        document.querySelector('[data-block-id]') ||
                        document.querySelector('.sqs-block')
                      );
                    },
                  });

                  const isSquarespace =
                    isSquarespaceResults &&
                    isSquarespaceResults[0] &&
                    isSquarespaceResults[0].result;

                  const additionalDelay = isSquarespace ? 3000 : 1000;

                  setTimeout(async () => {
                    if (signal?.aborted) {
                      cleanup();
                      reject(new Error('Analysis cancelled by user'));
                      return;
                    }

                    try {
                      // Perform Analysis
                      if (options.useMobileViewport || options.mobileOnly) {
                        const result = await this.performMobileAnalysis(
                          tabId!,
                          url,
                          options,
                          signal
                        );
                        cleanup(); // Removes tab
                        resolve(result);
                      } else {
                        const result = await this.performDesktopAnalysis(tabId!, signal);
                        cleanup(); // Removes tab
                        resolve(result);
                      }
                    } catch (err) {
                      cleanup();
                      reject(err);
                    }
                  }, additionalDelay);
                } catch (err) {
                  cleanup();
                  reject(err);
                }
              }, 1000);
            }
          } catch (err) {
            cleanup();
            reject(err);
          }
        }, 500);
      });
    });
  }

  private async performMobileAnalysis(
    tabId: number,
    url: string,
    options: DomainAnalysisOptions,
    signal?: AbortSignal
  ): Promise<ReportData> {
    if (DEBUG_DA)
      console.log(
        '📱 DOMAIN-ANALYZER: Taking MOBILE path (direct call to MobileLighthouseAnalyzer)'
      );

    // 1. Run Lighthouse
    if (signal?.aborted) throw new Error('Analysis cancelled by user');
    const lighthouseResults = await MobileLighthouseAnalyzer.analyzePage(tabId, url);
    if (signal?.aborted) throw new Error('Analysis cancelled by user');

    if (options.mobileOnly) {
      // Mobile Only - Construct partial result
      const pageUrl = lighthouseResults.url || url;
      const domain = new URL(pageUrl).hostname.replace('www.', '');
      const pathname = new URL(pageUrl).pathname;
      const mobileIssues = MobileResultsConverter.convertToMobileIssues(lighthouseResults, pageUrl);

      return {
        metadata: {
          url: pageUrl,
          domain: domain,
          pathname: pathname,
          title: 'Mobile Analysis',
        },
        mobileIssues: {
          viewportMeta: MobileResultsConverter.convertViewportMeta(lighthouseResults.viewport),
          issues: mobileIssues,
        },
        // Empty stubs for required ReportData fields
        colorData: { colors: {}, contrastPairs: [] },
        themeStyles: {},
        squarespaceThemeStyles: {},
        headings: {},
        paragraphs: {},
        buttons: {},
      } as ReportData;
    } else {
      // Full Analysis with Mobile
      await this.waitForContentScript(tabId);
      if (signal?.aborted) throw new Error('Analysis cancelled by user');

      const response = await chrome.tabs.sendMessage(tabId, { action: 'analyzeStyles' });
      if (!response || !response.success) {
        throw new Error('Design analysis failed');
      }

      const data = response.data as ReportData;
      const pageUrl = data.metadata.domain; // Note: metadata might need adjustments
      const mobileIssues = MobileResultsConverter.convertToMobileIssues(
        lighthouseResults,
        data.metadata.title || url // Fallback
      );

      data.mobileIssues = {
        viewportMeta: MobileResultsConverter.convertViewportMeta(lighthouseResults.viewport),
        issues: mobileIssues,
      };

      return data;
    }
  }

  private async performDesktopAnalysis(tabId: number, signal?: AbortSignal): Promise<ReportData> {
    if (DEBUG_DA) console.log('💻 DOMAIN-ANALYZER: Taking DESKTOP path (analyzeStyles only)');

    await this.waitForContentScript(tabId);
    if (signal?.aborted) throw new Error('Analysis cancelled by user');

    const response = await chrome.tabs.sendMessage(tabId, { action: 'analyzeStyles' });
    if (!response || !response.success) {
      throw new Error('Analysis failed');
    }

    return response.data;
  }

  private async waitForContentScript(tabId: number, maxRetries = 5): Promise<boolean> {
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
  }
}
