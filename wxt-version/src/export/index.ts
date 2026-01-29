// index.ts - Export Manager
// Orchestrates all export functions
// Migrated from export-manager.js

import { exportCSV } from './csv';
import { exportImagesReport } from './imagesReport';
import { exportMobileReport } from './mobileReport';
import { exportStyleGuide } from './styleGuide';
import { exportAnalysisReport } from './htmlReports';
import { downloadFile, escapeHtml } from './utils';

/**
 * Export Manager - orchestrates all export operations
 */
export class ExportManager {
  /**
   * Export CSV spreadsheet
   */
  static exportCSV(analyzer: any): void {
    if (this.isMobileOnlyData(analyzer)) {
      alert(
        'No data to export. This analysis only contains mobile usability data. Use the Mobile Report button instead.'
      );
      return;
    }

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
  static exportHTMLReport(analyzer: any): void {
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

    exportAnalysisReport(analyzer.accumulatedResults);
    analyzer.showSuccess('✅ Audit Reports exported!');

    // Also export images report automatically with bulk export
    // Add a delay to avoid browser download collision
    setTimeout(() => {
      this.exportImagesReport(analyzer, true);
    }, 1500);
  }

  /**
   * Export images analysis report
   */
  static exportImagesReport(analyzer: any, isBulkExport = false): void {
    if (!analyzer.accumulatedResults) {
      if (!isBulkExport) alert('No data to export. Please analyze a page first.');
      return;
    }

    const qualityChecks = analyzer.accumulatedResults.qualityChecks || {};
    const imagesWithoutAlt = qualityChecks.missingAltText || [];
    const genericImageNames = qualityChecks.genericImageNames || [];

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
  static exportStyleGuide(analyzer: any): void {
    if (this.isMobileOnlyData(analyzer)) {
      alert(
        'No data to export. This analysis only contains mobile usability data. Use the Mobile Report button instead.'
      );
      return;
    }

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
  static exportMobileReport(analyzer: any): void {
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
export {
  exportCSV,
  exportImagesReport,
  exportMobileReport,
  exportStyleGuide,
  exportAnalysisReport,
  downloadFile,
  escapeHtml,
};

// Default export
export default ExportManager;
