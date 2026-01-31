/**
 * Mobile Check Scripts
 *
 * This object contains functions that are SERIALIZED and injected into the page
 * by the Debugger API. They must be self-contained and not rely on external
 * scope variables (except standard DOM APIs).
 */

export const MobileCheckScripts = {
  // Check viewport meta tag configuration
  getViewportCheck: function () {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return { exists: false };

    const content = meta.getAttribute('content') || '';
    const hasWidth = /width\s*=\s*device-width/i.test(content);
    const hasInitialScale = /initial-scale\s*=\s*1/i.test(content);

    // Accessibility checks
    const blocksZoom = /user-scalable\s*=\s*no/i.test(content);
    let maxScaleValue: number | null = null;
    let limitsZoom = false;

    const maxScaleMatch = content.match(/maximum-scale\s*=\s*([0-9.]+)/i);
    if (maxScaleMatch) {
      maxScaleValue = parseFloat(maxScaleMatch[1]);
      limitsZoom = maxScaleValue < 5;
    }

    return {
      exists: true,
      content: content,
      hasWidth,
      hasInitialScale,
      isOptimal: hasWidth && hasInitialScale,
      blocksZoom,
      limitsZoom,
      maxScaleValue,
    };
  },

  // Check tap targets for size and spacing
  getTapTargetIssues: function (options: any) {
    const issues: any[] = [];
    const minSize = options.minSize || 16;
    const fingerSize = 24; // WCAG 2.2 Level AA standard
    const maxOverlapRatio = 0.25;

    // Helper: Rect overlap area
    function getRectOverlapArea(rect1: any, rect2: any) {
      const overlapLeft = Math.max(rect1.left, rect2.left);
      const overlapRight = Math.min(rect1.right, rect2.right);
      const overlapTop = Math.max(rect1.top, rect2.top);
      const overlapBottom = Math.min(rect1.bottom, rect2.bottom);

      const overlapWidth = overlapRight - overlapLeft;
      const overlapHeight = overlapBottom - overlapTop;

      if (overlapWidth <= 0 || overlapHeight <= 0) return 0;
      return overlapWidth * overlapHeight;
    }

    // Helper: Finger rect
    function getFingerRect(rect: any) {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const halfFinger = fingerSize / 2;

      return {
        left: centerX - halfFinger,
        right: centerX + halfFinger,
        top: centerY - halfFinger,
        bottom: centerY + halfFinger,
        width: fingerSize,
        height: fingerSize,
      };
    }

    // Helper: Compliance check
    function isContained(inner: any, outer: any) {
      return (
        inner.left >= outer.left &&
        inner.right <= outer.right &&
        inner.top >= outer.top &&
        inner.bottom <= outer.bottom
      );
    }

    const selectors =
      'a, button, input:not([type="hidden"]), select, textarea, [onclick], [role="button"], [role="checkbox"], [role="link"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="scrollbar"], [role="slider"], [role="spinbutton"], [tabindex]:not([tabindex="-1"])';
    const elements = document.querySelectorAll(selectors);
    const rects: any[] = [];

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i] as HTMLElement;
      const clientRects = el.getClientRects();

      if (clientRects.length === 0) continue;

      const rect = clientRects[0];
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.bottom < 0 || rect.right < 0) continue;

      const horizontalBuffer = window.innerWidth;
      if (rect.left < -100 || rect.top < -100) continue;
      if (rect.left > window.innerWidth + horizontalBuffer) continue;

      const styles = window.getComputedStyle(el);

      // FILTER 1: Basic Visibility
      if (
        styles.display === 'none' ||
        styles.visibility === 'hidden' ||
        parseFloat(styles.opacity) < 0.01
      )
        continue;

      // FILTER 1.5: Text Content Exclusion (Ported from ContentScriptAnalyzers)
      // Filter out utility links like 'Skip to content', 'Open Menu', etc.
      const textContent = (el.textContent || '').trim().toLowerCase();
      const ariaLabelContent = (el.getAttribute('aria-label') || '').trim().toLowerCase();
      const checkText = textContent || ariaLabelContent;

      /* Refactored: Accept exclusions from options to use centralized list from issueFilters.ts */
      const excludedPatterns = options.excludedPatterns || [
        'open menu',
        'skip to content',
        'skip to',
        'close menu',
        'folder:',
        'cookie',
        'large images',
        'all images',
        'images (>100kb)',
        'pause background',
        'play background',
        'background',
      ];

      if (checkText) {
        let isExcluded = false;
        for (const pattern of excludedPatterns) {
          if (checkText.includes(pattern)) {
            isExcluded = true;
            break;
          }
        }
        if (isExcluded) continue;
      }

      // FILTER 2: Aria Hidden (Ported from Style Analyzer)
      if (el.getAttribute('aria-hidden') === 'true') continue;

      // FILTER 3: Presentation Role (Ported from Style Analyzer)
      const role = el.getAttribute('role');
      if (role === 'presentation' || role === 'none') continue;

      // FILTER 4: Off-screen checks (Ported/Refined)
      // Skip if significantly off-screen (likely hidden menu or similar)
      if (rect.top < -5000 || rect.left < -5000) continue;

      // Nested check
      let isNested = false;
      let parentElement = el.parentElement;
      let depth = 0;
      while (parentElement && parentElement !== document.body && depth < 5) {
        if (parentElement.matches(selectors)) {
          isNested = true;
          break;
        }
        parentElement = parentElement.parentElement;
        depth++;
      }
      if (isNested) continue;

      const fontSize = parseFloat(styles.fontSize);
      const hasSmallFont = fontSize < 16;

      if (el.offsetParent === null && el.tagName !== 'BODY') continue;

      // Content check & Text Extraction (Improved)
      let text = (el.textContent || '').trim();
      const ariaLabel = el.getAttribute('aria-label') || '';
      const title = el.getAttribute('title') || '';

      // Improve extraction: Check for nested image alt text if main text is empty
      if (!text && !ariaLabel && !title) {
        const nestedImg = el.querySelector('img');
        if (nestedImg && nestedImg.alt) {
          text = `Image: ${nestedImg.alt}`;
        } else if (nestedImg) {
          text = '(Graphical Link)';
        } else {
          // Check for background image
          if (styles.backgroundImage && styles.backgroundImage !== 'none') {
            text = '(Graphical Link)';
          }
        }
      }

      const hasContent = text.length > 0 || ariaLabel.length > 0 || title.length > 0;

      if (!hasContent) {
        // Re-check SVG presence if we didn't identify content yet
        const hasSVG = el.querySelector('svg') !== null || el.tagName.toLowerCase() === 'svg';
        if (!hasSVG) continue; // Skip if truly empty
        if (!text) text = '(Icon Link)'; // Label SVG links
      }

      let elementId = el.tagName;
      if (el.id && !el.id.startsWith('yui_') && !el.id.startsWith('sqs-')) {
        elementId += '#' + el.id;
      } else if (el.className) {
        const firstClass = el.className.trim().split(/\s+/)[0];
        if (firstClass) elementId += '.' + firstClass;
      }

      // CSS Selector generation
      let cssSelector = '';
      if (el.id) {
        cssSelector = '#' + el.id;
      } else {
        const path: string[] = [];
        let current: HTMLElement | null = el;
        while (current && current !== document.body) {
          let selector = current.tagName.toLowerCase();
          if (current.id) {
            selector += '#' + current.id;
            path.unshift(selector);
            break;
          }
          if (current.className && typeof current.className === 'string') {
            const classes = current.className.split(' ').filter(c => c.length > 0);
            if (classes.length > 0) selector += '.' + classes[0];
          }
          if (current.parentElement) {
            const siblings = Array.from(current.parentElement.children);
            const index = siblings.indexOf(current) + 1;
            selector += ':nth-child(' + index + ')';
          }
          path.unshift(selector);
          current = current.parentElement;
        }
        cssSelector = path.join(' > ');
      }

      const allClientRects = [];
      for (let k = 0; k < clientRects.length; k++) {
        allClientRects.push({
          width: clientRects[k].width,
          height: clientRects[k].height,
          left: clientRects[k].left,
          top: clientRects[k].top,
          right: clientRects[k].right,
          bottom: clientRects[k].bottom,
        });
      }

      // Final Label Logic
      let label = (text || ariaLabel || title || '').trim().substring(0, 50);

      // Fallback for IMG tags if we haven't caught them above (rare given logic above, but safe)
      if (!label && el.tagName.toLowerCase() === 'img') {
        const img = el as HTMLImageElement;
        label = img.alt || 'Image';
      } else if (!label) {
        // Only fall back to generic ID if we absolutely have no other text/label
        label = elementId;
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
        text: label,
        href: (el as HTMLAnchorElement).href || null,
        fontSize: fontSize,
        hasSmallFont: hasSmallFont,
      });
    }

    const reportedPairs = new Set();

    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];

      // Size Check
      let isTooSmall = true;
      for (let k = 0; k < rect.clientRects.length; k++) {
        const cr = rect.clientRects[k];
        // Use Math.round to handle sub-pixel rendering (e.g., 15.8px should pass as 16px)
        // This matches the reported values which are also rounded.
        if (Math.round(cr.width) >= minSize && Math.round(cr.height) >= minSize) {
          isTooSmall = false;
          break;
        }
      }

      if (isTooSmall) {
        let largestRect = rect.clientRects[0];
        for (let k = 1; k < rect.clientRects.length; k++) {
          const cr = rect.clientRects[k];
          if (cr.width * cr.height > largestRect.width * largestRect.height) {
            largestRect = cr;
          }
        }

        const issueDescription = 'Tap target is too small';

        issues.push({
          type: 'size',
          element: rect.element,
          selector: rect.selector,
          text: rect.text,
          width: Math.round(largestRect.width),
          height: Math.round(largestRect.height),
          fontSize: rect.fontSize,
          issueDescription: issueDescription,
          minRequired: minSize,
          left: largestRect.left,
          top: largestRect.top,
          href: rect.href,
        });
      }

      // Spacing check
      for (let j = i + 1; j < rects.length; j++) {
        const other = rects[j];

        if (rect.href && other.href) {
          const rectUrl = rect.href.replace(/^https?:/, '');
          const otherUrl = other.href.replace(/^https?:/, '');
          if (rectUrl === otherUrl) continue;
        }

        if (isContained(rect, other) || isContained(other, rect)) continue;

        const fingerRect = getFingerRect(rect);
        const fingerOther = getFingerRect(other);
        const overlapArea = getRectOverlapArea(fingerRect, fingerOther);

        if (overlapArea > 0) {
          const fingerArea = fingerSize * fingerSize;
          const overlapRatio = overlapArea / fingerArea;

          if (overlapRatio > maxOverlapRatio) {
            const pairId = [rect.element, other.element].sort().join('|');

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
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                nearLeft: other.left,
                nearTop: other.top,
                nearWidth: other.width,
                nearHeight: other.height,
                href: rect.href,
              });
            }
          }
        }
      }
    }

    return issues;
  },

  // Check content width
  getContentWidthCheck: function () {
    const viewportWidth = window.innerWidth;
    const contentWidth = document.documentElement.scrollWidth;
    const hasHorizontalScroll = contentWidth > viewportWidth;

    return {
      viewportWidth,
      contentWidth,
      hasHorizontalScroll,
      overflowAmount: hasHorizontalScroll ? contentWidth - viewportWidth : 0,
    };
  },

  // Check image sizing
  getImageSizingCheck: function () {
    const issues = [];
    const devicePixelRatio = window.devicePixelRatio || 1;
    const oversizeThreshold = 3.5;

    const images = document.querySelectorAll('img');

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const displayWidth = img.clientWidth;
      const displayHeight = img.clientHeight;

      if (displayWidth < 10 || displayHeight < 10) continue;

      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;

      if (naturalWidth === 0 || naturalHeight === 0) continue;

      const hasSrcset = img.hasAttribute('srcset') || img.hasAttribute('data-srcset');
      const hasSizes = img.hasAttribute('sizes');
      const src = img.src || '';
      const isDynamicCdn =
        src.includes('format=') ||
        src.includes('width=') ||
        src.includes('?w=') ||
        src.includes('?s=');

      if (hasSrcset || hasSizes || isDynamicCdn) continue;

      const widthRatio = naturalWidth / displayWidth;
      const heightRatio = naturalHeight / displayHeight;
      const maxRatio = Math.max(widthRatio, heightRatio);

      if (maxRatio > oversizeThreshold) {
        let elementId = 'IMG';
        if (img.id) elementId += '#' + img.id;
        else if (img.className) elementId += '.' + img.className.split(' ')[0];

        const alt = img.getAttribute('alt') || '(no alt text)';

        let cssSelector = '';
        if (img.id) {
          cssSelector = '#' + img.id;
        } else {
          const path = [];
          let current: HTMLElement | null = img;
          while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();
            if (current.id) {
              selector += '#' + current.id;
              path.unshift(selector);
              break;
            }
            if (current.className && typeof current.className === 'string') {
              const classes = current.className.split(' ').filter(c => c.length > 0);
              if (classes.length > 0) selector += '.' + classes[0];
            }
            if (current.parentElement) {
              const siblings = Array.from(current.parentElement.children);
              const index = siblings.indexOf(current) + 1;
              selector += ':nth-child(' + index + ')';
            }
            path.unshift(selector);
            current = current.parentElement;
          }
          cssSelector = path.join(' > ');
        }

        issues.push({
          element: elementId,
          selector: cssSelector,
          src: src,
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

  // Coordinate helper
  getElementCoordinates: function (selector: string) {
    const el = document.querySelector(selector);
    if (!el) return null;

    const rect = el.getBoundingClientRect();
    return {
      left: rect.left + window.scrollX,
      top: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
    };
  },
};
