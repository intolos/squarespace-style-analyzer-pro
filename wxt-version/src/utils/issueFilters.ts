/**
 * Centralized Accessibility Issue Filters
 *
 * Consolidates filtering logic that was previously scattered across buttons.ts,
 * mobileScripts.ts, and colors.ts. Also adds new checks for complex backgrounds.
 */

import { isTransparentColor } from './colorUtils';

/**
 * Universal exclusion patterns for text content.
 * Used by buttons analysis and mobile usability checks.
 * Case-insensitive.
 */
export const UNIVERSAL_TEXT_EXCLUSIONS = [
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

/**
 * Checks if an element is visible according to basic computed styles.
 * Note: Footer elements often require more lenient checks in other contexts,
 * but this serves as the standard baseline.
 */
export function isVisibleElement(element: Element, computed?: CSSStyleDeclaration): boolean {
  if (!element) return false;

  if (!computed) {
    computed = window.getComputedStyle(element);
  }

  // Basic display/visibility/opacity checks
  if (computed.display === 'none') return false;
  if (computed.visibility === 'hidden') return false;

  const opacity = parseFloat(computed.opacity);
  if (!isNaN(opacity) && opacity < 0.01) return false;

  // Dimensions check (if connected to DOM)
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;

  return true;
}

/**
 * Checks if key text content matches universal exclusion patterns
 */
export function matchesExclusionPattern(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  return UNIVERSAL_TEXT_EXCLUSIONS.some(pattern => lower.includes(pattern));
}

/**
 * Detects complex backgrounds (gradients, images) on the element or its ancestors.
 * Used to suppress contrast errors where automated detection is unreliable.
 */
export function hasGradientBackground(element: Element): boolean {
  let el: Element | null = element;
  let depth = 0;

  // Check up to 10 levels up for a background that might be providing the contrast
  while (el && depth < 10) {
    if (el === document.body) break;

    const computed = window.getComputedStyle(el);

    // Check background-image property for gradient functions or urls
    const bgImage = computed.backgroundImage || '';
    // Check background shorthand (used by some frameworks/browsers)
    const bgShorthand = computed.background || '';

    const hasGradient =
      bgImage.includes('gradient') ||
      bgImage.includes('url(') ||
      bgShorthand.includes('gradient') ||
      bgShorthand.includes('url(');

    if (hasGradient) {
      // Ensure the gradient isn't hidden or transparent
      if (isVisibleElement(el, computed) && !isTransparentColor(computed.opacity)) {
        return true;
      }
    }

    el = el.parentElement;
    depth++;
  }

  return false;
}

/**
 * Checks if an element is a "Ghost Button" (no text, no label).
 * Ported from analyzers/colors.ts
 */
export function isGhostButton(element: Element): boolean {
  const tag = element.tagName;
  const isButtonTag = tag === 'BUTTON';
  const isAnchorButton = tag === 'A' && element.classList && element.classList.contains('button');

  if (!isButtonTag && !isAnchorButton) return false;

  const text = (element.textContent || (element as HTMLElement).innerText || '').trim();
  const ariaLabel = element.getAttribute('aria-label');

  if (!text && !ariaLabel) {
    return true;
  }

  return false;
}

/**
 * Checks if an element acts as an accordion or FAQ toggle.
 * Used to exclude these from button inventories.
 */
export function isAccordionOrToggle(element: Element): boolean {
  const ariaExpanded = element.getAttribute('aria-expanded');
  const ariaControls = element.getAttribute('aria-controls');
  const className = (element.className || '').toLowerCase();

  // Direct attributes/classes
  if (ariaExpanded !== null || ariaControls !== null) return true;

  if (
    className.includes('accordion') ||
    className.includes('collapse') ||
    className.includes('toggle') ||
    className.includes('dropdown')
  ) {
    return true;
  }

  // Parent check (up to 3 levels)
  let parent = element.parentElement;
  for (let i = 0; i < 3; i++) {
    if (!parent) break;
    const parentClass = (parent.className || '').toLowerCase();
    if (
      parentClass.includes('accordion') ||
      parentClass.includes('faq') ||
      parentClass.includes('collapse')
    ) {
      return true;
    }
    parent = parent.parentElement;
  }

  return false;
}

/**
 * Generic filter entry point.
 * Returns TRUE if the element should be filtered out (ignored).
 *
 * @param element The element to check
 * @param checkType 'contrast' | 'content' | 'mobile'
 */
export function shouldFilterElement(
  element: Element,
  checkType: 'contrast' | 'content' | 'mobile' = 'content'
): boolean {
  // 1. Ghost Buttons (relevant for all)
  if (isGhostButton(element)) return true;

  // 2. Text Exclusions (relevant for content/mobile)
  if (checkType !== 'contrast') {
    const text = element.textContent || element.getAttribute('aria-label') || '';
    if (matchesExclusionPattern(text)) return true;

    if (isAccordionOrToggle(element)) return true;
  }

  // 3. Contrast Specific Checks
  if (checkType === 'contrast') {
    const text = element.textContent || '';

    // Typing cursor filter (e.g. "Text |")
    if (/\|\s*$/.test(text)) return true;

    // WordPress button wrapper (we analyze the inner link instead)
    if (element.classList && element.classList.contains('wp-block-button')) {
      return true;
    }

    // Gradient Background Check
    if (hasGradientBackground(element)) {
      console.debug('[Refactor] Filtered gradient background:', element);
      return true;
    }
  }

  return false;
}
