// content-script-helpers.js
// DOM helper functions and color tracking utilities for content script analysis

var ContentScriptHelpers = (function () {
  'use strict';

  // Set to true for verbose console logging during development
  const DEBUG_CSH = false;
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
      all: new Set(),
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
      all: Array.from(colorTracker.all),
    };
  }

  // ============================================
  // ICON & SOCIAL MEDIA DETECTION
  // ============================================

  function isIconOrSocialElement(element) {
    if (!element) return false;

    try {
      // Universal approach: Check semantic attributes (any framework)
      var role = element.getAttribute('role');
      var ariaLabel = element.getAttribute('aria-label');

      // Elements with role="img" are often icons/decorative
      if (role === 'img') {
        return true;
      }

      // Check element itself and ancestors for common patterns
      var checkElement = element;
      var depth = 0;
      while (checkElement && depth < 3) {
        var className = checkElement.className || '';
        var classLower = (typeof className === 'string' ? className : '').toLowerCase();

        // Generic icon/social indicators (framework-agnostic)
        if (
          classLower.includes('icon') ||
          classLower.includes('social') ||
          classLower.includes('share') ||
          classLower.includes('badge') ||
          classLower.includes('avatar')
        ) {
          return true;
        }

        // Social sharing services (ShareThis, AddThis, AddToAny, etc.)
        if (
          classLower.includes('st-btn') ||
          classLower.includes('st_btn') ||
          classLower.includes('sharethis') ||
          classLower.includes('addthis') ||
          classLower.includes('a2a') ||
          classLower.includes('addtoany')
        ) {
          return true;
        }

        checkElement = checkElement.parentElement;
        depth++;
      }

      // Check if element is SVG or inside SVG (universal - SVGs often used for icons)
      if (
        element.tagName === 'svg' ||
        element.tagName === 'SVG' ||
        element.closest('svg') ||
        element.ownerSVGElement
      ) {
        // SVGs ≤64px are typically icons
        var rect = element.getBoundingClientRect();
        if ((rect.width > 0 && rect.width <= 64) || (rect.height > 0 && rect.height <= 64)) {
          return true;
        }
      }

      // Check for small elements (icons, buttons, badges, decorative elements)
      // Increased from 32px to 64px to catch more icon buttons and social buttons
      var computed = window.getComputedStyle(element);
      var width = parseFloat(computed.width);
      var height = parseFloat(computed.height);

      // Both dimensions must be ≤64px to be considered an icon/decorative element
      if (width > 0 && width <= 64 && height > 0 && height <= 64) {
        return true; // Any small element is likely decorative/icon
      }

      // Check for background-image on small elements (often used for icons/badges)
      if (computed.backgroundImage && computed.backgroundImage !== 'none') {
        if ((width > 0 && width <= 64) || (height > 0 && height <= 64)) {
          return true;
        }
      }
    } catch (e) {
      // If we can't determine, don't exclude it
      return false;
    }

    return false;
  }

  // ============================================
  // NAVIGATION NAME DETECTION
  // ============================================

  function getNavigationName() {
    var navLinks = document.querySelectorAll(
      'nav a[href], .navigation a[href], .menu a[href], [class*="nav"] a[href], header a[href]'
    );
    var currentPath = window.location.pathname;
    var currentFullUrl = window.location.href;

    for (var i = 0; i < navLinks.length; i++) {
      var link = navLinks[i];
      var linkHref = link.getAttribute('href');
      var navText = link.textContent.trim();

      if (!navText || navText.toLowerCase().includes('skip') || navText.length < 2) continue;

      if (linkHref) {
        var fullLinkUrl = linkHref.startsWith('http')
          ? linkHref
          : window.location.origin + linkHref;
        if (
          fullLinkUrl === currentFullUrl ||
          linkHref === currentPath ||
          (linkHref.length > 1 && currentPath.includes(linkHref))
        ) {
          return navText;
        }
      }
    }

    var activeLinks = document.querySelectorAll(
      'nav a.active, nav a.current, .navigation a.active, .menu a.active'
    );
    for (var j = 0; j < activeLinks.length; j++) {
      var activeText = activeLinks[j].textContent.trim();
      if (activeText && !activeText.toLowerCase().includes('skip')) return activeText;
    }

    if (currentPath === '/' || currentPath === '') return 'Home';
    return document.title || currentPath.replace(/\//g, '').replace(/-/g, ' ') || 'Home';
  }

  // Helper: Check if an ID or class name appears to be dynamically generated (unstable across page reloads)
  function isDynamicId(id) {
    if (DEBUG_CSH) console.log('[SSA isDynamicId] Called with:', id);
    if (!id) return false;

    // Common patterns for dynamic IDs/classes:
    // - Contains timestamps (sequences of 10+ digits)
    // - Starts with common framework prefixes + numbers/timestamps
    // - Contains UUIDs or random strings
    // - Common dynamic state classes

    // Squarespace: yui_3_17_2_1_1768298935906_135
    if (/^yui_/.test(id)) return true;

    // React: react-id-123, __react_123
    if (/^(react-|__react)/.test(id)) return true;

    // Angular: ng-123, _ngcontent-123
    if (/^(ng-|_ngcontent-)/.test(id)) return true;

    // Vue: v-123, data-v-123
    if (/^(v-\w+|data-v-)/.test(id)) return true;

    // Generic: Contains long number sequences (likely timestamps)
    if (/\d{10,}/.test(id)) return true;

    // Generic: Ends with long random-looking strings (abc123def456)
    if (/[a-f0-9]{8,}$/i.test(id)) return true;

    // Common dynamic state classes (added/removed by JavaScript)
    var dynamicStateClasses = [
      'loaded',
      'loading',
      'active',
      'inactive',
      'visible',
      'hidden',
      'open',
      'closed',
      'expanded',
      'collapsed',
      'selected',
      'disabled',
      'focused',
      'hover',
      'error',
      'success',
      'warning',
      'current',
      'show',
      'hide',
      'in',
      'out',
      'on',
      'off',
      'fade',
      'fadeIn',
      'fadeOut',
    ];
    if (dynamicStateClasses.includes(id.toLowerCase())) return true;

    return false;
  }

  function generateSelector(element) {
    if (!element) return '';

    try {
      // Step 1: Use ID if truly unique and stable (not dynamically generated)
      if (element.id && typeof element.id === 'string') {
        const id = element.id.trim();
        console.log(
          '[SSA generateSelector] Checking element ID:',
          id,
          'isDynamic?',
          isDynamicId(id)
        );
        if (
          id &&
          !id.includes(' ') &&
          !isDynamicId(id) &&
          document.querySelectorAll('#' + CSS.escape(id)).length === 1
        ) {
          if (DEBUG_CSH) console.log('[SSA generateSelector] Using stable ID:', id);
          return '#' + CSS.escape(id);
        } else if (isDynamicId(id)) {
          if (DEBUG_CSH) console.log('[SSA generateSelector] Rejected dynamic ID at step 1:', id);
        }
      }

      // Step 2: Build path
      var path = [];
      var current = element;

      while (
        current &&
        current.nodeType === 1 &&
        current.tagName.toLowerCase() !== 'html' &&
        current.tagName.toLowerCase() !== 'body'
      ) {
        var nodeName = current.tagName.toLowerCase();
        var selector = nodeName;

        // Check if this element has a stable ID
        var hasStableId = false;
        if (
          current.id &&
          typeof current.id === 'string' &&
          !isDynamicId(current.id) &&
          !current.id.includes(' ')
        ) {
          if (DEBUG_CSH) console.log('[SSA generateSelector] Adding stable ID to path:', current.id);
          selector += '#' + CSS.escape(current.id);
          hasStableId = true;
        } else {
          // Debug: Log if we're skipping a dynamic ID
          if (current.id && isDynamicId(current.id)) {
            console.log(
              '[SSA generateSelector] Skipping dynamic ID in path:',
              current.id,
              'for element:',
              current.tagName
            );
          }
          // No stable ID - add first stable class
          if (current.className && typeof current.className === 'string') {
            var classes = current.className
              .trim()
              .split(/\s+/)
              .filter(function (c) {
                // Filter out pseudo-class selectors, dynamic classes, and empty strings
                return c.length > 0 && !c.includes(':') && !isDynamicId(c); // Use same dynamic detection for classes
              });
            if (classes.length > 0) {
              selector += '.' + CSS.escape(classes[0]);
            }
          }

          // Add nth-of-type if not unique
          var siblings = current.parentElement ? current.parentElement.children : [];
          var sameTagSiblings = Array.from(siblings).filter(s => s.tagName === current.tagName);
          if (sameTagSiblings.length > 1) {
            var index = sameTagSiblings.indexOf(current) + 1;
            selector += ':nth-of-type(' + index + ')';
          }
        }

        path.unshift(selector);
        if (DEBUG_CSH) console.log('[SSA generateSelector] Current path:', path.join(' > '));

        // Check if selector is unique
        var isUnique = document.querySelectorAll(path.join(' > ')).length === 1;
        if (isUnique) {
          if (DEBUG_CSH) console.log('[SSA generateSelector] Found unique selector:', path.join(' > '));
          break;
        }

        // If we found a stable ID but it's not unique enough, continue up the tree
        // But if the ID is stable and the path including it IS unique, we already broke above
        current = current.parentElement;
      }

      const finalSelector = path.join(' > ');
      if (DEBUG_CSH) console.log('[SSA generateSelector] Final selector:', finalSelector);
      return finalSelector;
    } catch (e) {
      return element.tagName.toLowerCase();
    }
  }

  // ============================================
  // SECTION AND BLOCK INFO DETECTION
  // ============================================

  function getSectionInfo(element) {
    if (!element) return 'Main Content';

    var parent = element;
    var depth = 0;
    while (parent && depth < 15) {
      if (parent.getAttribute) {
        var tagName = parent.tagName ? parent.tagName.toLowerCase() : '';
        var id = parent.id || '';
        var className = (
          typeof parent.className === 'string' ? parent.className : ''
        ).toLowerCase();

        // Priority 1: Semantic zones
        if (tagName === 'header' || className.includes('header') || id.includes('header'))
          return 'Header';
        if (tagName === 'footer' || className.includes('footer') || id.includes('footer'))
          return 'Footer';
        if (tagName === 'nav' || className.includes('nav') || id.includes('navigation'))
          return 'Navigation';

        // Priority 2: Squarespace specific data (still useful for SQS sites)
        var sqsSection = parent.getAttribute('data-section-id');
        if (sqsSection) return 'Section (' + sqsSection.substring(0, 8) + '...)';

        // Priority 3: Generic section indicators
        if (tagName === 'section' || id.includes('section') || className.includes('section')) {
          if (id && !id.startsWith('yui_')) return 'Section #' + id;
          return 'Section';
        }
      }
      parent = parent.parentElement;
      depth++;
    }
    return 'Main Content';
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
          if (
            parentId &&
            (parentId.toLowerCase().startsWith('block-') || parentId.startsWith('Block'))
          ) {
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

  async function getStyleDefinition(element, elementType, colorTracker, colorData) {
    try {
      var computed = window.getComputedStyle(element);
      var styleDef = [];

      // Skip color tracking for icons and social media elements
      var isIcon = isIconOrSocialElement(element);

      // Skip color tracking for non-visible elements (hidden dropdowns, mobile menus, etc.)
      var rect = element.getBoundingClientRect();
      var hasVisibleDimensions = rect.width > 0 && rect.height > 0;
      var isDisplayed = computed.display !== 'none';
      var isVisible = computed.visibility !== 'hidden';
      var hasOpacity = parseFloat(computed.opacity) > 0;
      var isElementVisible = hasVisibleDimensions && isDisplayed && isVisible && hasOpacity;

      if (!isIcon && isElementVisible) {
        // Mark this element as processed so scanAllPageColors skips it
        if (colorData._processedElements) {
          colorData._processedElements.add(element);
        }

        // Track colors using ColorAnalyzer
        var bgColor = computed.backgroundColor;
        var textColor = computed.color;

        ColorAnalyzer.trackColor(
          bgColor,
          element,
          'background-color',
          textColor,
          colorData,
          getSectionInfo,
          getBlockInfo
        );
        ColorAnalyzer.trackColor(
          textColor,
          element,
          'color',
          bgColor,
          colorData,
          getSectionInfo,
          getBlockInfo
        );

        // Track border colors (check all four sides individually, matching Chrome DevTools CSS Overview)
        var borderSides = [
          { color: computed.borderTopColor, width: parseFloat(computed.borderTopWidth) || 0 },
          { color: computed.borderRightColor, width: parseFloat(computed.borderRightWidth) || 0 },
          { color: computed.borderBottomColor, width: parseFloat(computed.borderBottomWidth) || 0 },
          { color: computed.borderLeftColor, width: parseFloat(computed.borderLeftWidth) || 0 },
        ];

        var trackedBorderColors = new Set();
        borderSides.forEach(function (side) {
          if (
            side.color &&
            !ColorAnalyzer.isTransparentColor(side.color) &&
            side.width > 0 &&
            !trackedBorderColors.has(side.color)
          ) {
            trackedBorderColors.add(side.color);
            ColorAnalyzer.trackColor(
              side.color,
              element,
              'border-color',
              null,
              colorData,
              getSectionInfo,
              getBlockInfo
            );
          }
        });

        // Track contrast for text elements (using screenshot for accurate background detection)
        if (
          elementType === 'heading' ||
          elementType === 'paragraph' ||
          elementType === 'text' ||
          elementType === 'button'
        ) {
          await ColorAnalyzer.trackContrastPair(
            element,
            textColor,
            bgColor,
            colorData,
            getSectionInfo,
            getBlockInfo
          );
        }

        // Track in legacy colorTracker too (for backwards compatibility)
        addColor(colorTracker, computed.backgroundColor, 'backgrounds');
        addColor(colorTracker, computed.color, 'text');
        // For borders, track individual side colors
        borderSides.forEach(function (side) {
          if (side.color && !ColorAnalyzer.isTransparentColor(side.color) && side.width > 0) {
            addColor(colorTracker, side.color, 'borders');
          }
        });
      }

      if (elementType === 'button') {
        styleDef.push('background-color: ' + computed.backgroundColor);
        styleDef.push('color: ' + computed.color);
        styleDef.push('font-family: ' + computed.fontFamily);
        styleDef.push('font-size: ' + computed.fontSize);
        styleDef.push('font-weight: ' + computed.fontWeight);
        styleDef.push('border-radius: ' + computed.borderRadius);
        styleDef.push('padding: ' + computed.padding);
        styleDef.push('border: ' + computed.border);
        if (computed.textAlign !== 'start' && computed.textAlign !== 'left')
          styleDef.push('text-align: ' + computed.textAlign);
        if (computed.textTransform !== 'none')
          styleDef.push('text-transform: ' + computed.textTransform);
      } else if (
        elementType === 'heading' ||
        elementType === 'paragraph' ||
        elementType === 'text'
      ) {
        styleDef.push('font-family: ' + computed.fontFamily);
        styleDef.push('font-size: ' + computed.fontSize);
        styleDef.push('font-weight: ' + computed.fontWeight);
        styleDef.push('line-height: ' + computed.lineHeight);
        styleDef.push('color: ' + computed.color);
        if (computed.textTransform !== 'none')
          styleDef.push('text-transform: ' + computed.textTransform);
        if (computed.letterSpacing !== 'normal' && computed.letterSpacing !== '0px')
          styleDef.push('letter-spacing: ' + computed.letterSpacing);
      } else {
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
      if (
        tagName === 'script' ||
        tagName === 'style' ||
        tagName === 'noscript' ||
        tagName === 'meta' ||
        tagName === 'link' ||
        tagName === 'head'
      ) {
        continue;
      }

      try {
        var computed = window.getComputedStyle(element);
        if (!computed) continue;

        // Get bounding rect to check visibility
        var rect = element.getBoundingClientRect();
        var hasVisibleDimensions = rect.width > 0 && rect.height > 0;

        // Check basic computed style visibility
        var isDisplayed = computed.display !== 'none';
        var isVisible = computed.visibility !== 'hidden';
        var hasOpacity = parseFloat(computed.opacity) > 0;

        // Element is considered visible if it has dimensions and basic visibility
        var isElementVisible = hasVisibleDimensions && isDisplayed && isVisible && hasOpacity;

        // Special handling for footer elements - be more lenient with visibility checks
        var isInFooter = false;
        var parent = element;
        var depth = 0;
        while (parent && depth < 10) {
          var parentTag = parent.tagName ? parent.tagName.toLowerCase() : '';
          var parentClass = parent.className || '';
          var parentId = parent.id || '';
          if (
            parentTag === 'footer' ||
            parentClass.toLowerCase().includes('footer') ||
            parentId.toLowerCase().includes('footer')
          ) {
            isInFooter = true;
            break;
          }
          parent = parent.parentElement;
          depth++;
        }

        // For footer elements, check if they're on the page even if off-screen
        if (isInFooter && hasVisibleDimensions && isDisplayed && isVisible) {
          isElementVisible = true;
        }

        if (!isElementVisible) {
          continue;
        }

        // Skip elements already processed by getStyleDefinition() to avoid duplicate tracking
        if (colorData._processedElements && colorData._processedElements.has(element)) {
          continue;
        }

        // Skip icons and social media elements
        if (isIconOrSocialElement(element)) {
          continue;
        }

        // Helper function to check if a color is explicitly set (not inherited)
        function isColorExplicitlySet(element, property) {
          // Get inline style
          var inlineStyle = element.style[property];
          if (inlineStyle && inlineStyle !== '') return true;

          // Check if element has any class or ID that might set this color
          // If element has no class and no ID, color is likely inherited
          if (!element.className && !element.id) return false;

          return true; // Assume explicitly set if element has styling hooks
        }

        var bgColor = computed.backgroundColor;
        var textColor = computed.color;
        var borderColor = computed.borderColor;

        // Track background color (only if explicitly set or element has visible dimensions suggesting it's meaningful)
        if (bgColor && !ColorAnalyzer.isTransparentColor(bgColor)) {
          // Only track if background is likely explicitly set (has classes/ID) or is a significant container
          var hasSignificantSize = rect.width > 100 || rect.height > 100;
          if (
            isColorExplicitlySet(element, 'backgroundColor') ||
            hasSignificantSize ||
            element.style.backgroundColor
          ) {
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
        }

        // Track text color (only for leaf elements with direct text, not containers)
        var hasDirectTextNode = false;
        for (var j = 0; j < element.childNodes.length; j++) {
          if (
            element.childNodes[j].nodeType === 3 &&
            element.childNodes[j].textContent.trim().length > 0
          ) {
            hasDirectTextNode = true;
            break;
          }
        }

        if (hasDirectTextNode && textColor && !ColorAnalyzer.isTransparentColor(textColor)) {
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

        // Track border colors (check all four sides individually, matching Chrome DevTools CSS Overview)
        // Only track if border width > 0 on that side
        var borderSides = [
          { color: computed.borderTopColor, width: parseFloat(computed.borderTopWidth) || 0 },
          { color: computed.borderRightColor, width: parseFloat(computed.borderRightWidth) || 0 },
          { color: computed.borderBottomColor, width: parseFloat(computed.borderBottomWidth) || 0 },
          { color: computed.borderLeftColor, width: parseFloat(computed.borderLeftWidth) || 0 },
        ];

        var trackedBorderColors = new Set(); // Prevent duplicate tracking of same color
        borderSides.forEach(function (side) {
          if (
            side.color &&
            !ColorAnalyzer.isTransparentColor(side.color) &&
            side.width > 0 &&
            !trackedBorderColors.has(side.color)
          ) {
            trackedBorderColors.add(side.color);
            ColorAnalyzer.trackColor(
              side.color,
              element,
              'border-color',
              null,
              colorData,
              getSectionInfo,
              getBlockInfo
            );
          }
        });

        // Track SVG fill and stroke colors (matching DevTools CSS Overview)
        if (
          element.tagName === 'svg' ||
          element.tagName === 'SVG' ||
          element.ownerSVGElement ||
          element.closest('svg')
        ) {
          // For SVG elements, check fill and stroke
          var fillColor = computed.fill;
          var strokeColor = computed.stroke;

          if (fillColor && !ColorAnalyzer.isTransparentColor(fillColor) && fillColor !== 'none') {
            ColorAnalyzer.trackColor(
              fillColor,
              element,
              'fill',
              null,
              colorData,
              getSectionInfo,
              getBlockInfo
            );
          }

          if (
            strokeColor &&
            !ColorAnalyzer.isTransparentColor(strokeColor) &&
            strokeColor !== 'none'
          ) {
            ColorAnalyzer.trackColor(
              strokeColor,
              element,
              'stroke',
              null,
              colorData,
              getSectionInfo,
              getBlockInfo
            );
          }
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
    isIconOrSocialElement: isIconOrSocialElement,
    getNavigationName: getNavigationName,
    getSectionInfo: getSectionInfo,
    getBlockInfo: getBlockInfo,
    getStyleDefinition: getStyleDefinition,
    extractFontSize: extractFontSize,
    generateSelector: generateSelector,
    scanAllPageColors: scanAllPageColors,
  };
})();

// Make globally available for content scripts
if (typeof window !== 'undefined') {
  window.ContentScriptHelpers = ContentScriptHelpers;
}
