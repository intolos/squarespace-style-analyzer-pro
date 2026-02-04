const DEBUG_CSH = false;

// Helper: Check if an ID or class name appears to be dynamically generated
export function isDynamicId(id: string | null | undefined): boolean {
  if (DEBUG_CSH) console.log('[SSA isDynamicId] Called with:', id);
  if (!id) return false;

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

  // Common dynamic state classes
  const dynamicStateClasses = [
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

export function isIconOrSocialElement(element: Element | null): boolean {
  if (!element) return false;

  try {
    const role = element.getAttribute('role');

    if (role === 'img') return true;

    // Check ancestors
    let checkElement: Element | null = element;
    let depth = 0;
    while (checkElement && depth < 3) {
      const className = checkElement.className || '';
      const classLower = (typeof className === 'string' ? className : '').toLowerCase();

      if (
        classLower.includes('icon') ||
        classLower.includes('social') ||
        classLower.includes('share') ||
        classLower.includes('badge') ||
        classLower.includes('avatar')
      )
        return true;

      // Social sharing services
      if (
        classLower.includes('st-btn') ||
        classLower.includes('st_btn') ||
        classLower.includes('sharethis') ||
        classLower.includes('addthis') ||
        classLower.includes('a2a') ||
        classLower.includes('addtoany')
      )
        return true;

      checkElement = checkElement.parentElement;
      depth++;
    }

    // Check SVG
    if (
      element.tagName === 'svg' ||
      element.tagName === 'SVG' ||
      element.closest('svg') ||
      (element as unknown as SVGElement).ownerSVGElement
    ) {
      const rect = element.getBoundingClientRect();
      if ((rect.width > 0 && rect.width <= 64) || (rect.height > 0 && rect.height <= 64)) {
        return true;
      }
    }

    // Check small elements
    const computed = window.getComputedStyle(element);
    const width = parseFloat(computed.width);
    const height = parseFloat(computed.height);

    if (width > 0 && width <= 64 && height > 0 && height <= 64) return true;

    if (computed.backgroundImage && computed.backgroundImage !== 'none') {
      if ((width > 0 && width <= 64) || (height > 0 && height <= 64)) return true;
    }
  } catch (e) {
    return false;
  }

  return false;
}

export function getNavigationName(): string {
  const navLinks = document.querySelectorAll(
    'nav a[href], .navigation a[href], .menu a[href], [class*="nav"] a[href], header a[href]'
  );
  const currentPath = window.location.pathname;
  const currentFullUrl = window.location.href;

  for (let i = 0; i < navLinks.length; i++) {
    const link = navLinks[i];
    const linkHref = link.getAttribute('href');
    const navText = link.textContent?.trim();

    if (!navText || navText.toLowerCase().includes('skip') || navText.length < 2) continue;

    if (linkHref) {
      const fullLinkUrl = linkHref.startsWith('http')
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

  const activeLinks = document.querySelectorAll(
    'nav a.active, nav a.current, .navigation a.active, .menu a.active'
  );
  for (let j = 0; j < activeLinks.length; j++) {
    const activeText = activeLinks[j].textContent?.trim();
    if (activeText && !activeText.toLowerCase().includes('skip')) return activeText;
  }

  if (currentPath === '/' || currentPath === '') return 'Home';
  return document.title || currentPath.replace(/\//g, '').replace(/-/g, ' ') || 'Home';
}

export function generateSelector(element: Element | null): string {
  if (!element) return '';

  try {
    if (element.id && typeof element.id === 'string') {
      const id = element.id.trim();
      if (
        id &&
        !id.includes(' ') &&
        !isDynamicId(id) &&
        document.querySelectorAll('#' + CSS.escape(id)).length === 1
      ) {
        return '#' + CSS.escape(id);
      }
    }

    const path: string[] = [];
    let current: Element | null = element;

    while (
      current &&
      current.nodeType === 1 &&
      current.tagName.toLowerCase() !== 'html' &&
      current.tagName.toLowerCase() !== 'body'
    ) {
      const nodeName = current.tagName.toLowerCase();
      let selector = nodeName;

      if (
        current.id &&
        typeof current.id === 'string' &&
        !isDynamicId(current.id) &&
        !current.id.includes(' ')
      ) {
        selector += '#' + CSS.escape(current.id);
      } else {
        if (current.className && typeof current.className === 'string') {
          const classes = current.className
            .trim()
            .split(/\s+/)
            .filter(function (c) {
              return c.length > 0 && !c.includes(':') && !isDynamicId(c);
            });
          if (classes.length > 0) {
            // CSS.escape *should* handle this, but explicit replace ensures Tailwind classes (h-3.5) work
            // even if CSS.escape behavior varies or encoding strips backslashes.
            const escapedClass = CSS.escape(classes[0]).replace(/\./g, '\\.');
            selector += '.' + escapedClass;
          }
        }

        if (current.parentElement) {
          const siblings = current.parentElement.children;
          const sameTagSiblings = Array.from(siblings).filter(s => s.tagName === current?.tagName);
          if (sameTagSiblings.length > 1) {
            const index = sameTagSiblings.indexOf(current) + 1;
            selector += ':nth-of-type(' + index + ')';
          }
        }
      }

      path.unshift(selector);
      const isUnique = document.querySelectorAll(path.join(' > ')).length === 1;
      if (isUnique) break;

      current = current.parentElement;
    }
    return path.join(' > ');
  } catch (e) {
    return element.tagName.toLowerCase();
  }
}

export function getSectionInfo(element: Element | null): string {
  if (!element) return 'Main Content';

  let parent: Element | null = element;
  let depth = 0;
  while (parent && depth < 15) {
    const tagName = parent.tagName ? parent.tagName.toLowerCase() : '';
    const id = parent.id || '';
    const className = (typeof parent.className === 'string' ? parent.className : '').toLowerCase();
    const role = parent.getAttribute('role');
    const ariaLabel = parent.getAttribute('aria-label');

    // Semantic HTML & Landmarks
    if (tagName === 'header' || role === 'banner' || className.includes('site-header'))
      return 'Header';
    if (tagName === 'footer' || role === 'contentinfo' || className.includes('site-footer'))
      return 'Footer';
    if (tagName === 'nav' || role === 'navigation' || className.includes('nav'))
      return 'Navigation';
    if (tagName === 'main' || role === 'main') return 'Main Content';
    if (tagName === 'article' || role === 'article') return 'Article';
    if (tagName === 'aside' || role === 'complementary') return 'Sidebar';

    // Squarespace Specific
    const sqsSection = parent.getAttribute('data-section-id');
    if (sqsSection) return 'Section (' + sqsSection + ')';

    // WordPress Specific
    if (
      className.includes('wp-block-group') ||
      className.includes('wp-block-cover') ||
      className.includes('wp-block-columns')
    ) {
      if (ariaLabel) return 'Group: ' + ariaLabel;
      if (className.includes('cover')) return 'Cover Block';
      if (className.includes('columns')) return 'Columns Block';
      return 'Content Group';
    }

    // Generic Section Detection
    if (tagName === 'section' || id.includes('section') || className.includes('section')) {
      if (ariaLabel) return 'Section: ' + ariaLabel;
      if (id && !id.startsWith('yui_') && !isDynamicId(id)) return 'Section #' + id;

      // Try to find a heading inside the section to name it
      const firstHeading = parent.querySelector('h1, h2, h3, h4, h5, h6');
      if (firstHeading && firstHeading.textContent) {
        return 'Section: ' + firstHeading.textContent.substring(0, 30).trim() + '...';
      }
      // Fallback: Use class name if available
      if (className) {
        const meaningfulClass = className
          .split(' ')
          .find(c => c !== 'section' && !c.includes('wp-block-') && !isDynamicId(c));
        if (meaningfulClass) return 'Section (' + meaningfulClass + ')';
      }
      return 'Section';
    }

    parent = parent.parentElement;
    depth++;
  }
  return 'Main Content';
}

export function getBlockInfo(element: Element): string {
  let parent: Element | null = element;
  let depth = 0;

  // Strategy 1: Look for explicit IDs (Generic & Squarespace)
  while (parent && depth < 20) {
    const id = parent.getAttribute('id');
    if (id && !isDynamicId(id)) {
      // Use isDynamicId to filter junk
      const lowerCaseId = id.toLowerCase();
      // Generic block-like IDs
      if (
        lowerCaseId.includes('block') ||
        lowerCaseId.includes('widget') ||
        lowerCaseId.includes('content')
      ) {
        return '#' + id;
      }
      // Squarespace specific format
      if (lowerCaseId.startsWith('block-')) return '#' + id;
    }
    parent = parent.parentElement;
    depth++;
  }

  // Strategy 2: Look for data attributes & typical block classes
  parent = element;
  depth = 0;
  while (parent && depth < 20) {
    // Squarespace
    const dataBlockId = parent.getAttribute('data-block-id');
    if (dataBlockId) return '#block-' + dataBlockId;

    const blockType = parent.getAttribute('data-block-type');
    if (blockType) return 'block-type-' + blockType;

    // WordPress
    if (parent.className && typeof parent.className === 'string') {
      const classes = parent.className.split(' ');
      const wpBlock = classes.find(
        c => c.startsWith('wp-block-') && c !== 'wp-block-group' && c !== 'wp-block-column'
      );
      if (wpBlock) {
        return wpBlock.replace('wp-block-', ''); // e.g. "image", "paragraph", "button"
      }
    }

    parent = parent.parentElement;
    depth++;
  }

  return 'unknown-block';
}

export function extractFontSize(styleDefinition: string | null): string | null {
  if (!styleDefinition) return null;
  const match = styleDefinition.match(/font-size:\s*([0-9.]+px)/);
  return match ? match[1] : null;
}

/**
 * Gets the actual font size of visible text within an element.
 * Uses TreeWalker to find the first text node with content and reads
 * the computed font size from its direct parent element.
 *
 * IMPORTANT: This is more accurate than reading from the container element
 * because the text may be in a nested element with different styling.
 *
 * @param element - The element to analyze
 * @returns Object with fontSize (number), fontSizeString (e.g., "16px"), and fontSizeUndetermined flag
 */
export function getTextNodeFontSize(element: Element): {
  fontSize: number;
  fontSizeString: string;
  fontSizeUndetermined: boolean;
} {
  // Use TreeWalker to efficiently find text nodes
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: node => {
      // Only accept text nodes with actual content (not just whitespace)
      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });

  const textNode = walker.nextNode();

  if (textNode && textNode.parentElement) {
    // Read computed style from the text node's direct parent
    const computed = window.getComputedStyle(textNode.parentElement);
    const fontSizeValue = parseFloat(computed.fontSize) || 0;

    // IMPORTANT: For visible text, this should NEVER be 0.
    // If it is, we flag it as undetermined for special handling in the report.
    if (fontSizeValue === 0) {
      console.warn('[SSA] Unexpected 0px font size for visible text:', textNode.parentElement);
    }

    return {
      fontSize: fontSizeValue,
      fontSizeString: computed.fontSize || '',
      fontSizeUndetermined: fontSizeValue === 0,
    };
  }

  // Fallback: If no text node found (shouldn't happen since we already checked hasDirectText),
  // read from the element itself
  const computed = window.getComputedStyle(element);
  const fontSizeValue = parseFloat(computed.fontSize) || 0;

  return {
    fontSize: fontSizeValue,
    fontSizeString: computed.fontSize || '',
    fontSizeUndetermined: fontSizeValue === 0,
  };
}
