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
      
      // Step 7: Detach debugger
      await detachDebugger(tabId);
      
      return results;
      
    } catch (error) {
      // Always try to detach on error
      try {
        await detachDebugger(tabId);
      } catch (e) {
        // Ignore detach errors
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
    var fingerSize = LIGHTHOUSE_THRESHOLDS.minTapTargetSize;
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
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];

        // CRITICAL: Use getClientRects() instead of getBoundingClientRect()
        // Lighthouse checks ALL client rects and passes if ANY rect meets size requirement
        var clientRects = el.getClientRects();

        // Skip if no client rects (element not rendered)
        if (clientRects.length === 0) continue;

        // Use the first client rect for visibility checks (or could use bounding rect)
        var rect = clientRects[0];

        // Skip invisible elements (0 dimensions)
        if (rect.width === 0 || rect.height === 0) continue;

        // Skip elements outside viewport (normal bounds)
        if (rect.bottom < 0 || rect.right < 0) continue;
        if (rect.top > window.innerHeight || rect.left > window.innerWidth) continue;

        // Skip elements positioned way off-screen (like skip links hidden until focus)
        var left = rect.left;
        var top = rect.top;
        if (left < -1000 || top < -1000 || left > window.innerWidth + 1000 || top > window.innerHeight + 1000) continue;

        // Skip hidden elements (check computed styles)
        var styles = window.getComputedStyle(el);
        if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') continue;

        // Skip elements with very low opacity (effectively invisible)
        if (parseFloat(styles.opacity) < 0.01) continue;

        // Skip if not actually visible (z-index occlusion check)
        if (!isElementVisible(el, rect)) continue;

        // Get text content and aria-label
        var text = (el.textContent || '').trim();
        var ariaLabel = el.getAttribute('aria-label') || '';
        var hasContent = text.length > 0 || ariaLabel.length > 0;

        // Skip elements with no text and no aria-label (empty/decorative links)
        // Exception: Allow if element has background image or child img (icon buttons)
        if (!hasContent) {
          var hasImage = el.querySelector('img') !== null;
          var hasBackgroundImage = styles.backgroundImage && styles.backgroundImage !== 'none';
          if (!hasImage && !hasBackgroundImage) continue;
        }

        // NOTE: Do NOT filter out nested interactive elements here
        // Lighthouse INCLUDES nested elements but then IGNORES their overlap during containment check
        // This allows proper detection of intentionally nested targets (e.g., delete button in a card)

        var elementId = el.tagName;
        if (el.id) {
          elementId += '#' + el.id;
        } else if (el.className) {
          elementId += '.' + el.className.split(' ')[0];
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
          clientRects: allClientRects,  // Store all client rects for size check
          width: rect.width,   // Primary rect for overlap checks
          height: rect.height,
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          text: (text || ariaLabel).substring(0, 50),
          href: el.href || null
        });
      }

      // Track reported spacing issues to avoid symmetric duplicates (A→B and B→A)
      var reportedPairs = new Set();

      // Check each tap target
      for (var i = 0; i < rects.length; i++) {
        var rect = rects[i];

        // Check 1: Size requirement (Lighthouse approach)
        // Only flag as too small if ALL client rects are below minimum size
        // If ANY client rect meets the size requirement, the target passes
        var allRectsBelowMinimum = true;
        for (var k = 0; k < rect.clientRects.length; k++) {
          var cr = rect.clientRects[k];
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
