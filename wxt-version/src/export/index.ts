// index.ts - Export Manager
// Orchestrates all export functions
// Migrated from export-manager.js

import { downloadFile, escapeHtml } from './utils';

/**
 * Export Manager - orchestrates all export operations
 */
export class ExportManager {
  /**
   * Export CSV spreadsheet
   */
  static async exportCSV(analyzer: any): Promise<void> {
    if (this.isMobileOnlyData(analyzer)) {
      alert(
        'No data to export. This analysis only contains mobile usability data. Use the Mobile Report button instead.'
      );
      return;
    }

    const { exportCSV } = await import('./csv');
    exportCSV(
      analyzer.accumulatedResults,
      analyzer.FILENAME_BRAND,
      analyzer.showSuccess.bind(analyzer),
      analyzer.showError.bind(analyzer)
    );
  }

  /**
   * Export HTML reports (bulk export)
   */
  static async exportHTMLReport(analyzer: any): Promise<void> {
    if (this.isMobileOnlyData(analyzer)) {
      alert(
        'No data to export. This analysis only contains mobile usability data. Use the Mobile Report button instead.'
      );
      return;
    }

    // Inject detected platform info for reports (generic version)
    if (analyzer.detectedPlatform && analyzer.accumulatedResults) {
      analyzer.accumulatedResults.detectedPlatform = analyzer.detectedPlatform;
    }

    const { exportAnalysisReport } = await import('./htmlReports');
    exportAnalysisReport(analyzer.accumulatedResults);
    analyzer.showSuccess('✅ Audit Reports exported!');

    // Also export images report automatically with bulk export
    // Add a delay to avoid browser download collision
    setTimeout(async () => {
      await this.exportImagesReport(analyzer, true);
    }, 1500);
  }

  /**
   * Export images analysis report
   */
  static async exportImagesReport(analyzer: any, isBulkExport = false): Promise<void> {
    if (!analyzer.accumulatedResults) {
      if (!isBulkExport) alert('No data to export. Please analyze a page first.');
      return;
    }

    const qualityChecks = analyzer.accumulatedResults.qualityChecks || {};
    const imagesWithoutAlt = qualityChecks.missingAltText || [];
    const genericImageNames = qualityChecks.genericImageNames || [];

    const { exportImagesReport } = await import('./imagesReport');
    exportImagesReport(
      analyzer.accumulatedResults,
      imagesWithoutAlt,
      genericImageNames,
      analyzer.FILENAME_BRAND,
      downloadFile
    );

    if (!isBulkExport) {
      analyzer.showSuccess('✅ Images report exported successfully!');
    }
  }

  /**
   * Export style guide (typography + colors)
   */
  static async exportStyleGuide(analyzer: any): Promise<void> {
    if (this.isMobileOnlyData(analyzer)) {
      alert(
        'No data to export. This analysis only contains mobile usability data. Use the Mobile Report button instead.'
      );
      return;
    }

    const { exportStyleGuide } = await import('./styleGuide');
    exportStyleGuide(
      analyzer.accumulatedResults,
      analyzer.FILENAME_BRAND,
      analyzer.showSuccess.bind(analyzer),
      downloadFile
    );
  }

  /**
   * Export mobile usability report
   */
  static async exportMobileReport(analyzer: any): Promise<void> {
    if (!analyzer.accumulatedResults) {
      alert('No data to export. Please analyze a page first.');
      return;
    }

    // Check if mobile analysis was performed
    if (!this.hasMobileData(analyzer)) {
      alert(
        'No mobile analysis data to export. This analysis was performed without mobile analysis. Please run an analysis with mobile analysis enabled.'
      );
      return;
    }

    const mobileIssues = analyzer.accumulatedResults.mobileIssues?.issues || [];
    const domain = analyzer.accumulatedResults.metadata?.domain || 'website';

    const { exportMobileReport } = await import('./mobileReport');
    exportMobileReport(
      analyzer.accumulatedResults,
      mobileIssues,
      domain,
      analyzer.FILENAME_BRAND,
      escapeHtml,
      downloadFile
    );

    analyzer.showSuccess('✅ Mobile Usability report exported!');
  }

  /**
   * Check if data is mobile-only
   */
  private static isMobileOnlyData(analyzer: any): boolean {
    if (!analyzer.accumulatedResults) return false;

    const hasRegularData =
      analyzer.accumulatedResults.headings ||
      analyzer.accumulatedResults.paragraphs ||
      analyzer.accumulatedResults.buttons ||
      analyzer.accumulatedResults.colorData;

    const hasMobileData = analyzer.accumulatedResults.mobileIssues;

    return hasMobileData && !hasRegularData;
  }

  /**
   * Check if mobile data exists
   */
  private static hasMobileData(analyzer: any): boolean {
    return !!(
      analyzer.accumulatedResults.mobileIssues && analyzer.accumulatedResults.mobileIssues.issues
    );
  }
}

// Export individual functions and utils for direct use
export { downloadFile, escapeHtml };

// Default export
export default ExportManager;
