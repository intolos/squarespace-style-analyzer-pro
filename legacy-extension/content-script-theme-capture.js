// content-script-theme-capture.js
// Captures Squarespace theme style definitions for headings, paragraphs, and misc fonts

var ContentScriptThemeCapture = (function() {
  'use strict';

  // Helper function to get most common style for a heading type
  function getMostCommonHeadingStyle(headingElements, getStyleDefFn) {
    if (!headingElements || headingElements.length === 0) return null;
    
    var styleMap = {};
    for (var i = 0; i < headingElements.length; i++) {
      var computed = window.getComputedStyle(headingElements[i]);
      var fontFamily = computed.fontFamily;
      
      if (!styleMap[fontFamily]) {
        styleMap[fontFamily] = {
          count: 0,
          element: headingElements[i]
        };
      }
      styleMap[fontFamily].count++;
    }
    
    // Find most common font
    var maxCount = 0;
    var mostCommonElement = null;
    for (var font in styleMap) {
      if (styleMap[font].count > maxCount) {
        maxCount = styleMap[font].count;
        mostCommonElement = styleMap[font].element;
      }
    }
    
    return mostCommonElement ? getStyleDefFn(mostCommonElement, 'heading') : null;
  }

  // Main function to capture Squarespace theme styles
  function captureSquarespaceThemeStyles(colorTracker, colorData) {
    var themeStyles = {
      headingStyles: {},
      paragraphStyles: {},
      miscFont: ''
    };
    
    // Create a wrapper for getStyleDefinition that includes colorTracker and colorData
    var getStyleDefFn = function(element, elementType) {
      return ContentScriptHelpers.getStyleDefinition(element, elementType, colorTracker, colorData);
    };
    
    // Capture each heading type using most common style
    var h1Elements = document.querySelectorAll('h1');
    var h2Elements = document.querySelectorAll('h2');
    var h3Elements = document.querySelectorAll('h3');
    var h4Elements = document.querySelectorAll('h4');
    var h5Elements = document.querySelectorAll('h5');
    var h6Elements = document.querySelectorAll('h6');      
    
    if (h1Elements.length > 0) {
      themeStyles.headingStyles['heading-1'] = getMostCommonHeadingStyle(h1Elements, getStyleDefFn);
    } else {
      themeStyles.headingStyles['heading-1'] = 'Not used on the pages analyzed';
    }
    
    if (h2Elements.length > 0) {
      themeStyles.headingStyles['heading-2'] = getMostCommonHeadingStyle(h2Elements, getStyleDefFn);
    } else {
      themeStyles.headingStyles['heading-2'] = 'Not used on the pages analyzed';
    }
    
    if (h3Elements.length > 0) {
      themeStyles.headingStyles['heading-3'] = getMostCommonHeadingStyle(h3Elements, getStyleDefFn);
    } else {
      themeStyles.headingStyles['heading-3'] = 'Not used on the pages analyzed';
    }
    
    if (h4Elements.length > 0) {
      themeStyles.headingStyles['heading-4'] = getMostCommonHeadingStyle(h4Elements, getStyleDefFn);
    } else {
      themeStyles.headingStyles['heading-4'] = 'Not used on the pages analyzed';
    }
    
    if (h5Elements.length > 0) {
      themeStyles.headingStyles['heading-5'] = getMostCommonHeadingStyle(h5Elements, getStyleDefFn);
    } else {
      themeStyles.headingStyles['heading-5'] = 'Not used on the pages analyzed';
    }
    
    if (h6Elements.length > 0) {
      themeStyles.headingStyles['heading-6'] = getMostCommonHeadingStyle(h6Elements, getStyleDefFn);
    } else {
      themeStyles.headingStyles['heading-6'] = 'Not used on the pages analyzed';
    }
    
    // Capture paragraph styles by font size and context
    var allTextElements = document.querySelectorAll('p, li');
    var p1Candidates = [];
    var p2Candidates = [];
    var p3Candidates = [];
    
    for (var i = 0; i < allTextElements.length; i++) {
      var el = allTextElements[i];
      var elClass = (el.className || '').toLowerCase();
      var computed = window.getComputedStyle(el);
      var fontSize = parseFloat(computed.fontSize);
      
      // Skip if in nav/header/footer
      var parent = el;
      var inNavigation = false;
      for (var p = 0; p < 5; p++) {
        if (!parent) break;
        var parentClass = (parent.className || '').toLowerCase();
        if (parentClass.includes('nav') || parentClass.includes('header') || parentClass.includes('menu')) {
          inNavigation = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (inNavigation) continue;
      
      // Classify by matching against Squarespace's paragraph size definitions
      // P1=1.5rem (24px), P2=1.1rem (17.6px), P3=1rem (16px)
      var p1Size = 1.5 * 16;
      var p2Size = 1.1 * 16;
      var p3Size = 1.0 * 16;
      
      var distanceToP1 = Math.abs(fontSize - p1Size);
      var distanceToP2 = Math.abs(fontSize - p2Size);
      var distanceToP3 = Math.abs(fontSize - p3Size);
      
      var minDistance = Math.min(distanceToP1, distanceToP2, distanceToP3);
      if (minDistance === distanceToP1) {
        p1Candidates.push(el);
      } else if (minDistance === distanceToP3) {
        p3Candidates.push(el);
      } else {
        p2Candidates.push(el);
      }
    }
    
    // Get most common style for each paragraph type AND extract font sizes
    var paragraphSizes = {
      'paragraph-1': null,
      'paragraph-2': null,
      'paragraph-3': null
    };
    
    if (p1Candidates.length > 0) {
      themeStyles.paragraphStyles['paragraph-1'] = getMostCommonHeadingStyle(p1Candidates, getStyleDefFn);
      var firstP1 = p1Candidates[0];
      paragraphSizes['paragraph-1'] = parseFloat(window.getComputedStyle(firstP1).fontSize);
    } else {
      themeStyles.paragraphStyles['paragraph-1'] = 'Not used on the pages analyzed';
    }
    
    if (p2Candidates.length > 0) {
      themeStyles.paragraphStyles['paragraph-2'] = getMostCommonHeadingStyle(p2Candidates, getStyleDefFn);
      var firstP2 = p2Candidates[0];
      paragraphSizes['paragraph-2'] = parseFloat(window.getComputedStyle(firstP2).fontSize);
    } else if (allTextElements.length > 0) {
      // Fallback to first paragraph
      var firstP = document.querySelector('p');
      if (firstP) {
        themeStyles.paragraphStyles['paragraph-2'] = getStyleDefFn(firstP, 'paragraph');
        paragraphSizes['paragraph-2'] = parseFloat(window.getComputedStyle(firstP).fontSize);
      } else {
        themeStyles.paragraphStyles['paragraph-2'] = 'Not used on the pages analyzed';
      }
    } else {
      themeStyles.paragraphStyles['paragraph-2'] = 'Not used on the pages analyzed';
    }
    
    if (p3Candidates.length > 0) {
      themeStyles.paragraphStyles['paragraph-3'] = getMostCommonHeadingStyle(p3Candidates, getStyleDefFn);
      var firstP3 = p3Candidates[0];
      paragraphSizes['paragraph-3'] = parseFloat(window.getComputedStyle(firstP3).fontSize);
    } else {
      themeStyles.paragraphStyles['paragraph-3'] = 'Not used on the pages analyzed';
    }
    
    themeStyles.paragraphSizes = paragraphSizes;
    
    // Check for miscellaneous font in CSS variables
    var root = document.documentElement;
    var computedStyle = window.getComputedStyle(root);
    var miscFont = computedStyle.getPropertyValue('--misc-font') || 
                   computedStyle.getPropertyValue('--miscellaneous-font') ||
                   computedStyle.getPropertyValue('--font-misc') ||
                   computedStyle.getPropertyValue('--sqs-misc-font');
    
    if (miscFont) {
      miscFont = miscFont.trim();
      themeStyles.miscFont = miscFont;
      
      // Try to find an element using this font to get full style definition
      var allElements = document.querySelectorAll('span, div, p, a, li, button');
      for (var i = 0; i < allElements.length; i++) {
        var el = allElements[i];
        var elComputed = window.getComputedStyle(el);
        var elFontFamily = elComputed.fontFamily;
        
        // Check if this element uses the misc font
        if (elFontFamily && miscFont && elFontFamily.toLowerCase().includes(miscFont.toLowerCase().split(',')[0].trim().replace(/['"]/g, ''))) {
          // Found an element using misc font - capture full style
          var miscStyleDef = [];
          miscStyleDef.push('font-family: ' + elComputed.fontFamily);
          miscStyleDef.push('font-size: ' + elComputed.fontSize);
          miscStyleDef.push('font-weight: ' + elComputed.fontWeight);
          miscStyleDef.push('line-height: ' + elComputed.lineHeight);
          miscStyleDef.push('color: ' + elComputed.color);
          if (elComputed.textTransform !== 'none') miscStyleDef.push('text-transform: ' + elComputed.textTransform);
          if (elComputed.letterSpacing !== 'normal' && elComputed.letterSpacing !== '0px') miscStyleDef.push('letter-spacing: ' + elComputed.letterSpacing);
          
          themeStyles.miscFontStyle = miscStyleDef.join('; ');
          break;
        }
      }
    }
    
    return themeStyles;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  return {
    captureSquarespaceThemeStyles: captureSquarespaceThemeStyles
  };

})();

// Make globally available for content scripts
if (typeof window !== 'undefined') {
  window.ContentScriptThemeCapture = ContentScriptThemeCapture;
}
