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

    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
  },

  hexToRgb: function (hex) {
    if (!hex) return null;
    hex = hex.replace('#', '');
    if (hex.length !== 6) return null;

    return {
      r: parseInt(hex.substr(0, 2), 16),
      g: parseInt(hex.substr(2, 2), 16),
      b: parseInt(hex.substr(4, 2), 16),
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

    const adjust = val => (val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4));

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
      val === 'transparent' || val === 'rgba(0, 0, 0, 0)' || val === 'inherit' || val === 'initial'
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
    if (
      left < -1000 ||
      top < -1000 ||
      left > window.innerWidth + 1000 ||
      top > window.innerHeight + 1000
    ) {
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

  /**
   * Get effective background color for an element
   * Priority: solid background > screenshot sampling > DOM fallback > white
   *
   * @param {Element} element - The DOM element to check
   * @param {string} initialBackgroundColor - Direct background color from computed styles
   * @param {string} screenshot - Base64 data URL of page screenshot (for pixel sampling)
   * @returns {Promise<string>} RGB/RGBA color string
   */
  getEffectiveBackgroundColor: async function (element, initialBackgroundColor, screenshot) {
    // If element has a solid background color, use it (fastest and accurate)
    if (initialBackgroundColor && !this.isTransparentColor(initialBackgroundColor)) {
      return initialBackgroundColor;
    }

    // First, get DOM-based background (standard method)
    let domBackground = null;
    let el = element;
    while (el) {
      const style = window.getComputedStyle(el);
      const bg = style && style.backgroundColor;
      if (bg && !this.isTransparentColor(bg)) {
        domBackground = bg;
        break;
      }
      el = el.parentElement;
    }

    // If no DOM background found, assume white
    if (!domBackground) {
      domBackground = 'rgb(255, 255, 255)';
    }

    // For buttons, ALWAYS use screenshot to verify against background images
    // This catches cases where background images are on ancestor elements
    const tagName = element.tagName.toLowerCase();
    const isButton = tagName === 'button' || tagName === 'a' || tagName === 'input';
    const hasButtonRole = element.getAttribute('role') === 'button';
    const hasButtonClass = (element.className || '').toLowerCase().includes('button');
    const isButtonLike = isButton || hasButtonRole || hasButtonClass;

    if (isButtonLike && screenshot) {
      try {
        const screenshotBg = await this.getBackgroundColorFromCanvas(element, screenshot);
        if (screenshotBg && !this.isTransparentColor(screenshotBg)) {
          // Compare screenshot color to DOM color
          const domHex = this.rgbToHex(domBackground);
          const screenshotHex = this.rgbToHex(screenshotBg);

          // If they differ significantly, screenshot is more accurate (catches background images)
          if (domHex !== screenshotHex) {
            console.log(
              'Button screenshot BG:',
              screenshotBg,
              'vs DOM BG:',
              domBackground,
              'for',
              element.textContent.trim().substring(0, 30)
            );
            return screenshotBg;
          }
        }
      } catch (e) {
        console.warn('Screenshot sampling failed for button, using DOM:', e);
      }
    }

    // Return DOM-detected background
    return domBackground;
  },

  /**
   * Get background color using screenshot pixel sampling
   * This is the MOST ACCURATE method - matches WAVE tool exactly
   * Handles background images, gradients, overlapping elements, and all visual effects
   *
   * @param {Element} element - The DOM element to check
   * @param {string} screenshot - Base64 data URL of page screenshot
   * @returns {Promise<string|null>} RGBA color string, or null if detection fails
   *
   * Why screenshot-based: Only method that captures actual visual representation
   * including background images, gradients, complex overlays, etc.
   * Uses chrome.tabs.captureVisibleTab() - same technique as WAVE tool
   */
  getBackgroundColorFromCanvas: async function (element, screenshot) {
    const rect = element.getBoundingClientRect();

    // Skip if element not visible
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    // If no screenshot provided, cannot do pixel sampling
    if (!screenshot) {
      console.warn('No screenshot provided for pixel sampling');
      return null;
    }

    try {
      // Create canvas and load screenshot
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = screenshot;
      });

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Calculate element center in viewport coordinates
      // Account for device pixel ratio (retina displays, etc.)
      const devicePixelRatio = window.devicePixelRatio || 1;
      const centerX = Math.floor((rect.left + rect.width / 2) * devicePixelRatio);
      const centerY = Math.floor((rect.top + rect.height / 2) * devicePixelRatio);

      // Sample pixels around center (5x5 grid for robustness)
      // This handles anti-aliasing and slight variations
      const sampleSize = 5;
      const halfSize = Math.floor(sampleSize / 2);
      const colors = [];

      for (let dx = -halfSize; dx <= halfSize; dx++) {
        for (let dy = -halfSize; dy <= halfSize; dy++) {
          const x = centerX + dx;
          const y = centerY + dy;

          if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            colors.push({
              r: pixel[0],
              g: pixel[1],
              b: pixel[2],
              a: pixel[3] / 255,
            });
          }
        }
      }

      // Average the sampled colors for robust result
      if (colors.length === 0) {
        return null;
      }

      const avgR = Math.round(colors.reduce((sum, c) => sum + c.r, 0) / colors.length);
      const avgG = Math.round(colors.reduce((sum, c) => sum + c.g, 0) / colors.length);
      const avgB = Math.round(colors.reduce((sum, c) => sum + c.b, 0) / colors.length);
      const avgA = colors.reduce((sum, c) => sum + c.a, 0) / colors.length;

      return `rgba(${avgR}, ${avgG}, ${avgB}, ${avgA})`;
    } catch (error) {
      console.error('Canvas pixel sampling failed:', error);
      return null;
    }
  },

  // ============================================
  // CONTEXT / LABEL HELPERS
  // ============================================

  // Determine if element is within navigation, header, or footer
  getElementLocation: function (element) {
    // First check if element is inside a content block/section
    // These should NOT be counted as header even if inside <header> tag
    let checkContent = element;
    let contentDepth = 0;
    while (checkContent && contentDepth < 10) {
      const className = checkContent.className || '';
      const classLower = (typeof className === 'string' ? className : '').toLowerCase();

      // Skip elements that are content blocks or sections (even if inside header tag)
      if (
        classLower.includes('sqs-block') ||
        classLower.includes('section-border') ||
        classLower.includes('section-background') ||
        classLower.includes('-content') ||
        classLower.includes('page-section') ||
        classLower.includes('hero') ||
        classLower.includes('banner') ||
        classLower.includes('page-title') ||
        classLower.includes('intro')
      ) {
        return 'content'; // Treat as body content, not header
      }

      // Skip accessibility elements (usually hidden)
      if (
        classLower.includes('skip-link') ||
        classLower.includes('sr-only') ||
        classLower.includes('visually-hidden')
      ) {
        return 'content'; // Don't count as header
      }

      checkContent = checkContent.parentElement;
      contentDepth++;
    }

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
      if (
        className.toLowerCase().includes('nav') ||
        id.toLowerCase().includes('nav') ||
        className.toLowerCase().includes('menu')
      ) {
        return 'navigation';
      }

      // Check for header classes/IDs
      if (className.toLowerCase().includes('header') || id.toLowerCase().includes('header')) {
        return 'header';
      }

      // Check for footer classes/IDs
      if (className.toLowerCase().includes('footer') || id.toLowerCase().includes('footer')) {
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
    const isAnchorButton = tag === 'A' && element.classList && element.classList.contains('button');

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
      let result =
        'Button: "' + buttonText.substring(0, 50) + (buttonText.length > 50 ? '...' : '') + '"';
      if (buttonUrl) {
        const displayUrl = buttonUrl.length > 60 ? buttonUrl.substring(0, 60) + '...' : buttonUrl;
        result += ' → ' + displayUrl;
      }
      return result;
    }
    if (element.tagName.match(/^H[1-6]$/)) {
      const headingText = (element.textContent || '').trim();
      return (
        element.tagName +
        ': "' +
        headingText.substring(0, 50) +
        (headingText.length > 50 ? '...' : '') +
        '"'
      );
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
      const displayText =
        firstSentence.length > 80 ? firstSentence.substring(0, 80) + '...' : firstSentence;
      return 'Paragraph: "' + displayText + '"';
    }
    if (element.tagName === 'A') {
      const linkText = (element.textContent || '').trim();
      const linkUrl = element.href || '';
      const displayText = linkText.substring(0, 30) + (linkText.length > 30 ? '...' : '');
      const displayUrl = linkUrl.length > 50 ? linkUrl.substring(0, 50) + '...' : linkUrl;
      return 'Link: "' + displayText + '" → ' + displayUrl;
    }
    return element.tagName + (element.className ? '.' + element.className.split(' ')[0] : '');
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

    // Add to DevTools CSS Overview format Sets
    if (colorData.allColors) {
      colorData.allColors.add(hex);

      if (property === 'background-color' && colorData.backgroundColors) {
        colorData.backgroundColors.add(hex);
      } else if (property === 'color' && colorData.textColors) {
        colorData.textColors.add(hex);
      } else if ((property === 'fill' || property === 'stroke') && colorData.fillColors) {
        colorData.fillColors.add(hex);
      } else if (property === 'border-color' && colorData.borderColors) {
        colorData.borderColors.add(hex);
      }
    }

    if (!colorData.colors[hex]) {
      colorData.colors[hex] = {
        count: 0,
        usedAs: [],
        instances: [],
      };
    }

    colorData.colors[hex].count++;

    // Add property-based categories (DevTools CSS Overview format)
    if (property === 'background-color' && !colorData.colors[hex].usedAs.includes('background')) {
      colorData.colors[hex].usedAs.push('background');
    } else if (property === 'color' && !colorData.colors[hex].usedAs.includes('text')) {
      colorData.colors[hex].usedAs.push('text');
    } else if (
      (property === 'fill' || property === 'stroke') &&
      !colorData.colors[hex].usedAs.includes('fill')
    ) {
      colorData.colors[hex].usedAs.push('fill');
    } else if (property === 'border-color' && !colorData.colors[hex].usedAs.includes('border')) {
      colorData.colors[hex].usedAs.push('border');
    }

    colorData.colors[hex].instances.push({
      page: window.location.href,
      pageTitle: document.title || 'Unknown',
      element: element.tagName,
      property: property,
      section: getSectionInfo(element),
      block: getBlockInfo(element),
      context: this.getElementContext(element),
      pairedWith: pairedColor ? this.rgbToHex(pairedColor) : null,
    });
  },

  // ============================================
  // CONTRAST PAIR TRACKING
  // ============================================

  /**
   * Track WCAG contrast pair for an element
   * Uses screenshot-based background detection for maximum accuracy
   *
   * @param {Element} element - The DOM element to check
   * @param {string} textColor - RGB text color
   * @param {string} backgroundColor - RGB background color
   * @param {Object} colorData - Color tracking data structure
   * @param {Function} getSectionInfo - Function to get section identifier
   * @param {Function} getBlockInfo - Function to get block identifier
   * @param {string} screenshot - Base64 data URL of page screenshot
   * @returns {Promise<void>}
   */
  trackContrastPair: async function (
    element,
    textColor,
    backgroundColor,
    colorData,
    getSectionInfo,
    getBlockInfo,
    screenshot
  ) {
    if (!element || !colorData || !textColor) return;

    // Ignore ghost / unlabeled buttons in contrast analysis
    if (this.isGhostButtonForColorAnalysis(element)) return;

    // Check if element has meaningful text content
    // For buttons: Accept direct text OR text in immediate children (common pattern: <a><span>Buy</span></a>)
    // For other elements: Only accept DIRECT text to avoid checking parent containers
    const tagName = element.tagName.toLowerCase();
    const isButton = tagName === 'button' || tagName === 'a' || tagName === 'input';
    const hasButtonRole = element.getAttribute('role') === 'button';
    const hasButtonClass = (element.className || '').toLowerCase().includes('button');
    const isButtonLike = isButton || hasButtonRole || hasButtonClass;

    let hasDirectText = false;

    if (isButtonLike) {
      // For buttons: Check if there's ANY visible text (direct or in children)
      const text = element.textContent.trim();
      if (text.length > 0) {
        hasDirectText = true;
      }
    } else {
      // For non-buttons: Only check for DIRECT text nodes
      for (let i = 0; i < element.childNodes.length; i++) {
        const node = element.childNodes[i];
        if (node.nodeType === 3 && node.textContent.trim().length > 0) {
          hasDirectText = true;
          break;
        }
      }
    }

    // Skip if no text content
    if (!hasDirectText) return;

    const textHex = this.rgbToHex(textColor);
    if (!textHex) return;

    // Resolve effective background using screenshot pixel sampling (most accurate)
    const effectiveBg = await this.getEffectiveBackgroundColor(
      element,
      backgroundColor,
      screenshot
    );
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
    const rect = element.getBoundingClientRect();

    const computed = window.getComputedStyle(element);
    const fontSize = parseFloat(computed.fontSize) || 0;
    const fontWeight = parseInt(computed.fontWeight, 10) || 400;
    const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
    const wcagLevel = this.getWCAGLevel(ratio, isLargeText);

    // Track ALL instances - no deduplication so user can see every location
    const issue = {
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
      element: element.tagName,
      coords: {
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      },
      selector: ContentScriptHelpers.generateSelector(element),
    };

    colorData.contrastPairs.push(issue);
    return issue;
  },

  // ============================================
  // INITIALIZATION
  // ============================================

  initializeColorData: function () {
    return {
      colors: {},
      contrastPairs: [],
      _processedContrastElements: new Set(),
      // DevTools CSS Overview format - separate Sets for each property type
      backgroundColors: new Set(),
      textColors: new Set(),
      fillColors: new Set(),
      borderColors: new Set(),
      allColors: new Set(),
    };
  },

  // ============================================
  // DEVTOOLS FORMAT CONVERSION
  // ============================================

  /**
   * Convert color Sets to DevTools CSS Overview format
   * Returns object matching Chrome DevTools CSS Overview tab structure
   */
  getDevToolsColorSummary: function (colorData) {
    return {
      summary: {
        count: colorData.allColors ? colorData.allColors.size : 0,
        colors: colorData.allColors ? Array.from(colorData.allColors).sort() : [],
      },
      background: {
        count: colorData.backgroundColors ? colorData.backgroundColors.size : 0,
        colors: colorData.backgroundColors ? Array.from(colorData.backgroundColors).sort() : [],
      },
      text: {
        count: colorData.textColors ? colorData.textColors.size : 0,
        colors: colorData.textColors ? Array.from(colorData.textColors).sort() : [],
      },
      fill: {
        count: colorData.fillColors ? colorData.fillColors.size : 0,
        colors: colorData.fillColors ? Array.from(colorData.fillColors).sort() : [],
      },
      border: {
        count: colorData.borderColors ? colorData.borderColors.size : 0,
        colors: colorData.borderColors ? Array.from(colorData.borderColors).sort() : [],
      },
    };
  },
};

// Make globally available
window.ColorAnalyzer = ColorAnalyzer;
