import {
  rgbToHex,
  calculateContrastRatio,
  getWCAGLevel,
  isTransparentColor,
  isVisuallySimilar,
} from '../utils/colorUtils';
import { shouldFilterElement } from '../utils/issueFilters';
import { generateSelector, getTextNodeFontSize } from '../utils/domHelpers';
import type { Platform } from '../platforms';

export interface ContrastIssue {
  textColor: string;
  backgroundColor: string;
  ratio: number;
  passes: boolean;
  wcagLevel: 'AAA' | 'AA' | 'Fail';
  isLargeText: boolean;
  page: string;
  pageTitle: string;
  location: string;
  section: string;
  block: string;
  element: string;
  elementText: string;
  fontSize: number;
  fontSizeString: string;
  fontSizeUndetermined: boolean;
  fontWeight: number;
  coords: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  };
  selector: string;
}

export interface ColorInstance {
  page: string;
  pageTitle: string;
  element: string;
  property: string;
  section: string;
  block: string;
  context: string;
  pairedWith: string | null;
  selector: string;
  /** The exact hex code detected on this element before fuzzy merging */
  originalHex?: string;
  /** Added for Styles popup */
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  lineHeight?: string;
  elementText?: string;
  /** Variations merged into this entry (for report badges) */
  mergedColors?: string[];
  /** Border and background styles for popup */
  borderRadius?: string;
  borderStyle?: string;
  borderWidth?: string;
  backgroundImage?: string;
}

export interface ColorData {
  colors: Record<
    string,
    {
      count: number;
      usedAs: string[];
      instances: ColorInstance[];
      /** Set of original hex codes that were visually similar and merged into this entry */
      mergedColors?: Set<string> | string[];
    }
  >;
  contrastPairs: ContrastIssue[];
  _processedContrastElements: Set<string>;
  backgroundColors: Set<string>;
  textColors: Set<string>;
  fillColors: Set<string>;
  borderColors: Set<string>;
  allColors: Set<string>;
  // Helper for tracking processed elements to avoid duplicates
  _processedElements?: Set<Element>;
}

// Determine if element is within navigation, header, or footer
export function getElementLocation(element: Element): string {
  // First check if element is inside a content block/section
  let checkContent: Element | null = element;
  let contentDepth = 0;
  while (checkContent && contentDepth < 10) {
    const className = checkContent.className || '';
    const classLower = (typeof className === 'string' ? className : '').toLowerCase();

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
      return 'content';
    }

    if (
      classLower.includes('skip-link') ||
      classLower.includes('sr-only') ||
      classLower.includes('visually-hidden')
    ) {
      return 'content';
    }

    checkContent = checkContent.parentElement;
    contentDepth++;
  }

  let el: Element | null = element;
  let depth = 0;

  while (el && depth < 15) {
    const tagName = el.tagName ? el.tagName.toLowerCase() : '';

    if (tagName === 'nav') return 'navigation';
    if (tagName === 'header') return 'header';
    if (tagName === 'footer') return 'footer';

    const className = el.className || '';
    const id = el.id || '';
    if (
      className.toLowerCase().includes('nav') ||
      id.toLowerCase().includes('nav') ||
      className.toLowerCase().includes('menu')
    ) {
      return 'navigation';
    }

    if (className.toLowerCase().includes('header') || id.toLowerCase().includes('header')) {
      return 'header';
    }

    if (className.toLowerCase().includes('footer') || id.toLowerCase().includes('footer')) {
      return 'footer';
    }

    el = el.parentElement;
    depth++;
  }

  return 'content';
}

export function isGhostButtonForColorAnalysis(element: Element): boolean {
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

export function getElementContext(element: Element): string {
  if (
    element.tagName === 'BUTTON' ||
    (element.tagName === 'A' && element.classList.contains('button'))
  ) {
    const buttonText = (element.textContent || (element as HTMLElement).innerText || '').trim();
    const buttonUrl = (element as HTMLAnchorElement).href || '';
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
    if (fullText.match(/^https?:\/\/[^\s]+$/)) {
      return 'Paragraph: "' + fullText + '"';
    }
    const sentenceMatch = fullText.match(/^[^.!?]+[.!?]/);
    const firstSentence = sentenceMatch ? sentenceMatch[0] : fullText.substring(0, 80);
    const displayText =
      firstSentence.length > 80 ? firstSentence.substring(0, 80) + '...' : firstSentence;
    return 'Paragraph: "' + displayText + '"';
  }
  if (element.tagName === 'A') {
    const linkText = (element.textContent || '').trim();
    const linkUrl = (element as HTMLAnchorElement).href || '';
    const displayText = linkText.substring(0, 30) + (linkText.length > 30 ? '...' : '');
    const displayUrl = linkUrl.length > 50 ? linkUrl.substring(0, 50) + '...' : linkUrl;
    return 'Link: "' + displayText + '" → ' + displayUrl;
  }
  if (element.tagName === 'DIV') {
    const text = (element.textContent || '').trim();
    if (text.length > 0) {
      const display = text.length > 60 ? text.substring(0, 60) + '...' : text;
      const className =
        element.className && typeof element.className === 'string'
          ? '.' + element.className.split(' ')[0]
          : '';
      const id = element.id ? '#' + element.id : '';
      return `DIV${id}${className}: "${display}"`;
    }
  }
  return element.tagName + (element.className ? '.' + element.className.split(' ')[0] : '');
}

export async function trackColor(
  colorValue: string | null,
  element: Element,
  property: string,
  pairedColor: string | null,
  colorData: ColorData,
  getSectionInfo: (el: Element) => string,
  getBlockInfo: (el: Element) => string,
  screenshot: string | null = null,
  platform: Platform = 'generic'
): Promise<void> {
  if (!colorValue || isTransparentColor(colorValue)) return;

  if (isGhostButtonForColorAnalysis(element)) return;

  // Track unique instances per element + color + property
  const elementId = generateSelector(element);
  const uniqueKey = `${elementId}-${property}-${colorValue}`;

  if (!colorData._processedElements) {
    colorData._processedElements = new Set();
  }

  if (colorData._processedElements.has(elementId as any)) {
    // Already processed this element? Check if we should skip
    // We allow tracking different PROPERTIES for the same element, but not duplicates of the same property
    const propKey = `${elementId}-${property}`;
    if ((colorData as any)._processedElementProps?.has(propKey)) {
      return;
    }
    if (!(colorData as any)._processedElementProps) {
      (colorData as any)._processedElementProps = new Set();
    }
    (colorData as any)._processedElementProps.add(propKey);
  } else {
    colorData._processedElements.add(elementId as any);
  }

  const hexValue = rgbToHex(colorValue);
  if (!hexValue) return;
  const hex = hexValue.toLowerCase();

  // IMPORTANT: Fuzzy matching using Redmean perceptual distance.
  // Before creating a new color entry, check if a visually indistinguishable
  // color already exists. This prevents browser rendering artifacts
  // (anti-aliasing, sub-pixel rounding) from creating duplicate entries
  // like #2C3337 and #2C3338.
  let targetHex = hex;
  let isMerged = false;

  // First check for exact match (fast path)
  if (!colorData.colors[hex]) {
    // No exact match — check for visually similar existing colors
    const existingColors = Object.keys(colorData.colors);
    for (let i = 0; i < existingColors.length; i++) {
      if (isVisuallySimilar(hex, existingColors[i])) {
        targetHex = existingColors[i];
        isMerged = true;
        break;
      }
    }
  }

  if (colorData.allColors) {
    // IMPORTANT: Add the targetHex (master) to the category sets, not the original.
    // This keeps the Sets clean and prevents "phantom" colors in category counts.
    colorData.allColors.add(targetHex);

    if (property === 'background-color' && colorData.backgroundColors) {
      colorData.backgroundColors.add(targetHex);
    } else if (property === 'color' && colorData.textColors) {
      colorData.textColors.add(targetHex);
    } else if ((property === 'fill' || property === 'stroke') && colorData.fillColors) {
      colorData.fillColors.add(targetHex);
    } else if (property === 'border-color' && colorData.borderColors) {
      colorData.borderColors.add(targetHex);
    }
  }

  if (!colorData.colors[targetHex]) {
    colorData.colors[targetHex] = {
      count: 0,
      usedAs: [],
      instances: [],
      mergedColors: new Set<string>(),
    };
  }

  // Ensure mergedColors is a Set (defensive against serialization artifacts)
  if (!(colorData.colors[targetHex].mergedColors instanceof Set)) {
    const existing = colorData.colors[targetHex].mergedColors;
    if (Array.isArray(existing)) {
      colorData.colors[targetHex].mergedColors = new Set(existing);
    } else {
      colorData.colors[targetHex].mergedColors = new Set();
    }
  }

  colorData.colors[targetHex].count++;

  // Track merged original hex codes for the [+N similar] badge in the report
  if (isMerged && hex !== targetHex) {
    (colorData.colors[targetHex].mergedColors as Set<string>).add(hex);
  }

  if (
    property === 'background-color' &&
    !colorData.colors[targetHex].usedAs.includes('background')
  ) {
    colorData.colors[targetHex].usedAs.push('background');
  } else if (property === 'color' && !colorData.colors[targetHex].usedAs.includes('text')) {
    colorData.colors[targetHex].usedAs.push('text');
  } else if (
    (property === 'fill' || property === 'stroke') &&
    !colorData.colors[targetHex].usedAs.includes('fill')
  ) {
    colorData.colors[targetHex].usedAs.push('fill');
  } else if (
    property === 'border-color' &&
    !colorData.colors[targetHex].usedAs.includes('border')
  ) {
    colorData.colors[targetHex].usedAs.push('border');
  }

  // Determine effective paired color (climb tree for background if needed)
  let effectivePaired = pairedColor;
  if (property === 'color') {
    // TRUTH CHECK: If this is a DIV, ensure it actually contains text before tracking color.
    // If it's a structural DIV with no text, tracking 'color' just creates inherited noise.
    const hasText = element.textContent && element.textContent.trim().length > 0;
    const hasSemanticChild = element.querySelector('h1, h2, h3, h4, h5, h6, p, button, a');

    if (element.tagName === 'DIV' && !hasText && !hasSemanticChild) {
      // It's a structural box, likely a background. Tracking text-color here is misleading.
      return;
    }

    // If we are tracking text color, the paired color is the background.
    // Use platform-specific detection for accurate background color
    effectivePaired = await getEffectiveBackgroundColor(element, pairedColor, screenshot, platform);
  }

  const computed = window.getComputedStyle(element);
  const { fontSizeString } = getTextNodeFontSize(element);

  // Capture current set of merged colors as a clean array for this instance
  const masterMergedColors = colorData.colors[targetHex].mergedColors;
  const mergedList =
    masterMergedColors instanceof Set
      ? Array.from(masterMergedColors as Set<string>)
      : Array.isArray(masterMergedColors)
        ? masterMergedColors
        : [];

  // Determine descriptive label instead of just "DIV"
  let displayTag = element.tagName;
  if (displayTag === 'DIV') {
    // If it's a DIV, check if it contains a child that better describes it
    const semanticChild = element.querySelector('h1, h2, h3, h4, h5, h6, p, button, a');
    if (semanticChild) {
      displayTag = `DIV (${semanticChild.tagName})`;
    } else if (element.textContent && element.textContent.trim().length > 0) {
      displayTag = 'DIV (Text Container)';
    }
  }

  colorData.colors[targetHex].instances.push({
    page: window.location.href,
    pageTitle: document.title || 'Unknown',
    element: displayTag,
    property: property,
    section: getSectionInfo(element),
    block: getBlockInfo(element),
    context: getElementContext(element),
    pairedWith: effectivePaired ? (rgbToHex(effectivePaired) || '').toLowerCase() : null,
    selector: generateSelector(element),
    // Preserve the original hex for audit trail transparency
    // IMPORTANT: Always track originalHex to enable accurate counting in merged badges
    originalHex: hex.toLowerCase(),
    // Style metadata for popup
    fontSize: fontSizeString,
    fontWeight: computed.fontWeight,
    fontFamily: computed.fontFamily,
    lineHeight: computed.lineHeight,
    elementText: (element.textContent || '').trim().substring(0, 300),
    // Propagate variations to this specific instance for the report cards
    mergedColors: mergedList.map(c => c.toLowerCase()),
    // Border and background metadata for Styles popup
    borderRadius: computed.borderRadius,
    borderStyle: computed.borderStyle,
    borderWidth: computed.borderWidth,
    backgroundImage: computed.backgroundImage !== 'none' ? computed.backgroundImage : undefined,
  });
}

// Background detection
export async function getBackgroundColorFromCanvas(
  element: Element,
  screenshot: string | null
): Promise<string | null> {
  const rect = element.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0) {
    return null;
  }

  if (!screenshot) {
    return null;
  }

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = screenshot;
    });

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const devicePixelRatio = window.devicePixelRatio || 1;
    const centerX = Math.floor((rect.left + rect.width / 2) * devicePixelRatio);
    const centerY = Math.floor((rect.top + rect.height / 2) * devicePixelRatio);

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
}

import { detectBackground } from './backgroundDetectors';

/**
 * Get effective background color using platform-specific detection
 * 
 * IMPORTANT: This function now uses platform-specific detection strategies to handle
 * different CMS platforms' rendering approaches. WordPress often renders backgrounds
 * on pseudo-elements, while Squarespace uses standard CSS.
 * 
 * @param element - Element to check
 * @param initialBackgroundColor - Initial background color from computed style
 * @param screenshot - Screenshot for canvas verification
 * @param platform - Platform type (wordpress, squarespace, wix, webflow, shopify, generic)
 * @returns RGB/RGBA color string, or null if detection fails
 */
export async function getEffectiveBackgroundColor(
  element: Element,
  initialBackgroundColor: string | null,
  screenshot: string | null,
  platform: Platform = 'generic'
): Promise<string | null> {
  // Use platform-specific background detector
  const result = await detectBackground(
    platform,
    element,
    initialBackgroundColor,
    screenshot
  );

  return result.color;
}

export async function trackContrastPair(
  element: Element,
  textColor: string,
  backgroundColor: string,
  colorData: ColorData,
  getSectionInfo: (el: Element) => string,
  getBlockInfo: (el: Element) => string,
  screenshot: string | null,
  platform: Platform = 'generic'
): Promise<ContrastIssue | undefined> {
  if (!element || !colorData || !textColor) return;

  if (isGhostButtonForColorAnalysis(element)) return;

  const tagName = element.tagName.toLowerCase();
  const isButton = tagName === 'button' || tagName === 'a' || tagName === 'input';
  const hasButtonRole = element.getAttribute('role') === 'button';
  const hasButtonClass = (element.className || '').toLowerCase().includes('button');
  const isButtonLike = isButton || hasButtonRole || hasButtonClass;

  let hasDirectText = false;

  if (isButtonLike) {
    const text = element.textContent?.trim() || '';
    if (text.length > 0) {
      hasDirectText = true;
    }
  } else {
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      if (node.nodeType === 3 && node.textContent?.trim()?.length! > 0) {
        // 3 = TEXT_NODE
        hasDirectText = true;
        break;
      }
    }
  }

  if (!hasDirectText) return;

  const textHex = rgbToHex(textColor);
  if (!textHex) return;

  // Use platform-specific background detection for accurate contrast calculation
  const effectiveBg = await getEffectiveBackgroundColor(element, backgroundColor, screenshot, platform);
  const bgHex = rgbToHex(effectiveBg);

  if (!bgHex) return;

  if (textHex === bgHex) {
    return;
  }

  const section = getSectionInfo(element);
  const block = getBlockInfo(element);
  const location = getElementContext(element);
  const elementKey = window.location.href + '|' + section + '|' + block + '|' + location;

  if (!colorData._processedContrastElements) {
    colorData._processedContrastElements = new Set();
  }

  if (colorData._processedContrastElements.has(elementKey)) {
    return;
  }
  colorData._processedContrastElements.add(elementKey);

  const ratio = calculateContrastRatio(textHex, bgHex);
  const rect = element.getBoundingClientRect();

  const computed = window.getComputedStyle(element);

  // IMPORTANT: Get accurate font size by finding the text node's actual rendering context.
  // This is more accurate than reading from the container element because
  // the text may be in a nested element with different styling.
  const { fontSize, fontSizeString, fontSizeUndetermined } = getTextNodeFontSize(element);

  /* Refactored: Centralized filtering via issueFilters.ts */
  if (shouldFilterElement(element, 'contrast')) {
    return;
  }

  const fontWeight = parseInt(computed.fontWeight, 10) || 400;
  const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
  const wcagLevel = getWCAGLevel(ratio, isLargeText);

  // Use absolute coordinates including scroll
  const coords = {
    top: rect.top + window.scrollY,
    bottom: rect.bottom + window.scrollY,
    left: rect.left + window.scrollX,
    right: rect.right + window.scrollX,
    width: rect.width,
    height: rect.height,
  };

  const issue: ContrastIssue = {
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
    elementText: element.textContent?.trim() || '',
    fontSize: Math.round(fontSize),
    fontSizeString: fontSizeString,
    fontSizeUndetermined: fontSizeUndetermined,
    fontWeight: fontWeight,
    coords: coords,
    selector: generateSelector(element),
  };

  colorData.contrastPairs.push(issue);
  return issue;
}

export function initializeColorData(): ColorData {
  return {
    colors: {},
    contrastPairs: [],
    _processedContrastElements: new Set(),
    backgroundColors: new Set(),
    textColors: new Set(),
    fillColors: new Set(),
    borderColors: new Set(),
    allColors: new Set(),
    _processedElements: new Set(),
  };
}

/**
 * Finalizes color data by converting all Sets to Arrays.
 * This ensures the data is JSON-compatible for storage or export.
 */
/**
 * DRY Helper: Determines if a border color should be tracked based on width, style, and visual noise rules.
 */
export function shouldTrackBorder(
  color: string,
  width: number,
  style: string,
  bgColor: string | null
): boolean {
  if (!color || isTransparentColor(color)) return false;

  // 1. Noise Filter: Ignore sub-pixel borders (common in CSS resets/normalization)
  if (width < 1) return false;

  // 2. Visibility Filter: Ignore hidden or none styles
  if (!style || style === 'none' || style === 'hidden') return false;

  // 3. Visual Noise: If border matches background and is thin, it's effectively invisible/background noise
  if (bgColor && color === bgColor && width < 3) return false;

  return true;
}

export function finalizeColorData(colorData: ColorData): any {
  if (!colorData) return colorData;

  const result: any = {
    ...colorData,
    backgroundColors: colorData.backgroundColors ? Array.from(colorData.backgroundColors) : [],
    textColors: colorData.textColors ? Array.from(colorData.textColors) : [],
    fillColors: colorData.fillColors ? Array.from(colorData.fillColors) : [],
    borderColors: colorData.borderColors ? Array.from(colorData.borderColors) : [],
    allColors: colorData.allColors ? Array.from(colorData.allColors) : [],
    _processedContrastElements: (colorData as any)._processedContrastElements
      ? Array.from((colorData as any)._processedContrastElements)
      : [],
    // Don't serialize the elements set
    _processedElements: [],
  };

  // Convert mergedColors Set to Array for each color AND ensure all instances carry it
  if (colorData.colors) {
    Object.keys(colorData.colors).forEach(hex => {
      const entry = colorData.colors[hex];
      let mergedList: string[] = [];

      if (entry.mergedColors instanceof Set) {
        mergedList = Array.from(entry.mergedColors as Set<string>);
      } else if (Array.isArray(entry.mergedColors)) {
        mergedList = entry.mergedColors;
      }

      (entry as any).mergedColors = mergedList;

      // CRITICAL: Propagate final merged list to all instances for report rendering
      if (entry.instances) {
        entry.instances.forEach(inst => {
          inst.mergedColors = mergedList;
        });
      }
    });
  }

  return result;
}
