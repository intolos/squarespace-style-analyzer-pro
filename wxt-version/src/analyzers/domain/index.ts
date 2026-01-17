import { DomainCrawler } from './crawler';
import { PageAnalyzer } from './pageAnalyzer';
import {
  DomainAnalysisOptions,
  DomainAnalysisProgress,
  DomainAnalysisResult,
  FailedPage,
} from './types';
import { ReportData } from '../../export/types';
import { ResultsManager } from '../../managers/resultsManager';

const DEBUG_DA = false;

export class DomainAnalyzer {
  private isAnalyzing: boolean = false;
  private abortController: AbortController | null = null;
  private currentProgress: DomainAnalysisProgress = { current: 0, total: 0, currentUrl: '' };
  private failedPages: FailedPage[] = [];
  private pageAnalyzer: PageAnalyzer;

  constructor() {
    this.pageAnalyzer = new PageAnalyzer();
  }

  /**
   * Analyze a domain by finding its sitemap
   */
  async analyzeDomain(
    domain: string,
    options: DomainAnalysisOptions = {}
  ): Promise<DomainAnalysisResult> {
    if (this.isAnalyzing) {
      throw new Error('Analysis already in progress');
    }

    this.isAnalyzing = true;
    this.abortController = new AbortController();
    this.failedPages = [];

    const settings = {
      maxPages: options.maxPages || 100,
      delayBetweenPages: options.delayBetweenPages || 2000,
      isPremium: options.isPremium || false,
    };

    const results: ReportData[] = [];
    let urlsToAnalyze: string[] = [];

    try {
      const sitemapUrls = await DomainCrawler.findSitemap(domain);

      if (!sitemapUrls || sitemapUrls.length === 0) {
        throw new Error('No sitemap found. Please use page-by-page analysis instead.');
      }

      urlsToAnalyze = sitemapUrls;
      const totalPagesInSitemap = sitemapUrls.length;

      // Limit pages based on settings
      if (!settings.isPremium && sitemapUrls.length > 10) {
        urlsToAnalyze = sitemapUrls.slice(0, 10);
      } else if (sitemapUrls.length > settings.maxPages) {
        urlsToAnalyze = sitemapUrls.slice(0, settings.maxPages);
      }

      this.currentProgress = {
        current: 0,
        total: urlsToAnalyze.length,
        totalInSitemap: totalPagesInSitemap,
        currentUrl: '',
      };

      // Analysis Loop
      for (let i = 0; i < urlsToAnalyze.length; i++) {
        if (this.abortController.signal.aborted) {
          return this.handleCancellation(results, urlsToAnalyze, i);
        }

        const url = urlsToAnalyze[i];
        this.currentProgress.current = i + 1;
        this.currentProgress.currentUrl = url;
        this.notifyProgress();

        try {
          const pageResult = await this.pageAnalyzer.analyzePage(
            url,
            options,
            this.abortController.signal
          );
          if (pageResult) {
            results.push(pageResult);
          }
        } catch (error: any) {
          if (
            this.abortController.signal.aborted ||
            error.message === 'Analysis cancelled by user'
          ) {
            return this.handleCancellation(results, urlsToAnalyze, i);
          }

          console.error(`Failed to analyze ${url}:`, error.message);
          this.failedPages.push({
            url: url,
            reason: error.message,
            timeout: options.timeout, // Note: timeout was hardcoded in pageAnalyzer, maybe passed in options
            timestamp: new Date().toISOString(),
          });
        }

        if (i < urlsToAnalyze.length - 1) {
          await this.delay(settings.delayBetweenPages);
        }
      }

      const mergedResults = this.mergeResults(results);

      if (mergedResults) {
        mergedResults.failedPages = this.failedPages;
      }

      return {
        success: true,
        cancelled: false,
        data: mergedResults,
        stats: {
          totalPages: urlsToAnalyze.length,
          successfulPages: results.length,
          failedPages: this.failedPages.length,
          failedPagesList: this.failedPages,
        },
      };
    } catch (error: any) {
      if (this.abortController?.signal?.aborted || error.message === 'Analysis cancelled by user') {
        // We don't have the loop index here, so we return 0 or could try to keep track of i outside the loop
        return this.handleCancellation(results, urlsToAnalyze, this.currentProgress.current - 1);
      }
      console.error('Core analysis error:', error);
      throw error;
    } finally {
      this.isAnalyzing = false;
      this.abortController = null;
    }
  }

  /**
   * Analyze a specific list of URLs
   */
  async analyzeUrlList(
    urls: string[],
    options: DomainAnalysisOptions = {}
  ): Promise<DomainAnalysisResult> {
    if (this.isAnalyzing) {
      throw new Error('Analysis already in progress');
    }

    this.isAnalyzing = true;
    this.abortController = new AbortController();
    this.failedPages = [];

    const settings = {
      delayBetweenPages: options.delayBetweenPages || 2000,
      isPremium: options.isPremium || false,
    };

    const results: ReportData[] = [];

    try {
      this.currentProgress = {
        current: 0,
        total: urls.length,
        currentUrl: '',
      };

      for (let i = 0; i < urls.length; i++) {
        if (this.abortController.signal.aborted) {
          return this.handleCancellation(results, urls, i);
        }

        const url = urls[i];
        this.currentProgress.current = i + 1;
        this.currentProgress.currentUrl = url;
        this.notifyProgress();

        try {
          const pageResult = await this.pageAnalyzer.analyzePage(
            url,
            options,
            this.abortController.signal
          );
          if (pageResult) {
            results.push(pageResult);
          }
        } catch (error: any) {
          if (
            this.abortController.signal.aborted ||
            error.message === 'Analysis cancelled by user'
          ) {
            return this.handleCancellation(results, urls, i);
          }
          console.error(`Failed to analyze ${url}:`, error.message);
          this.failedPages.push({
            url: url,
            reason: error.message,
            timestamp: new Date().toISOString(),
          });
        }

        if (i < urls.length - 1) {
          await this.delay(settings.delayBetweenPages);
        }
      }

      const mergedResults = this.mergeResults(results);
      if (mergedResults) {
        mergedResults.failedPages = this.failedPages;
      }

      return {
        success: true, // Only true if not cancelled
        data: mergedResults,
        stats: {
          totalPages: urls.length,
          successfulPages: results.length,
          failedPages: this.failedPages.length,
          failedPagesList: this.failedPages,
        },
      };
    } catch (error: any) {
      if (this.abortController?.signal?.aborted || error.message === 'Analysis cancelled by user') {
        return this.handleCancellation(results, urls, this.currentProgress.current - 1);
      }
      throw error;
    } finally {
      this.isAnalyzing = false;
      this.abortController = null;
    }
  }

  cancelAnalysis(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isAnalyzing = false;
  }

  isRunning(): boolean {
    return this.isAnalyzing;
  }

  private handleCancellation(
    results: ReportData[],
    urls: string[],
    currentIndex: number
  ): DomainAnalysisResult {
    if (DEBUG_DA) console.log('Analysis cancelled by user. Returning partial results...');
    const mergedResults = this.mergeResults(results);
    if (mergedResults) {
      mergedResults.failedPages = this.failedPages;
      mergedResults.cancelled = true;
    }

    return {
      success: true, // Legacy behavior returns success: true even on cancel
      cancelled: true,
      data: mergedResults,
      stats: {
        totalPages: urls.length,
        successfulPages: results.length,
        failedPages: this.failedPages.length,
        failedPagesList: this.failedPages,
        cancelledAt: currentIndex,
      },
    };
  }

  private mergeResults(results: ReportData[]): ReportData | null {
    if (results.length === 0) return null;
    if (results.length === 1) return results[0];

    let accumulated: ReportData | null = null;

    for (const result of results) {
      const { merged } = ResultsManager.mergeResults(accumulated, result);
      accumulated = merged;
    }

    return accumulated;
  }

  private notifyProgress(): void {
    // Calculate percentage based on COMPLETED pages (current - 1)
    const completed = this.currentProgress.current - 1;
    const total = this.currentProgress.total || 1;
    this.currentProgress.percent = (completed / total) * 100;

    chrome.storage.local.set({
      domainAnalysisProgress: this.currentProgress,
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (this.abortController?.signal.aborted) {
          clearInterval(checkInterval);
          reject(new Error('Analysis cancelled by user'));
          return;
        }
        if (Date.now() - startTime >= ms) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }
}

// Singleton instance
export const domainAnalyzer = new DomainAnalyzer();
