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
      element.ownerSVGElement
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
            selector += '.' + CSS.escape(classes[0]);
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

    if (tagName === 'header' || className.includes('header') || id.includes('header'))
      return 'Header';
    if (tagName === 'footer' || className.includes('footer') || id.includes('footer'))
      return 'Footer';
    if (tagName === 'nav' || className.includes('nav') || id.includes('navigation'))
      return 'Navigation';

    const sqsSection = parent.getAttribute('data-section-id');
    if (sqsSection) return 'Section (' + sqsSection.substring(0, 8) + '...)';

    if (tagName === 'section' || id.includes('section') || className.includes('section')) {
      if (id && !id.startsWith('yui_')) return 'Section #' + id;
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

  while (parent && depth < 20) {
    const id = parent.getAttribute('id');
    if (id) {
      const lowerCaseId = id.toLowerCase();
      if (lowerCaseId.startsWith('block-') || id.startsWith('Block') || id.startsWith('block'))
        return '#' + id;
    }
    parent = parent.parentElement;
    depth++;
  }

  parent = element;
  depth = 0;
  while (parent && depth < 20) {
    const dataBlockId = parent.getAttribute('data-block-id');
    if (dataBlockId) return '#block-' + dataBlockId;

    const blockType = parent.getAttribute('data-block-type');
    if (blockType) {
      const parentId = parent.getAttribute('id');
      if (
        parentId &&
        (parentId.toLowerCase().startsWith('block-') || parentId.startsWith('Block'))
      ) {
        return '#' + parentId;
      }
      return 'block-type-' + blockType;
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
