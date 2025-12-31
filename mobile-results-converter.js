// mobile-results-converter.js
// Single Responsibility: Convert Lighthouse-style results to the extension's issue format

var MobileResultsConverter = (function() {
  'use strict';

  // ============================================
  // MAIN CONVERSION FUNCTION
  // ============================================
  
  function convertToMobileIssues(lighthouseResults, pageUrl) {
    var issues = [];
    
    // Convert viewport issues
    convertViewportIssues(lighthouseResults.viewport, issues, pageUrl);
    
    // Convert tap target issues
    convertTapTargetIssues(lighthouseResults.tapTargets, issues, pageUrl);
    
    // Convert font size issues
    convertFontSizeIssues(lighthouseResults.fontSize, issues, pageUrl);
    
    // Convert content width issues
    convertContentWidthIssues(lighthouseResults.contentWidth, issues, pageUrl);
    
    // Convert image sizing issues
    convertImageSizingIssues(lighthouseResults.imageSizing, issues, pageUrl);
    
    return issues;
  }

  // ============================================
  // VIEWPORT CONVERSION
  // ============================================
  
  function convertViewportIssues(viewportData, issues, pageUrl) {
    if (!viewportData.exists) {
      issues.push({
        type: 'viewport-missing',
        severity: 'error',
        element: 'META',
        url: pageUrl,
        navigationName: new URL(pageUrl).pathname,
        section: 'head',
        block: 'meta',
        details: {
          actual: 'missing',
          required: '<meta name="viewport" content="width=device-width, initial-scale=1">'
        }
      });
    } else if (!viewportData.isOptimal) {
      issues.push({
        type: 'viewport-improper',
        severity: 'error',
        element: 'META',
        url: pageUrl,
        navigationName: new URL(pageUrl).pathname,
        section: 'head',
        block: 'meta',
        details: {
          actual: viewportData.content,
          required: 'width=device-width, initial-scale=1'
        }
      });
    }
  }

  // ============================================
  // TAP TARGET CONVERSION
  // ============================================
  
  function convertTapTargetIssues(tapTargets, issues, pageUrl) {
    for (var i = 0; i < tapTargets.length; i++) {
      var issue = tapTargets[i];
      
      if (issue.type === 'size') {
        issues.push({
          type: 'touch-target-too-small',
          severity: 'error',
          element: issue.element,
          text: issue.text || '',
          url: pageUrl,
          navigationName: new URL(pageUrl).pathname,
          section: 'body',
          block: 'interactive-element',
          details: {
            actual: issue.width + 'x' + issue.height + 'px',
            recommended: '≥' + issue.minRequired + 'x' + issue.minRequired + 'px (accessibility standard)',
            width: issue.width,
            height: issue.height
          }
        });
      } else if (issue.type === 'spacing') {
        issues.push({
          type: 'touch-target-spacing',
          severity: 'warning',
          element: issue.element,
          text: issue.text || '',
          url: pageUrl,
          navigationName: new URL(pageUrl).pathname,
          section: 'body',
          block: 'interactive-element',
          details: {
            actual: issue.overlapPercent + '% overlap with nearby tap target',
            recommended: '≤25% overlap (Lighthouse standard), maintain ≥' + issue.minRequired + 'px spacing',
            nearElement: issue.nearElement
          }
        });
      }
    }
  }

  // ============================================
  // FONT SIZE CONVERSION
  // ============================================
  
  function convertFontSizeIssues(fontSizes, issues, pageUrl) {
    for (var i = 0; i < fontSizes.length; i++) {
      var issue = fontSizes[i];
      
      if (issue.type === 'too-small') {
        issues.push({
          type: 'font-too-small',
          severity: 'error',
          element: issue.element,
          text: issue.text || '',
          url: pageUrl,
          navigationName: new URL(pageUrl).pathname,
          section: 'body',
          block: 'text-element',
          details: {
            actual: issue.fontSize + 'px',
            required: '≥' + issue.minRequired + 'px (Lighthouse minimum)',
            recommended: '≥' + issue.recommended + 'px for optimal readability (Lighthouse standard)'
          }
        });
      } else if (issue.type === 'below-recommended') {
        issues.push({
          type: 'font-size-warning',
          severity: 'warning',
          element: issue.element,
          text: issue.text || '',
          url: pageUrl,
          navigationName: new URL(pageUrl).pathname,
          section: 'body',
          block: 'text-element',
          details: {
            actual: issue.fontSize + 'px',
            recommended: '≥' + issue.recommended + 'px for optimal mobile readability (Lighthouse standard)'
          }
        });
      }
    }
  }

  // ============================================
  // CONTENT WIDTH CONVERSION
  // ============================================
  
  function convertContentWidthIssues(contentWidth, issues, pageUrl) {
    if (contentWidth.hasHorizontalScroll) {
      issues.push({
        type: 'horizontal-scroll',
        severity: 'error',
        element: 'DOCUMENT',
        url: pageUrl,
        navigationName: new URL(pageUrl).pathname,
        section: 'page',
        block: 'document',
        details: {
          actual: contentWidth.contentWidth + 'px content width',
          required: contentWidth.viewportWidth + 'px (viewport width)',
          overflow: contentWidth.overflowAmount + 'px'
        }
      });
    }
  }

	// ============================================
  // IMAGE SIZING CONVERSION
  // ============================================
  
  function convertImageSizingIssues(imageSizing, issues, pageUrl) {
    for (var i = 0; i < imageSizing.length; i++) {
      var issue = imageSizing[i];
      
      issues.push({
        type: 'image-oversized',
        severity: 'warning',
        element: issue.element,
        text: issue.alt,
        url: pageUrl,
        navigationName: new URL(pageUrl).pathname,
        section: 'body',
        block: 'image',
        details: {
          src: issue.src,
          displaySize: issue.displaySize,
          naturalSize: issue.naturalSize,
          ratio: issue.ratio + 'x display size',
          wastedPixels: issue.wastedPixels.toLocaleString() + ' pixels'
        }
      });
    }
  }

  // ============================================
  // VIEWPORT META TAG RESULT
  // ============================================
  
  function convertViewportMeta(viewportData) {
    return {
      exists: viewportData.exists,
      content: viewportData.content || null,
      isProper: viewportData.isOptimal || false
    };
  }

  // ============================================
  // PUBLIC API
  // ============================================
  
  return {
    convertToMobileIssues: convertToMobileIssues,
    convertViewportMeta: convertViewportMeta
  };

})();

// Make available in service worker context
if (typeof self !== 'undefined') {
  self.MobileResultsConverter = MobileResultsConverter;
}