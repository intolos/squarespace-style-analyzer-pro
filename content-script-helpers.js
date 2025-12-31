// content-script-helpers.js
// DOM helper functions and color tracking utilities for content script analysis

var ContentScriptHelpers = (function() {
  'use strict';

  // ============================================
  // COLOR TRACKING UTILITIES
  // ============================================

  function normalizeColor(colorStr) {
    if (!colorStr || colorStr === 'rgba(0, 0, 0, 0)' || colorStr === 'transparent') return null;
    return colorStr;
  }

  function createColorTracker() {
    return {
      backgrounds: new Set(),
      text: new Set(),
      borders: new Set(),
      all: new Set()
    };
  }

  function addColor(colorTracker, color, type) {
    var normalized = normalizeColor(color);
    if (normalized) {
      colorTracker[type].add(normalized);
      colorTracker.all.add(normalized);
    }
  }

  function finalizeColorPalette(colorTracker) {
    return {
      backgrounds: Array.from(colorTracker.backgrounds),
      text: Array.from(colorTracker.text),
      borders: Array.from(colorTracker.borders),
      all: Array.from(colorTracker.all)
    };
  }

  // ============================================
  // NAVIGATION NAME DETECTION
  // ============================================

  function getNavigationName() {
    var navLinks = document.querySelectorAll('nav a[href], .navigation a[href], .menu a[href], [class*="nav"] a[href], header a[href]');
    var currentPath = window.location.pathname;
    var currentFullUrl = window.location.href;
    
    for (var i = 0; i < navLinks.length; i++) {
      var link = navLinks[i];
      var linkHref = link.getAttribute('href');
      var navText = link.textContent.trim();
      
      if (!navText || navText.toLowerCase().includes('skip') || navText.length < 2) continue;
      
      if (linkHref) {
        var fullLinkUrl = linkHref.startsWith('http') ? linkHref : window.location.origin + linkHref;
        if (fullLinkUrl === currentFullUrl || linkHref === currentPath || (linkHref.length > 1 && currentPath.includes(linkHref))) {
          return navText;
        }
      }
    }
    
    var activeLinks = document.querySelectorAll('nav a.active, nav a.current, .navigation a.active, .menu a.active');
    for (var j = 0; j < activeLinks.length; j++) {
      var activeText = activeLinks[j].textContent.trim();
      if (activeText && !activeText.toLowerCase().includes('skip')) return activeText;
    }
    
    if (currentPath === '/' || currentPath === '') return 'Home';
    return document.title || currentPath.replace(/\//g, '').replace(/-/g, ' ') || 'Home';
  }

  // ============================================
  // SECTION AND BLOCK INFO DETECTION
  // ============================================

  function getSectionInfo(element) {
    var parent = element;
    var depth = 0;
    
    while (parent && depth < 15) {
      if (parent.getAttribute) {
        if (parent.tagName && parent.tagName.toLowerCase() === 'section') {
          var sectionId = parent.getAttribute('data-section-id');
          if (sectionId) return 'section[data-section-id="' + sectionId + '"]';
        }
        
        var dataSectionId = parent.getAttribute('data-section-id');
        if (dataSectionId) return 'section[data-section-id="' + dataSectionId + '"]';
        
        if (parent.tagName && parent.tagName.toLowerCase() === 'section') {
          var id = parent.getAttribute('id');
          if (id) return 'section#' + id;
        }
      }
      parent = parent.parentElement;
      depth++;
    }
    return 'unknown-section';
  }

  function getBlockInfo(element) {
    var parent = element;
    var depth = 0;
    
    while (parent && depth < 20) {
      if (parent.getAttribute) {
        var id = parent.getAttribute('id');
        if (id) {
          var lowerCaseId = id.toLowerCase();
          if (lowerCaseId.startsWith('block-')) return '#' + id;
          if (id.startsWith('Block') || id.startsWith('block')) return '#' + id;
        }
      }
      parent = parent.parentElement;
      depth++;
    }
    
    parent = element;
    depth = 0;
    while (parent && depth < 20) {
      if (parent.getAttribute) {
        var dataBlockId = parent.getAttribute('data-block-id');
        if (dataBlockId) return '#block-' + dataBlockId;
        
        var blockType = parent.getAttribute('data-block-type');
        if (blockType) {
          var parentId = parent.getAttribute('id');
          if (parentId && (parentId.toLowerCase().startsWith('block-') || parentId.startsWith('Block'))) {
            return '#' + parentId;
          }
          return 'block-type-' + blockType;
        }
      }
      parent = parent.parentElement;
      depth++;
    }
    
    return 'unknown-block';
  }

  // ============================================
  // STYLE DEFINITION EXTRACTION
  // ============================================

  function getStyleDefinition(element, elementType, colorTracker, colorData) {
    try {
      var computed = window.getComputedStyle(element);
      var styleDef = [];
      
      // Track colors using ColorAnalyzer
      var bgColor = computed.backgroundColor;
      var textColor = computed.color;
      var borderColor = computed.borderColor;
      
      ColorAnalyzer.trackColor(bgColor, element, 'background-color', textColor, colorData, getSectionInfo, getBlockInfo);
      ColorAnalyzer.trackColor(textColor, element, 'color', bgColor, colorData, getSectionInfo, getBlockInfo);
      ColorAnalyzer.trackColor(borderColor, element, 'border-color', null, colorData, getSectionInfo, getBlockInfo);
      
      // Track contrast for text elements
      if (elementType === 'heading' || elementType === 'paragraph' || elementType === 'text' || elementType === 'button') {
        ColorAnalyzer.trackContrastPair(element, textColor, bgColor, colorData, getSectionInfo, getBlockInfo);
      }
      
      addColor(colorTracker, computed.backgroundColor, 'backgrounds');
      addColor(colorTracker, computed.color, 'text');
      addColor(colorTracker, computed.borderColor, 'borders');
      
      if (elementType === 'button') {
        styleDef.push('background-color: ' + computed.backgroundColor);
        styleDef.push('color: ' + computed.color);
        styleDef.push('font-family: ' + computed.fontFamily);
        styleDef.push('font-size: ' + computed.fontSize);
        styleDef.push('font-weight: ' + computed.fontWeight);
        styleDef.push('border-radius: ' + computed.borderRadius);
        styleDef.push('padding: ' + computed.padding);
        styleDef.push('border: ' + computed.border);
        if (computed.textAlign !== 'start' && computed.textAlign !== 'left') styleDef.push('text-align: ' + computed.textAlign);
        if (computed.textTransform !== 'none') styleDef.push('text-transform: ' + computed.textTransform);
      }
      else if (elementType === 'heading' || elementType === 'paragraph' || elementType === 'text') {
        styleDef.push('font-family: ' + computed.fontFamily);
        styleDef.push('font-size: ' + computed.fontSize);
        styleDef.push('font-weight: ' + computed.fontWeight);
        styleDef.push('line-height: ' + computed.lineHeight);
        styleDef.push('color: ' + computed.color);
        if (computed.textTransform !== 'none') styleDef.push('text-transform: ' + computed.textTransform);
        if (computed.letterSpacing !== 'normal' && computed.letterSpacing !== '0px') styleDef.push('letter-spacing: ' + computed.letterSpacing);
      }
      else {
        var display = computed.display;
        
        if (display !== 'inline') styleDef.push('display: ' + display);
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
          styleDef.push('background-color: ' + bgColor);
        }
      }
      
      return styleDef.join('; ');
    } catch (e) {
      return '';
    }
  }

  // ============================================
  // FONT SIZE EXTRACTION HELPER
  // ============================================

  function extractFontSize(styleDefinition) {
    if (!styleDefinition) return null;
    var match = styleDefinition.match(/font-size:\s*([0-9.]+px)/);
    return match ? match[1] : null;
  }

  // ============================================
  // COMPREHENSIVE COLOR SCANNER
  // ============================================

  /**
   * Scans ALL visible elements on the page to capture colors that might be missed
   * by element-specific analyzers (buttons, headings, paragraphs, links).
   * This ensures we capture:
   * - Section/container backgrounds
   * - Navigation element colors
   * - Decorative element colors
   * - Any other styled elements
   */
  function scanAllPageColors(colorData) {
    if (!colorData) return;

    // Get ALL elements on the page
    var allElements = document.querySelectorAll('*');

    for (var i = 0; i < allElements.length; i++) {
      var element = allElements[i];

      // Skip script, style, noscript, and other non-visual elements
      var tagName = element.tagName.toLowerCase();
      if (tagName === 'script' || tagName === 'style' || tagName === 'noscript' ||
          tagName === 'meta' || tagName === 'link' || tagName === 'head') {
        continue;
      }

      // Check if element is actually visible
      if (!ColorAnalyzer.isElementActuallyVisible(element)) {
        continue;
      }

      try {
        var computed = window.getComputedStyle(element);
        if (!computed) continue;

        var bgColor = computed.backgroundColor;
        var textColor = computed.color;
        var borderColor = computed.borderColor;

        // Track background color (ColorAnalyzer.trackColor handles its own deduplication)
        if (bgColor && !ColorAnalyzer.isTransparentColor(bgColor)) {
          ColorAnalyzer.trackColor(
            bgColor,
            element,
            'background-color',
            textColor,
            colorData,
            getSectionInfo,
            getBlockInfo
          );
        }

        // Track text color (only for elements with actual text content)
        var hasText = element.textContent && element.textContent.trim().length > 0;
        if (hasText && textColor && !ColorAnalyzer.isTransparentColor(textColor)) {
          ColorAnalyzer.trackColor(
            textColor,
            element,
            'color',
            bgColor,
            colorData,
            getSectionInfo,
            getBlockInfo
          );
        }

        // Track border color
        if (borderColor && !ColorAnalyzer.isTransparentColor(borderColor)) {
          ColorAnalyzer.trackColor(
            borderColor,
            element,
            'border-color',
            null,
            colorData,
            getSectionInfo,
            getBlockInfo
          );
        }
      } catch (e) {
        // Skip elements that cause errors
        continue;
      }
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  return {
    normalizeColor: normalizeColor,
    createColorTracker: createColorTracker,
    addColor: addColor,
    finalizeColorPalette: finalizeColorPalette,
    getNavigationName: getNavigationName,
    getSectionInfo: getSectionInfo,
    getBlockInfo: getBlockInfo,
    getStyleDefinition: getStyleDefinition,
    extractFontSize: extractFontSize,
    scanAllPageColors: scanAllPageColors
  };

})();

// Make globally available for content scripts
if (typeof window !== 'undefined') {
  window.ContentScriptHelpers = ContentScriptHelpers;
}
