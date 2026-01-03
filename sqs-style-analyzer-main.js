// sqs-style-analyzer-main.js
// Main coordinator for Squarespace Style Analyzer content script
// Dependencies: color-analyzer.js, content-script-helpers.js, content-script-theme-capture.js,
//               content-script-analyzers.js, content-script-mobile-checks.js

(function() {
  'use strict';
  
  console.log('Squarespace Style Analyzer content script loaded');

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'analyzeStyles') {
      try {
        const results = analyzeSquarespaceStyles();
        sendResponse({ success: true, data: results });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
    return true; // Keep message channel open for async response
  });

  function analyzeSquarespaceStyles() {
    console.log('Analysis started');
    
    // Initialize results structure
    var results = {
      themeStyles: {
        typography: { styleDefinition: '', locations: [] },
        colors: { styleDefinition: '', locations: [] },
        spacing: { styleDefinition: '', locations: [] },
        buttons: { styleDefinition: '', locations: [] }
      },
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
      colorData: ColorAnalyzer.initializeColorData(),
      headings: { 
        'heading-1': { locations: [] }, 
        'heading-2': { locations: [] }, 
        'heading-3': { locations: [] },
        'heading-4': { locations: [] },
        'heading-5': { locations: [] },
        'heading-6': { locations: [] }
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
        missingAltText: [],
        genericImageNames: []
      },
      mobileIssues: {
        viewportMeta: { exists: false, content: null, isProper: false },
        issues: []
      },
      metadata: {
        url: window.location.href,
        domain: window.location.hostname,
        title: document.title || 'Unknown',
        pathname: window.location.pathname,
        timestamp: new Date().toISOString()
      }
    };

    // Initialize color tracker
    var colorTracker = ContentScriptHelpers.createColorTracker();

    // Add Set to track processed elements (prevent duplicate color tracking)
    results.colorData._processedElements = new Set();
    console.log('[COLOR DEBUG] _processedElements Set initialized:', results.colorData._processedElements);

    // Capture Squarespace theme styles
    var squarespaceThemeStyles = ContentScriptThemeCapture.captureSquarespaceThemeStyles(colorTracker, results.colorData);
    results.squarespaceThemeStyles = squarespaceThemeStyles;

    // Get navigation name for this page
    var navigationName = ContentScriptHelpers.getNavigationName();

    // Run all analyzers
    ContentScriptAnalyzers.analyzeButtons(results, navigationName, colorTracker, results.colorData);
    ContentScriptAnalyzers.analyzeHeadings(results, navigationName, colorTracker, results.colorData);
    ContentScriptAnalyzers.analyzeParagraphs(results, navigationName, squarespaceThemeStyles, colorTracker, results.colorData);
    ContentScriptAnalyzers.analyzeLinks(results, navigationName, colorTracker, results.colorData);
    ContentScriptAnalyzers.analyzeImages(results, navigationName);

    // Scan all page colors to capture any colors missed by element-specific analyzers
    // This ensures we capture section backgrounds, navigation colors, decorative elements, etc.
    console.log('[COLOR DEBUG] Before scanAllPageColors - processed elements:', results.colorData._processedElements.size);
    ContentScriptHelpers.scanAllPageColors(results.colorData);
    console.log('[COLOR DEBUG] After scanAllPageColors - total unique colors:', Object.keys(results.colorData.colors).length);

    // Finalize color palette
    results.colorPalette = ContentScriptHelpers.finalizeColorPalette(colorTracker);

    // Add DevTools CSS Overview format color summary
    results.devToolsColorSummary = ColorAnalyzer.getDevToolsColorSummary(results.colorData);

    console.log('Analysis completed');
    console.log('[COLOR DEBUG] DevTools Summary:', results.devToolsColorSummary);

    // Mobile usability checks are now handled by MobileLighthouseAnalyzer
    // via the analyzeMobileViewport action when checkbox is enabled
    // No mobile checks run here to avoid duplicates

    return results;
  }
})();
