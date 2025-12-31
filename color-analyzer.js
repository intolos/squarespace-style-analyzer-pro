// color-analyzer.js - Color Analysis and Tracking Module
// Single Responsibility: All color-related analysis
// Handles color conversion, tracking, contrast checking, WCAG compliance

const ColorAnalyzer = {

  // ============================================
  // COLOR CONVERSION
  // ============================================

  rgbToHex: function (rgb) {
    if (!rgb) return null;
    if (rgb.startsWith('#')) return rgb.toUpperCase();

    const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
    if (!match) return null;

    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);

    return (
      '#' +
      ((1 << 24) + (r << 16) + (g << 8) + b)
        .toString(16)
        .slice(1)
        .toUpperCase()
    );
  },

  hexToRgb: function (hex) {
    if (!hex) return null;
    hex = hex.replace('#', '');
    if (hex.length !== 6) return null;

    return {
      r: parseInt(hex.substr(0, 2), 16),
      g: parseInt(hex.substr(2, 2), 16),
      b: parseInt(hex.substr(4, 2), 16)
    };
  },

  // ============================================
  // LUMINANCE & CONTRAST
  // ============================================

  calculateLuminance: function (hexColor) {
    if (!hexColor) return 0;
    const hex = hexColor.replace('#', '');
    if (hex.length !== 6) return 0;

    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    const adjust = (val) =>
      val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);

    const R = adjust(r);
    const G = adjust(g);
    const B = adjust(b);

    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  },

  calculateContrastRatio: function (color1, color2) {
    const lum1 = this.calculateLuminance(color1);
    const lum2 = this.calculateLuminance(color2);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
  },

  // ============================================
  // WCAG COMPLIANCE
  // ============================================

  getWCAGLevel: function (ratio, isLargeText) {
    if (isLargeText) {
      if (ratio >= 4.5) return 'AAA';
      if (ratio >= 3.0) return 'AA';
      return 'Fail';
    } else {
      if (ratio >= 7.0) return 'AAA';
      if (ratio >= 4.5) return 'AA';
      return 'Fail';
    }
  },

  // ============================================
  // COLOR HELPERS
  // ============================================

  isTransparentColor: function (colorValue) {
    if (!colorValue) return true;
    const val = colorValue.toLowerCase().trim();
    return (
      val === 'transparent' ||
      val === 'rgba(0, 0, 0, 0)' ||
      val === 'inherit' ||
      val === 'initial'
    );
  },

  // Walk up the DOM to find the first solid background
  // Check if element is actually visible on the page (not hidden, off-screen, or occluded)
  isElementActuallyVisible: function (element) {
    if (!element) return false;

    // Check bounding rect (0 dimensions = not visible)
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    // Check computed styles for hidden elements
    const styles = window.getComputedStyle(element);
    if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') {
      return false;
    }

    // Check for very low opacity (effectively invisible)
    if (parseFloat(styles.opacity) < 0.01) return false;

    // Check if positioned way off-screen (like skip links hidden until focus)
    const left = rect.left;
    const top = rect.top;
    if (left < -1000 || top < -1000 || left > window.innerWidth + 1000 || top > window.innerHeight + 1000) {
      return false;
    }

    // Check if offsetParent is null (more reliable than display:none)
    if (element.offsetParent === null && element.tagName !== 'BODY' && element.tagName !== 'HTML') {
      return false;
    }

    // Test center point to check z-index occlusion
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const elementAtPoint = document.elementFromPoint(centerX, centerY);

    // Element is visible if it's at the center point or contains the element at center
    if (elementAtPoint === element || element.contains(elementAtPoint)) return true;

    // Also check if the element at point is contained by our target (for nested cases)
    if (elementAtPoint && elementAtPoint.contains(element)) return true;

    return false;
  },

  getEffectiveBackgroundColor: function (element, initialBackgroundColor) {
    if (initialBackgroundColor && !this.isTransparentColor(initialBackgroundColor)) {
      return initialBackgroundColor;
    }

    let el = element;
    while (el) {
      const style = window.getComputedStyle(el);
      const bg = style && style.backgroundColor;
      if (bg && !this.isTransparentColor(bg)) {
        return bg;
      }
      el = el.parentElement;
    }

    // Fallback: assume white if nothing else is found
    return 'rgb(255, 255, 255)';
  },

  // ============================================
  // CONTEXT / LABEL HELPERS
  // ============================================

  // Determine if element is within navigation, header, or footer
  getElementLocation: function (element) {
    let el = element;
    let depth = 0;

    while (el && depth < 15) {
      const tagName = el.tagName ? el.tagName.toLowerCase() : '';

      // Check for NAV element
      if (tagName === 'nav') return 'navigation';

      // Check for HEADER element
      if (tagName === 'header') return 'header';

      // Check for FOOTER element
      if (tagName === 'footer') return 'footer';

      // Check for common navigation classes/IDs
      const className = el.className || '';
      const id = el.id || '';
      if (className.toLowerCase().includes('nav') ||
          id.toLowerCase().includes('nav') ||
          className.toLowerCase().includes('menu')) {
        return 'navigation';
      }

      // Check for header classes/IDs
      if (className.toLowerCase().includes('header') ||
          id.toLowerCase().includes('header')) {
        return 'header';
      }

      // Check for footer classes/IDs
      if (className.toLowerCase().includes('footer') ||
          id.toLowerCase().includes('footer')) {
        return 'footer';
      }

      el = el.parentElement;
      depth++;
    }

    return 'content'; // Default to content area
  },

  // Helper: detect "ghost" / unlabeled buttons that we want to IGNORE in color analysis
  isGhostButtonForColorAnalysis: function (element) {
    const tag = element.tagName;
    const isButtonTag = tag === 'BUTTON';
    const isAnchorButton =
      tag === 'A' && element.classList && element.classList.contains('button');

    if (!isButtonTag && !isAnchorButton) return false;

    const text = (element.textContent || element.innerText || '').trim();
    const ariaLabel = element.getAttribute && element.getAttribute('aria-label');

    // If there is NO visible text and NO aria-label, treat as a ghost button
    if (!text && !ariaLabel) {
      return true;
    }

    return false;
  },

  getElementContext: function (element) {
    if (
      element.tagName === 'BUTTON' ||
      (element.tagName === 'A' && element.classList.contains('button'))
    ) {
      const buttonText = (element.textContent || element.innerText || '').trim();
      const buttonUrl = element.href || '';
      let result = 'Button: "' + buttonText.substring(0, 50) + (buttonText.length > 50 ? '...' : '') + '"';
      if (buttonUrl) {
        const displayUrl = buttonUrl.length > 60 ? buttonUrl.substring(0, 60) + '...' : buttonUrl;
        result += ' → ' + displayUrl;
      }
      return result;
    }
    if (element.tagName.match(/^H[1-6]$/)) {
      const headingText = (element.textContent || '').trim();
      return element.tagName + ': "' + headingText.substring(0, 50) + (headingText.length > 50 ? '...' : '') + '"';
    }
    if (element.tagName === 'P') {
      const fullText = (element.textContent || '').trim();
      // If the text is a URL, show the entire URL
      if (fullText.match(/^https?:\/\/[^\s]+$/)) {
        return 'Paragraph: "' + fullText + '"';
      }
      // Extract first sentence (up to first period, question mark, or exclamation)
      const sentenceMatch = fullText.match(/^[^.!?]+[.!?]/);
      const firstSentence = sentenceMatch ? sentenceMatch[0] : fullText.substring(0, 80);
      const displayText = firstSentence.length > 80 ? firstSentence.substring(0, 80) + '...' : firstSentence;
      return 'Paragraph: "' + displayText + '"';
    }
    if (element.tagName === 'A') {
      const linkText = (element.textContent || '').trim();
      const linkUrl = element.href || '';
      const displayText = linkText.substring(0, 30) + (linkText.length > 30 ? '...' : '');
      const displayUrl = linkUrl.length > 50 ? linkUrl.substring(0, 50) + '...' : linkUrl;
      return 'Link: "' + displayText + '" → ' + displayUrl;
    }
    return (
      element.tagName +
      (element.className ? '.' + element.className.split(' ')[0] : '')
    );
  },

  // ============================================
  // COLOR TRACKING
  // ============================================

  trackColor: function (
    colorValue,
    element,
    property,
    pairedColor,
    colorData,
    getSectionInfo,
    getBlockInfo
  ) {
    if (!colorValue || this.isTransparentColor(colorValue)) return;

    // Ignore ghost / unlabeled buttons in color tracking
    if (this.isGhostButtonForColorAnalysis(element)) return;

    const hex = this.rgbToHex(colorValue);
    if (!hex) return;

    if (!colorData.colors[hex]) {
      colorData.colors[hex] = {
        count: 0,
        usedAs: [],
        instances: []
      };
    }

    colorData.colors[hex].count++;

    // Determine element context by checking element and its parents
    const elementLocation = this.getElementLocation(element);

    // Add property-based categories
    if (
      property === 'background-color' &&
      !colorData.colors[hex].usedAs.includes('background')
    ) {
      colorData.colors[hex].usedAs.push('background');
    } else if (
      property === 'color' &&
      !colorData.colors[hex].usedAs.includes('text')
    ) {
      colorData.colors[hex].usedAs.push('text');
    } else if (
      property.includes('border') &&
      !colorData.colors[hex].usedAs.includes('border')
    ) {
      colorData.colors[hex].usedAs.push('border');
    }

    // Add location-based categories (navigation, header, footer)
    if (elementLocation === 'navigation' && !colorData.colors[hex].usedAs.includes('navigation')) {
      colorData.colors[hex].usedAs.push('navigation');
    } else if (elementLocation === 'header' && !colorData.colors[hex].usedAs.includes('header')) {
      colorData.colors[hex].usedAs.push('header');
    } else if (elementLocation === 'footer' && !colorData.colors[hex].usedAs.includes('footer')) {
      colorData.colors[hex].usedAs.push('footer');
    }

    colorData.colors[hex].instances.push({
      page: window.location.href,
      pageTitle: document.title || 'Unknown',
      element: element.tagName,
      property: property,
      section: getSectionInfo(element),
      block: getBlockInfo(element),
      context: this.getElementContext(element),
      location: elementLocation,
      pairedWith: pairedColor ? this.rgbToHex(pairedColor) : null
    });
  },

  // ============================================
  // CONTRAST PAIR TRACKING
  // ============================================

  trackContrastPair: function (
    element,
    textColor,
    backgroundColor,
    colorData,
    getSectionInfo,
    getBlockInfo
  ) {
    if (!element || !colorData || !textColor) return;

    // Ignore ghost / unlabeled buttons in contrast analysis
    if (this.isGhostButtonForColorAnalysis(element)) return;

    // Only check contrast for elements with DIRECT text content
    // Skip parent containers that only have inherited text from children
    let hasDirectText = false;
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      if (node.nodeType === 3 && node.textContent.trim().length > 0) {
        hasDirectText = true;
        break;
      }
    }

    // Skip if no direct text nodes (only contains child elements)
    if (!hasDirectText) return;

    const textHex = this.rgbToHex(textColor);
    if (!textHex) return;

    // Resolve effective background (handles transparent / inherited)
    const effectiveBg = this.getEffectiveBackgroundColor(element, backgroundColor);
    const bgHex = this.rgbToHex(effectiveBg);

    if (!bgHex) return;

    // Filter same-color pairs - these are always false positives
    // If text were truly the same color as background, it would be invisible
    if (textHex === bgHex) {
      return;
    }

    // Deduplicate by specific element location (not by contrast pair)
    // This prevents the same element from being recorded twice
    // but allows different elements with the same contrast issue to all be recorded
    const section = getSectionInfo(element);
    const block = getBlockInfo(element);
    const location = this.getElementContext(element);
    const elementKey = window.location.href + '|' + section + '|' + block + '|' + location;
    
    if (!colorData._processedContrastElements) {
      colorData._processedContrastElements = new Set();
    }
    
    if (colorData._processedContrastElements.has(elementKey)) {
      return;
    }
    colorData._processedContrastElements.add(elementKey);

    const ratio = this.calculateContrastRatio(textHex, bgHex);

    const computed = window.getComputedStyle(element);
    const fontSize = parseFloat(computed.fontSize) || 0;
    const fontWeight = parseInt(computed.fontWeight, 10) || 400;
    const isLargeText =
      fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
    const wcagLevel = this.getWCAGLevel(ratio, isLargeText);

    // Track ALL instances - no deduplication so user can see every location
    colorData.contrastPairs.push({
      textColor: textHex,
      backgroundColor: bgHex,
      ratio: Math.round(ratio * 100) / 100,
      passes: wcagLevel !== 'Fail',
      wcagLevel: wcagLevel,
      isLargeText: isLargeText,
      page: window.location.href,
      pageTitle: document.title || 'Unknown',
      location: location,
      section: section,
      block: block,
      element: element.tagName
    });
  },

  // ============================================
  // INITIALIZATION
  // ============================================

  initializeColorData: function () {
    return {
      colors: {},
      contrastPairs: [],
      _processedContrastElements: new Set()
    };
  }
};

// Make globally available
window.ColorAnalyzer = ColorAnalyzer;
