// export-manager.js - Export Functionality Management
// Handles all export triggers and file downloads

const ExportManager = {
  exportCSV: function (analyzer) {
    if (analyzer.isMobileOnlyData()) {
      customAlert(
        'No data to export. This analysis only contains mobile usability data. Use the Mobile Report button instead.'
      );
      return;
    }
    ExportCSV.export(
      analyzer.accumulatedResults,
      analyzer.FILENAME_BRAND,
      analyzer.showSuccess.bind(analyzer),
      analyzer.showError.bind(analyzer)
    );
  },

  exportHTMLReport: function (analyzer) {
    if (analyzer.isMobileOnlyData()) {
      customAlert(
        'No data to export. This analysis only contains mobile usability data. Use the Mobile Report button instead.'
      );
      return;
    }
    ExportHTMLReports.export(
      analyzer.accumulatedResults,
      analyzer.FILENAME_BRAND,
      analyzer.showSuccess.bind(analyzer),
      analyzer.showError.bind(analyzer)
    );

    // Also export images report automatically with bulk export
    // Add a delay to avoid browser download collision
    setTimeout(() => {
      this.exportImagesReport(analyzer, true);
    }, 1500);
  },

  exportImagesReport: function (analyzer, isBulkExport = false) {
    if (!analyzer.accumulatedResults) {
      if (!isBulkExport) customAlert('No data to export. Please analyze a page first.');
      return;
    }

    const qualityChecks = analyzer.accumulatedResults.qualityChecks || {};
    const imagesWithoutAlt = qualityChecks.missingAltText || [];
    const genericImageNames = qualityChecks.genericImageNames || [];

    // Removed check: Export even if no issues found as requested by user

    ExportImagesReport.export(
      analyzer.accumulatedResults,
      imagesWithoutAlt,
      genericImageNames,
      analyzer.FILENAME_BRAND,
      this.downloadFile.bind(this)
    );

    if (!isBulkExport) {
      analyzer.showSuccess('✅ Images report exported successfully!');
    }
  },

  exportStyleGuide: function (analyzer) {
    if (analyzer.isMobileOnlyData()) {
      customAlert(
        'No data to export. This analysis only contains mobile usability data. Use the Mobile Report button instead.'
      );
      return;
    }
    ExportStyleGuide.export(
      analyzer.accumulatedResults,
      analyzer.FILENAME_BRAND,
      analyzer.showSuccess.bind(analyzer),
      this.downloadFile.bind(this)
    );
  },

  exportMobileReport: function (analyzer) {
    if (!analyzer.accumulatedResults) {
      customAlert('No data to export. Please analyze a page first.');
      return;
    }

    // Check if mobile analysis was performed
    if (!analyzer.hasMobileData()) {
      customAlert(
        'No mobile analysis data to export. This analysis was performed without mobile analysis. Please run an analysis with mobile analysis enabled.'
      );
      return;
    }

    const mobileIssues = analyzer.accumulatedResults.mobileIssues?.issues || [];
    const domain = analyzer.accumulatedResults.metadata?.domain || 'website';

    ExportMobileReport.export(
      analyzer.accumulatedResults,
      mobileIssues,
      domain,
      analyzer.FILENAME_BRAND,
      text =>
        text.replace(
          /[&<>"']/g,
          m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]
        ),
      this.downloadFile.bind(this)
    );

    analyzer.showSuccess('✅ Mobile Usability report exported!');
  },

  downloadFile: function (content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

// Make globally available
window.ExportManager = ExportManager;
