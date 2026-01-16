import { DomainAnalysisManager } from '../../managers/domainAnalysis';

export class DomainCrawler {
  /**
   * Find sitemap URLs for a given domain
   * Delegates to DomainAnalysisManager for robust discovery
   */
  static async findSitemap(domain: string): Promise<string[] | null> {
    return DomainAnalysisManager.fetchSitemap(domain);
  }

  /**
   * Fetch and parse a sitemap XML to extract URLs
   * Delegates to DomainAnalysisManager
   */
  static async fetchAndParseSitemap(sitemapUrl: string): Promise<string[]> {
    const urls = await DomainAnalysisManager.fetchAndParseSitemapUrl(sitemapUrl);
    return urls || [];
  }
}
