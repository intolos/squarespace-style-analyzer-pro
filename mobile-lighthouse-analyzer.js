// mobile-lighthouse-analyzer.js
// Single Responsibility: Run Lighthouse-quality mobile usability checks via Chrome DevTools Protocol
// This replaces the basic content-script mobile checks with Google-grade accuracy

var MobileLighthouseAnalyzer = (function() {
  'use strict';

  // ============================================
  // CONSTANTS
  // ============================================
  
  var MOBILE_DEVICE_CONFIG = {
    width: 412,
    height: 823,
    deviceScaleFactor: 2.625,
    mobile: true,
    screenWidth: 412,
    screenHeight: 823
  };
  
  var MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36';
  
  var LIGHTHOUSE_THRESHOLDS = {
    minTapTargetSize: 24,      // Lighthouse v12+ uses axe-core target-size: 24x24px minimum (WCAG 2.2 Level AA)
    minTapTargetSpacing: 8      // Lighthouse uses 8px minimum spacing
    // NOTE: Font-size audit was removed in Lighthouse v12+ (no replacement, no WCAG pixel-based requirement)
  };

  // ============================================
  // MAIN ANALYSIS FUNCTION
  // ============================================
  
  function analyzePage(tabId, pageUrl) {
    return new Promise(function(resolve, reject) {
      analyzePageAsync(tabId, pageUrl).then(resolve).catch(reject);
    });
  }
  
  async function analyzePageAsync(tabId, pageUrl) {
    var results = {
      url: pageUrl,  // Use passed URL directly
      viewport: null,
      tapTargets: [],
      fontSize: [],
      contentWidth: null,
      imageSizing: [],
      userAgent: MOBILE_USER_AGENT
    };
    
    try {
      // Step 1: Attach debugger
      await attachDebugger(tabId);
      
      // Step 2: Set mobile device emulation
      await setMobileEmulation(tabId);
      
      // Step 3: Set mobile user agent (CRITICAL - triggers mobile-specific code)
      await setMobileUserAgent(tabId);
      
      // Step 4: Enable required DevTools domains
      await enableDevToolsDomains(tabId);
      
      // Step 5: Wait for page to stabilize with mobile settings
      await delay(1000);
      
      // Step 6: Run all checks
      results.viewport = await checkViewport(tabId);
      results.tapTargets = await checkTapTargets(tabId);
      // Font-size check removed (Lighthouse v12+ removed this audit)
      results.contentWidth = await checkContentWidth(tabId);
      results.imageSizing = await checkImageSizing(tabId);

      // Step 7: Reset viewport to desktop BEFORE detaching
      await resetToDesktopView(tabId);
      await delay(500); // Let viewport reset stabilize

      // Step 8: Detach debugger
      await detachDebugger(tabId);

      return results;

    } catch (error) {
      // Always try to reset viewport and detach on error
      try {
        await resetToDesktopView(tabId);
        await detachDebugger(tabId);
      } catch (e) {
        // Ignore cleanup errors
      }

      throw error;
    }
  }

  // ============================================
  // DEBUGGER MANAGEMENT
  // ============================================
  
  function attachDebugger(tabId) {
    return chrome.debugger.attach({ tabId: tabId }, '1.3');
  }
  
  function detachDebugger(tabId) {
    return chrome.debugger.detach({ tabId: tabId });
  }
  
  function sendDebuggerCommand(tabId, method, params) {
    return chrome.debugger.sendCommand({ tabId: tabId }, method, params || {});
  }

  // ============================================
  // MOBILE EMULATION SETUP
  // ============================================
  
  function setMobileEmulation(tabId) {
    return sendDebuggerCommand(
      tabId,
      'Emulation.setDeviceMetricsOverride',
      MOBILE_DEVICE_CONFIG
    );
  }

  function resetToDesktopView(tabId) {
    // Clear device metrics override to return to desktop view
    return sendDebuggerCommand(
      tabId,
      'Emulation.clearDeviceMetricsOverride',
      {}
    );
  }

  function setMobileUserAgent(tabId) {
    return sendDebuggerCommand(
      tabId,
      'Emulation.setUserAgentOverride',
      { userAgent: MOBILE_USER_AGENT }
    );
  }
  
  function enableDevToolsDomains(tabId) {
    return Promise.all([
      sendDebuggerCommand(tabId, 'DOM.enable'),
      sendDebuggerCommand(tabId, 'CSS.enable'),
      sendDebuggerCommand(tabId, 'Overlay.enable')
    ]);
  }

  // ============================================
  // VIEWPORT CHECK (Lighthouse: viewport audit)
  // ============================================
  
  async function checkViewport(tabId) {
    var result = await sendDebuggerCommand(
      tabId,
      'Runtime.evaluate',
      {
        expression: generateViewportCheckScript(),
        returnByValue: true
      }
    );
    
    return result.result.value;
  }
  
  function generateViewportCheckScript() {
    return `(function() {
      var meta = document.querySelector('meta[name="viewport"]');
      if (!meta) return { exists: false };

      var content = meta.getAttribute('content');
      var hasWidth = /width\\s*=\\s*device-width/i.test(content);
      var hasInitialScale = /initial-scale\\s*=\\s*1/i.test(content);

      // Accessibility checks (Lighthouse v12+ requirements)
      var blocksZoom = /user-scalable\\s*=\\s*no/i.test(content);
      var maxScaleValue = null;
      var limitsZoom = false;

      var maxScaleMatch = content.match(/maximum-scale\\s*=\\s*([0-9.]+)/i);
      if (maxScaleMatch) {
        maxScaleValue = parseFloat(maxScaleMatch[1]);
        limitsZoom = maxScaleValue < 5;
      }

      return {
        exists: true,
        content: content,
        hasWidth: hasWidth,
        hasInitialScale: hasInitialScale,
        isOptimal: hasWidth && hasInitialScale,
        blocksZoom: blocksZoom,
        limitsZoom: limitsZoom,
        maxScaleValue: maxScaleValue
      };
    })()`;
  }

  // ============================================
  // TAP TARGETS CHECK (Lighthouse: tap-targets audit)
  // ============================================
  
  async function checkTapTargets(tabId) {
    var result = await sendDebuggerCommand(
      tabId,
      'Runtime.evaluate',
      {
        expression: generateTapTargetsCheckScript(),
        returnByValue: true
      }
    );
    
    return result.result.value;
  }
  
  function generateTapTargetsCheckScript() {
    var minSize = LIGHTHOUSE_THRESHOLDS.minTapTargetSize;
    var fingerSize = 24; // WCAG 2.2 Level AA standard: 24x24px minimum tap target size
    var maxOverlapRatio = 0.25; // Lighthouse uses 25% overlap threshold

    return `(function() {
      var issues = [];
      var minSize = ${minSize};
      var fingerSize = ${fingerSize};
      var maxOverlapRatio = ${maxOverlapRatio};

      // Helper: Get overlap area between two rectangles (Lighthouse rect-helpers.js)
      function getRectOverlapArea(rect1, rect2) {
        var overlapLeft = Math.max(rect1.left, rect2.left);
        var overlapRight = Math.min(rect1.right, rect2.right);
        var overlapTop = Math.max(rect1.top, rect2.top);
        var overlapBottom = Math.min(rect1.bottom, rect2.bottom);

        var overlapWidth = overlapRight - overlapLeft;
        var overlapHeight = overlapBottom - overlapTop;

        if (overlapWidth <= 0 || overlapHeight <= 0) return 0;
        return overlapWidth * overlapHeight;
      }

      // Helper: Create 48x48px finger rectangle centered on target center point (Lighthouse approach)
      function getFingerRect(rect) {
        var centerX = rect.left + rect.width / 2;
        var centerY = rect.top + rect.height / 2;
        var halfFinger = fingerSize / 2; // 24px

        return {
          left: centerX - halfFinger,
          right: centerX + halfFinger,
          top: centerY - halfFinger,
          bottom: centerY + halfFinger,
          width: fingerSize,
          height: fingerSize
        };
      }

      // Helper: Check if one rectangle completely contains another (Lighthouse containment check)
      function isContained(inner, outer) {
        return inner.left >= outer.left &&
               inner.right <= outer.right &&
               inner.top >= outer.top &&
               inner.bottom <= outer.bottom;
      }

      // Helper: Check if element is actually visible using elementFromPoint
      function isElementVisible(el, rect) {
        // Check if offsetParent is null (more reliable than display:none)
        if (el.offsetParent === null && el.tagName !== 'BODY') return false;

        // Test center point to check z-index occlusion
        var centerX = rect.left + rect.width / 2;
        var centerY = rect.top + rect.height / 2;
        var elementAtPoint = document.elementFromPoint(centerX, centerY);

        // Element is visible if it's at the center point or contains the element at center
        if (elementAtPoint === el || el.contains(elementAtPoint)) return true;

        // Also check if the element at point is contained by our target (for nested cases)
        if (elementAtPoint && elementAtPoint.contains(el)) return true;

        return false;
      }

      // Get all interactive elements (Lighthouse selectors)
      var selectors = 'a, button, input:not([type="hidden"]), select, textarea, [onclick], [role="button"], [role="checkbox"], [role="link"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="scrollbar"], [role="slider"], [role="spinbutton"], [tabindex]:not([tabindex="-1"])';
      var elements = document.querySelectorAll(selectors);

      var rects = [];
      var filterReasons = {
        noClientRects: 0,
        zeroDimensions: 0,
        outsideViewport: 0,
        offScreen: 0,
        hidden: 0,
        lowOpacity: 0,
        noOffsetParent: 0,
        noContent: 0,
        passed: 0
      };

      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];

        // CRITICAL: Use getClientRects() instead of getBoundingClientRect()
        // Lighthouse checks ALL client rects and passes if ANY rect meets size requirement
        var clientRects = el.getClientRects();

        // Skip if no client rects (element not rendered)
        if (clientRects.length === 0) {
          filterReasons.noClientRects++;
          continue;
        }

        // Use the first client rect for visibility checks (or could use bounding rect)
        var rect = clientRects[0];

        // Skip invisible elements (0 dimensions)
        if (rect.width === 0 || rect.height === 0) {
          filterReasons.zeroDimensions++;
          continue;
        }

        // Skip elements outside viewport (normal bounds)
        if (rect.bottom < 0 || rect.right < 0) {
          filterReasons.outsideViewport++;
          continue;
        }
        if (rect.top > window.innerHeight || rect.left > window.innerWidth) {
          filterReasons.outsideViewport++;
          continue;
        }

        // Skip elements positioned way off-screen (like skip links hidden until focus)
        var left = rect.left;
        var top = rect.top;
        if (left < -1000 || top < -1000 || left > window.innerWidth + 1000 || top > window.innerHeight + 1000) {
          filterReasons.offScreen++;
          continue;
        }

        // Skip hidden elements (check computed styles)
        var styles = window.getComputedStyle(el);
        if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') {
          filterReasons.hidden++;
          continue;
        }

        // Skip elements with very low opacity (effectively invisible)
        if (parseFloat(styles.opacity) < 0.01) {
          filterReasons.lowOpacity++;
          continue;
        }

        // Skip if not actually visible (z-index occlusion check)
        // NOTE: Make this check more lenient for tap targets - only skip if completely occluded
        // Small links may fail elementFromPoint check due to text wrapping or nested elements
        if (el.offsetParent === null && el.tagName !== 'BODY') {
          filterReasons.noOffsetParent++;
          continue;
        }

        // Get text content and aria-label
        var text = (el.textContent || '').trim();
        var ariaLabel = el.getAttribute('aria-label') || '';
        var title = el.getAttribute('title') || '';
        var hasContent = text.length > 0 || ariaLabel.length > 0 || title.length > 0;

        // Skip elements with no text and no aria-label (empty/decorative links)
        // Exception: Allow if element has background image, child img, or SVG (icon buttons)
        if (!hasContent) {
          var hasImage = el.querySelector('img') !== null;
          var hasSVG = el.querySelector('svg') !== null || el.tagName.toLowerCase() === 'svg';
          var hasBackgroundImage = styles.backgroundImage && styles.backgroundImage !== 'none';
          if (!hasImage && !hasSVG && !hasBackgroundImage) {
            filterReasons.noContent++;
            continue;
          }
        }

        filterReasons.passed++;

        // NOTE: Do NOT filter out social/share links for tap target detection
        // All interactive elements must meet minimum tap target size for accessibility

        // NOTE: Do NOT filter out nested interactive elements here
        // Lighthouse INCLUDES nested elements but then IGNORES their overlap during containment check
        // This allows proper detection of intentionally nested targets (e.g., delete button in a card)

        var elementId = el.tagName;
        if (el.id) {
          elementId += '#' + el.id;
        } else if (el.className) {
          elementId += '.' + el.className.split(' ')[0];
        }

        // Generate CSS selector for screenshot capture
        // Use a more robust full-path selector
        var cssSelector = '';
        if (el.id) {
          cssSelector = '#' + el.id;
        } else {
          // Build full path selector from root for better uniqueness
          var path = [];
          var current = el;
          while (current && current !== document.body) {
            var selector = current.tagName.toLowerCase();

            // Add ID if available (makes selector unique)
            if (current.id) {
              selector += '#' + current.id;
              path.unshift(selector);
              break; // Stop here since ID is unique
            }

            // Add first class if available
            if (current.className && typeof current.className === 'string') {
              var classes = current.className.split(' ').filter(function(c) { return c.length > 0; });
              if (classes.length > 0) {
                selector += '.' + classes[0];
              }
            }

            // Add nth-child for uniqueness
            if (current.parentElement) {
              var siblings = Array.prototype.slice.call(current.parentElement.children);
              var index = siblings.indexOf(current) + 1;
              selector += ':nth-child(' + index + ')';
            }

            path.unshift(selector);
            current = current.parentElement;
          }

          cssSelector = path.join(' > ');
        }

        // Add position info to make identifier unique for elements without IDs
        // This prevents duplicate identifiers for multiple elements with same class
        if (!el.id) {
          elementId += '@' + Math.round(rect.left) + ',' + Math.round(rect.top);
        }

        // Store ALL client rects for size checking (Lighthouse approach)
        // Also store the primary rect for overlap checking
        var allClientRects = [];
        for (var k = 0; k < clientRects.length; k++) {
          allClientRects.push({
            width: clientRects[k].width,
            height: clientRects[k].height,
            left: clientRects[k].left,
            top: clientRects[k].top,
            right: clientRects[k].right,
            bottom: clientRects[k].bottom
          });
        }

        rects.push({
          el: el,
          element: elementId,
          selector: cssSelector,  // CSS selector for screenshot capture
          clientRects: allClientRects,  // Store all client rects for size check
          width: rect.width,   // Primary rect for overlap checks
          height: rect.height,
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          text: (text || ariaLabel || title).substring(0, 50),
          href: el.href || null
        });
      }

      // Track reported spacing issues to avoid symmetric duplicates (A→B and B→A)
      var reportedPairs = new Set();

      // Check each tap target
      for (var i = 0; i < rects.length; i++) {
        var rect = rects[i];

        // Check 1: Size requirement (Lighthouse approach)
        // A tap target fails if ALL client rects have EITHER dimension below minimum
        // If ANY client rect has BOTH width AND height >= minSize, the target passes
        // CRITICAL: Must check BOTH dimensions - a link can be 100px wide but only 16px tall
        var allRectsBelowMinimum = true;
        for (var k = 0; k < rect.clientRects.length; k++) {
          var cr = rect.clientRects[k];
          // Target passes if it has at least minSize × minSize clickable area
          if (cr.width >= minSize && cr.height >= minSize) {
            allRectsBelowMinimum = false;
            break;
          }
        }

        if (allRectsBelowMinimum) {
          // Find the largest rect to report (Lighthouse does this for display)
          var largestRect = rect.clientRects[0];
          for (var k = 1; k < rect.clientRects.length; k++) {
            var cr = rect.clientRects[k];
            if (cr.width * cr.height > largestRect.width * largestRect.height) {
              largestRect = cr;
            }
          }

          issues.push({
            type: 'size',
            element: rect.element,
            selector: rect.selector,
            text: rect.text,
            width: Math.round(largestRect.width),
            height: Math.round(largestRect.height),
            minRequired: minSize
          });
        }

        // Check 2: Spacing using overlap calculation (Lighthouse approach)
        for (var j = i + 1; j < rects.length; j++) {
          var other = rects[j];

          // Skip if both elements link to the same URL (Lighthouse exception)
          if (rect.href && other.href) {
            var rectUrl = rect.href.replace(/^https?:/, '');
            var otherUrl = other.href.replace(/^https?:/, '');
            if (rectUrl === otherUrl) continue;
          }

          // CRITICAL: Check for containment (Lighthouse approach)
          // If one target completely contains another, ignore the overlap (intentional nesting)
          if (isContained(rect, other) || isContained(other, rect)) {
            continue;
          }

          // Create 48x48px finger rectangles centered on each target's center
          var fingerRect = getFingerRect(rect);
          var fingerOther = getFingerRect(other);

          // Calculate overlap area between finger rectangles
          var overlapArea = getRectOverlapArea(fingerRect, fingerOther);

          if (overlapArea > 0) {
            // Calculate overlap ratio using fixed 48x48px finger area (2304 sq px)
            // This represents "how much of the 48px tap zone overlaps"
            var fingerArea = fingerSize * fingerSize; // Always 2304 (48 * 48)
            var overlapRatio = overlapArea / fingerArea;

            // Flag if overlap exceeds 25% threshold
            if (overlapRatio > maxOverlapRatio) {
              // Create unique pair identifier to avoid symmetric duplicates
              var pairId = [rect.element, other.element].sort().join('|');

              if (!reportedPairs.has(pairId)) {
                reportedPairs.add(pairId);

                issues.push({
                  type: 'spacing',
                  element: rect.element,
                  selector: rect.selector,
                  text: rect.text,
                  nearElement: other.element,
                  overlapPercent: Math.round(overlapRatio * 100),
                  minRequired: 8 // Report 8px as the spacing requirement
                });
              }
            }
          }
        }
      }

      // Log filtering statistics for debugging
      var totalElements = filterReasons.noClientRects + filterReasons.zeroDimensions +
                         filterReasons.outsideViewport + filterReasons.offScreen +
                         filterReasons.hidden + filterReasons.lowOpacity +
                         filterReasons.noOffsetParent + filterReasons.noContent +
                         filterReasons.passed;
      console.log('🔍 TAP TARGET DETECTION STATS:');
      console.log('  Total interactive elements found:', totalElements);
      console.log('  Filtered out - no client rects:', filterReasons.noClientRects);
      console.log('  Filtered out - zero dimensions:', filterReasons.zeroDimensions);
      console.log('  Filtered out - outside viewport:', filterReasons.outsideViewport);
      console.log('  Filtered out - off screen:', filterReasons.offScreen);
      console.log('  Filtered out - hidden:', filterReasons.hidden);
      console.log('  Filtered out - low opacity:', filterReasons.lowOpacity);
      console.log('  Filtered out - no offset parent:', filterReasons.noOffsetParent);
      console.log('  Filtered out - no content:', filterReasons.noContent);
      console.log('  ✅ Passed all filters:', filterReasons.passed);
      console.log('  📊 Tap target issues found:', issues.length);

      return issues;
    })()`;
  }

  // ============================================
  // FONT SIZE CHECK - REMOVED
  // ============================================
  // Font-size audit was removed in Lighthouse v12+ with no replacement.
  // No WCAG pixel-based font size requirement exists.
  // Mobile browsers handle zoom, mitigating small text issues.

  // ============================================
  // CONTENT WIDTH CHECK (Lighthouse: checks for horizontal scroll)
  // ============================================
  
  async function checkContentWidth(tabId) {
    var result = await sendDebuggerCommand(
      tabId,
      'Runtime.evaluate',
      {
        expression: generateContentWidthCheckScript(),
        returnByValue: true
      }
    );
    
    return result.result.value;
  }
  
  function generateContentWidthCheckScript() {
    return `(function() {
      var viewportWidth = window.innerWidth;
      var contentWidth = document.documentElement.scrollWidth;
      var hasHorizontalScroll = contentWidth > viewportWidth;
      
      return {
        viewportWidth: viewportWidth,
        contentWidth: contentWidth,
        hasHorizontalScroll: hasHorizontalScroll,
        overflowAmount: hasHorizontalScroll ? contentWidth - viewportWidth : 0
      };
    })()`;
  }

	// ============================================
  // IMAGE SIZING CHECK
  // ============================================
  
  async function checkImageSizing(tabId) {
    var result = await sendDebuggerCommand(
      tabId,
      'Runtime.evaluate',
      {
        expression: generateImageSizingCheckScript(),
        returnByValue: true
      }
    );
    
    return result.result.value;
  }
  
  function generateImageSizingCheckScript() {
    return `(function() {
      var issues = [];
      var devicePixelRatio = window.devicePixelRatio || 1;
      
      // Threshold: Flag images >3x display size (accounts for 2x retina + margin)
      var oversizeThreshold = 3.0;
      
      var images = document.querySelectorAll('img');
      
      for (var i = 0; i < images.length; i++) {
        var img = images[i];
        
        // Get display size
        var displayWidth = img.clientWidth;
        var displayHeight = img.clientHeight;
        
        // Skip if not visible
        if (displayWidth === 0 || displayHeight === 0) continue;
        
        // Get natural (actual) size
        var naturalWidth = img.naturalWidth;
        var naturalHeight = img.naturalHeight;
        
        // Skip if image hasn't loaded
        if (naturalWidth === 0 || naturalHeight === 0) continue;
        
        // Calculate ratio
        var widthRatio = naturalWidth / displayWidth;
        var heightRatio = naturalHeight / displayHeight;
        var maxRatio = Math.max(widthRatio, heightRatio);
        
        // Only flag if significantly oversized (>3x accounting for retina)
        if (maxRatio > oversizeThreshold) {
          var elementId = 'IMG';
          if (img.id) elementId += '#' + img.id;
          else if (img.className) elementId += '.' + img.className.split(' ')[0];
          
          var alt = img.getAttribute('alt') || '(no alt text)';
          
          issues.push({
            element: elementId,
            src: img.src,
            alt: alt.substring(0, 50),
            displaySize: Math.round(displayWidth) + 'x' + Math.round(displayHeight) + 'px',
            naturalSize: naturalWidth + 'x' + naturalHeight + 'px',
            ratio: Math.round(maxRatio * 10) / 10,
            wastedPixels: Math.round((naturalWidth * naturalHeight) - (displayWidth * displayHeight * devicePixelRatio * devicePixelRatio))
          });
        }
      }
      
      return issues;
    })()`;
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  
  function delay(ms) {
    return new Promise(function(resolve) {
      setTimeout(resolve, ms);
    });
  }

  // ============================================
  // PUBLIC API
  // ============================================
  
  return {
    analyzePage: analyzePage,
    LIGHTHOUSE_THRESHOLDS: LIGHTHOUSE_THRESHOLDS,
    MOBILE_USER_AGENT: MOBILE_USER_AGENT
  };

})();

// Make available in service worker context
if (typeof self !== 'undefined') {
  self.MobileLighthouseAnalyzer = MobileLighthouseAnalyzer;
}
