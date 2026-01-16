import {
  rgbToHex,
  calculateContrastRatio,
  getWCAGLevel,
  isTransparentColor,
} from '../utils/colorUtils';
import { generateSelector } from '../utils/domHelpers';

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
  coords: {
    top: number;
    left: number;
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
}

export interface ColorData {
  colors: Record<
    string,
    {
      count: number;
      usedAs: string[];
      instances: ColorInstance[];
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
  return element.tagName + (element.className ? '.' + element.className.split(' ')[0] : '');
}

export function trackColor(
  colorValue: string | null,
  element: Element,
  property: string,
  pairedColor: string | null,
  colorData: ColorData,
  getSectionInfo: (el: Element) => string,
  getBlockInfo: (el: Element) => string
): void {
  if (!colorValue || isTransparentColor(colorValue)) return;

  if (isGhostButtonForColorAnalysis(element)) return;

  const hex = rgbToHex(colorValue);
  if (!hex) return;

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
    context: getElementContext(element),
    pairedWith: pairedColor ? rgbToHex(pairedColor) : null,
    selector: generateSelector(element),
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

export async function getEffectiveBackgroundColor(
  element: Element,
  initialBackgroundColor: string | null,
  screenshot: string | null
): Promise<string | null> {
  if (initialBackgroundColor && !isTransparentColor(initialBackgroundColor)) {
    return initialBackgroundColor;
  }

  let domBackground: string | null = null;
  let el: Element | null = element;
  while (el) {
    const style = window.getComputedStyle(el);
    const bg = style && style.backgroundColor;
    if (bg && !isTransparentColor(bg)) {
      domBackground = bg;
      break;
    }
    el = el.parentElement;
  }

  if (!domBackground) {
    domBackground = 'rgb(255, 255, 255)';
  }

  const tagName = element.tagName.toLowerCase();
  const isButton = tagName === 'button' || tagName === 'a' || tagName === 'input';
  const hasButtonRole = element.getAttribute('role') === 'button';
  const hasButtonClass = (element.className || '').toLowerCase().includes('button');
  const isButtonLike = isButton || hasButtonRole || hasButtonClass;

  if (isButtonLike && screenshot) {
    try {
      const screenshotBg = await getBackgroundColorFromCanvas(element, screenshot);
      if (screenshotBg && !isTransparentColor(screenshotBg)) {
        const domHex = rgbToHex(domBackground);
        const screenshotHex = rgbToHex(screenshotBg);

        if (domHex !== screenshotHex) {
          return screenshotBg;
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  return domBackground;
}

export async function trackContrastPair(
  element: Element,
  textColor: string,
  backgroundColor: string,
  colorData: ColorData,
  getSectionInfo: (el: Element) => string,
  getBlockInfo: (el: Element) => string,
  screenshot: string | null
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
      if (node.nodeType === 3 && node.textContent?.trim().length > 0) {
        // 3 = TEXT_NODE
        hasDirectText = true;
        break;
      }
    }
  }

  if (!hasDirectText) return;

  const textHex = rgbToHex(textColor);
  if (!textHex) return;

  const effectiveBg = await getEffectiveBackgroundColor(element, backgroundColor, screenshot);
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
  const fontSize = parseFloat(computed.fontSize) || 0;
  const fontWeight = parseInt(computed.fontWeight, 10) || 400;
  const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
  const wcagLevel = getWCAGLevel(ratio, isLargeText);

  // Use absolute coordinates including scroll
  const coords = {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
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
