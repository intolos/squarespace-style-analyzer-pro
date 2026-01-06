// mobile-check-scripts.js
// Single Responsibility: Hold the "In-Page" logic for mobile usability checks as standard JS functions.
// These functions are serialized and injected into the page by mobile-lighthouse-analyzer.js.

var MobileCheckScripts = {
  // ============================================
  // VIEWPORT CHECK
  // ============================================
  getViewportCheck: function () {
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return { exists: false };

    var content = meta.getAttribute('content');
    var hasWidth = /width\s*=\s*device-width/i.test(content);
    var hasInitialScale = /initial-scale\s*=\s*1/i.test(content);

    // Accessibility checks (Lighthouse v12+ requirements)
    var blocksZoom = /user-scalable\s*=\s*no/i.test(content);
    var maxScaleValue = null;
    var limitsZoom = false;

    var maxScaleMatch = content.match(/maximum-scale\s*=\s*([0-9.]+)/i);
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
      maxScaleValue: maxScaleValue,
    };
  },

  // ============================================
  // TAP TARGETS CHECK
  // ============================================
  // Note: 'options' is passed as an argument when injected
  getTapTargetIssues: function (options) {
    var issues = [];
    var minSize = options.minSize;
    var fingerSize = 24; // WCAG 2.2 Level AA standard: 24x24px minimum tap target size
    var maxOverlapRatio = 0.25; // Lighthouse uses 25% overlap threshold

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
        height: fingerSize,
      };
    }

    // Helper: Check if one rectangle completely contains another (Lighthouse containment check)
    function isContained(inner, outer) {
      return (
        inner.left >= outer.left &&
        inner.right <= outer.right &&
        inner.top >= outer.top &&
        inner.bottom <= outer.bottom
      );
    }

    // Get all interactive elements (Lighthouse selectors)
    var selectors =
      'a, button, input:not([type="hidden"]), select, textarea, [onclick], [role="button"], [role="checkbox"], [role="link"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="scrollbar"], [role="slider"], [role="spinbutton"], [tabindex]:not([tabindex="-1"])';
    var elements = document.querySelectorAll(selectors);

    var rects = [];

    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];

      // CRITICAL: Use getClientRects() instead of getBoundingClientRect()
      var clientRects = el.getClientRects();

      // Filter visible elements
      if (clientRects.length === 0) continue;

      var rect = clientRects[0];
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.bottom < 0 || rect.right < 0) continue;
      if (rect.top > window.innerHeight || rect.left > window.innerWidth) continue;

      // Hidden check
      var styles = window.getComputedStyle(el);
      if (
        styles.display === 'none' ||
        styles.visibility === 'hidden' ||
        parseFloat(styles.opacity) < 0.01
      )
        continue;

      // Visibility check
      if (el.offsetParent === null && el.tagName !== 'BODY') continue;

      // Content check
      var text = (el.textContent || '').trim();
      var ariaLabel = el.getAttribute('aria-label') || '';
      var title = el.getAttribute('title') || '';
      var hasContent = text.length > 0 || ariaLabel.length > 0 || title.length > 0;

      if (!hasContent) {
        var hasImage = el.querySelector('img') !== null;
        var hasSVG = el.querySelector('svg') !== null || el.tagName.toLowerCase() === 'svg';
        var hasBackgroundImage = styles.backgroundImage && styles.backgroundImage !== 'none';
        if (!hasImage && !hasSVG && !hasBackgroundImage) continue;
      }

      var elementId = el.tagName;
      if (el.id) {
        elementId += '#' + el.id;
      } else if (el.className) {
        elementId += '.' + el.className.split(' ')[0];
      }

      // Generate CSS selector for screenshot capture
      var cssSelector = '';
      if (el.id) {
        cssSelector = '#' + el.id;
      } else {
        var path = [];
        var current = el;
        while (current && current !== document.body) {
          var selector = current.tagName.toLowerCase();
          if (current.id) {
            selector += '#' + current.id;
            path.unshift(selector);
            break;
          }
          if (current.className && typeof current.className === 'string') {
            var classes = current.className.split(' ').filter(function (c) {
              return c.length > 0;
            });
            if (classes.length > 0) {
              selector += '.' + classes[0];
            }
          }
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

      // Unique identifier for duplicates
      if (!el.id) {
        elementId += '@' + Math.round(rect.left) + ',' + Math.round(rect.top);
      }

      var allClientRects = [];
      for (var k = 0; k < clientRects.length; k++) {
        allClientRects.push({
          width: clientRects[k].width,
          height: clientRects[k].height,
          left: clientRects[k].left,
          top: clientRects[k].top,
          right: clientRects[k].right,
          bottom: clientRects[k].bottom,
        });
      }

      rects.push({
        el: el,
        element: elementId,
        selector: cssSelector,
        clientRects: allClientRects,
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        text: (text || ariaLabel || title).substring(0, 50),
        href: el.href || null,
      });
    }

    var reportedPairs = new Set();

    // Check each tap target
    for (var i = 0; i < rects.length; i++) {
      var rect = rects[i];

      // SIZE CHECK
      var allRectsBelowMinimum = true;
      for (var k = 0; k < rect.clientRects.length; k++) {
        var cr = rect.clientRects[k];
        if (cr.width >= minSize && cr.height >= minSize) {
          allRectsBelowMinimum = false;
          break;
        }
      }

      if (allRectsBelowMinimum) {
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
          minRequired: minSize,
          // Coordinates for screenshot
          left: largestRect.left,
          top: largestRect.top,
        });
      }

      // SPACING CHECK
      for (var j = i + 1; j < rects.length; j++) {
        var other = rects[j];

        if (rect.href && other.href) {
          var rectUrl = rect.href.replace(/^https?:/, '');
          var otherUrl = other.href.replace(/^https?:/, '');
          if (rectUrl === otherUrl) continue;
        }

        if (isContained(rect, other) || isContained(other, rect)) continue;

        var fingerRect = getFingerRect(rect);
        var fingerOther = getFingerRect(other);
        var overlapArea = getRectOverlapArea(fingerRect, fingerOther);

        if (overlapArea > 0) {
          var fingerArea = fingerSize * fingerSize;
          var overlapRatio = overlapArea / fingerArea;

          if (overlapRatio > maxOverlapRatio) {
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
                minRequired: 8,
                // Coordinates for screenshot
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                nearLeft: other.left,
                nearTop: other.top,
                nearWidth: other.width,
                nearHeight: other.height,
              });
            }
          }
        }
      }
    }

    return issues;
  },

  // ============================================
  // CONTENT WIDTH CHECK
  // ============================================
  getContentWidthCheck: function () {
    var viewportWidth = window.innerWidth;
    var contentWidth = document.documentElement.scrollWidth;
    var hasHorizontalScroll = contentWidth > viewportWidth;

    return {
      viewportWidth: viewportWidth,
      contentWidth: contentWidth,
      hasHorizontalScroll: hasHorizontalScroll,
      overflowAmount: hasHorizontalScroll ? contentWidth - viewportWidth : 0,
    };
  },

  // ============================================
  // IMAGE SIZING CHECK
  // ============================================
  getImageSizingCheck: function () {
    var issues = [];
    var devicePixelRatio = window.devicePixelRatio || 1;
    var oversizeThreshold = 3.0;

    var images = document.querySelectorAll('img');

    for (var i = 0; i < images.length; i++) {
      var img = images[i];
      var displayWidth = img.clientWidth;
      var displayHeight = img.clientHeight;

      if (displayWidth === 0 || displayHeight === 0) continue;

      var naturalWidth = img.naturalWidth;
      var naturalHeight = img.naturalHeight;

      if (naturalWidth === 0 || naturalHeight === 0) continue;

      var widthRatio = naturalWidth / displayWidth;
      var heightRatio = naturalHeight / displayHeight;
      var maxRatio = Math.max(widthRatio, heightRatio);

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
          wastedPixels: Math.round(
            naturalWidth * naturalHeight -
              displayWidth * displayHeight * devicePixelRatio * devicePixelRatio
          ),
        });
      }
    }

    return issues;
  },

  // ============================================
  // COORDINATE HELPER
  // ============================================
  getElementCoordinates: function (selector) {
    var el = document.querySelector(selector);
    if (!el) return null;

    var rect = el.getBoundingClientRect();
    return {
      left: rect.left + window.scrollX,
      top: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
    };
  },
};

// Make available in service worker/window context
if (typeof self !== 'undefined') {
  self.MobileCheckScripts = MobileCheckScripts;
}
