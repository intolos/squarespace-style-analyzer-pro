import { getStyleDefinition } from '../../analyzers/styleExtractor';
import { ColorTracker } from '../../utils/colorUtils';
import { ColorData } from '../../analyzers/colors';
import type { Platform } from '../../platforms';

// Helper function to get most common style for a heading type
function getMostCommonHeadingStyle(
  headingElements: NodeListOf<HTMLHeadingElement> | Element[],
  getStyleDefFn: (element: Element, elementType: string) => Promise<string>,
  platform: Platform
): Promise<string | null> {
  if (!headingElements || headingElements.length === 0) return Promise.resolve(null);

  const styleMap: Record<string, { count: number; element: Element }> = {};
  for (let i = 0; i < headingElements.length; i++) {
    const el = headingElements[i];
    const computed = window.getComputedStyle(el);
    const fontFamily = computed.fontFamily;

    if (!styleMap[fontFamily]) {
      styleMap[fontFamily] = {
        count: 0,
        element: el,
      };
    }
    styleMap[fontFamily].count++;
  }

  // Find most common font
  let maxCount = 0;
  let mostCommonElement: Element | null = null;
  for (const font in styleMap) {
    if (styleMap[font].count > maxCount) {
      maxCount = styleMap[font].count;
      mostCommonElement = styleMap[font].element;
    }
  }

  return mostCommonElement ? getStyleDefFn(mostCommonElement, 'heading') : Promise.resolve(null);
}

export async function captureSquarespaceThemeStyles(
  colorTracker: ColorTracker,
  colorData: ColorData,
  platform: Platform = 'squarespace'
): Promise<any> {
  const themeStyles: any = {
    headingStyles: {},
    paragraphStyles: {},
    miscFont: '',
  };

  // Create a wrapper for getStyleDefinition that includes colorTracker, colorData, and platform
  const getStyleDefFn = (element: Element, elementType: string) => {
    return getStyleDefinition(element as HTMLElement, elementType, colorTracker, colorData, platform);
  };

  // Capture each heading type using most common style
  const h1Elements = document.querySelectorAll('h1');
  const h2Elements = document.querySelectorAll('h2');
  const h3Elements = document.querySelectorAll('h3');
  const h4Elements = document.querySelectorAll('h4');
  const h5Elements = document.querySelectorAll('h5');
  const h6Elements = document.querySelectorAll('h6');

  if (h1Elements.length > 0) {
    themeStyles.headingStyles['heading-1'] = await getMostCommonHeadingStyle(
      h1Elements,
      getStyleDefFn,
      platform
    );
  } else {
    themeStyles.headingStyles['heading-1'] = 'Not used on the pages analyzed';
  }

  if (h2Elements.length > 0) {
    themeStyles.headingStyles['heading-2'] = await getMostCommonHeadingStyle(
      h2Elements,
      getStyleDefFn,
      platform
    );
  } else {
    themeStyles.headingStyles['heading-2'] = 'Not used on the pages analyzed';
  }

  if (h3Elements.length > 0) {
    themeStyles.headingStyles['heading-3'] = await getMostCommonHeadingStyle(
      h3Elements,
      getStyleDefFn,
      platform
    );
  } else {
    themeStyles.headingStyles['heading-3'] = 'Not used on the pages analyzed';
  }

  if (h4Elements.length > 0) {
    themeStyles.headingStyles['heading-4'] = await getMostCommonHeadingStyle(
      h4Elements,
      getStyleDefFn,
      platform
    );
  } else {
    themeStyles.headingStyles['heading-4'] = 'Not used on the pages analyzed';
  }

  if (h5Elements.length > 0) {
    themeStyles.headingStyles['heading-5'] = await getMostCommonHeadingStyle(
      h5Elements,
      getStyleDefFn,
      platform
    );
  } else {
    themeStyles.headingStyles['heading-5'] = 'Not used on the pages analyzed';
  }

  if (h6Elements.length > 0) {
    themeStyles.headingStyles['heading-6'] = await getMostCommonHeadingStyle(
      h6Elements,
      getStyleDefFn,
      platform
    );
  } else {
    themeStyles.headingStyles['heading-6'] = 'Not used on the pages analyzed';
  }

  // Capture paragraph styles by font size and context
  const allTextElements = document.querySelectorAll('p, li');
  const p1Candidates: Element[] = [];
  const p2Candidates: Element[] = [];
  const p3Candidates: Element[] = [];

  for (let i = 0; i < allTextElements.length; i++) {
    const el = allTextElements[i];
    const computed = window.getComputedStyle(el);
    const fontSize = parseFloat(computed.fontSize);

    // Skip if in nav/header/footer
    let parent: Element | null = el;
    let inNavigation = false;
    for (let p = 0; p < 5; p++) {
      if (!parent) break;
      const parentClass = (parent.className || '').toLowerCase();
      if (
        parentClass.includes('nav') ||
        parentClass.includes('header') ||
        parentClass.includes('menu')
      ) {
        inNavigation = true;
        break;
      }
      parent = parent.parentElement;
    }
    if (inNavigation) continue;

    const p1Size = 1.5 * 16;
    const p2Size = 1.1 * 16;
    const p3Size = 1.0 * 16;

    const distanceToP1 = Math.abs(fontSize - p1Size);
    const distanceToP2 = Math.abs(fontSize - p2Size);
    const distanceToP3 = Math.abs(fontSize - p3Size);

    const minDistance = Math.min(distanceToP1, distanceToP2, distanceToP3);
    if (minDistance === distanceToP1) {
      p1Candidates.push(el);
    } else if (minDistance === distanceToP3) {
      p3Candidates.push(el);
    } else {
      p2Candidates.push(el);
    }
  }

  const paragraphSizes: Record<string, number | null> = {
    'paragraph-1': null,
    'paragraph-2': null,
    'paragraph-3': null,
  };

  if (p1Candidates.length > 0) {
    themeStyles.paragraphStyles['paragraph-1'] = await getMostCommonHeadingStyle(
      p1Candidates,
      getStyleDefFn,
      platform
    );
    const firstP1 = p1Candidates[0];
    paragraphSizes['paragraph-1'] = parseFloat(window.getComputedStyle(firstP1).fontSize);
  } else {
    themeStyles.paragraphStyles['paragraph-1'] = 'Not used on the pages analyzed';
  }

  if (p2Candidates.length > 0) {
    themeStyles.paragraphStyles['paragraph-2'] = await getMostCommonHeadingStyle(
      p2Candidates,
      getStyleDefFn,
      platform
    );
    const firstP2 = p2Candidates[0];
    paragraphSizes['paragraph-2'] = parseFloat(window.getComputedStyle(firstP2).fontSize);
  } else if (allTextElements.length > 0) {
    const firstP = document.querySelector('p');
    if (firstP) {
      themeStyles.paragraphStyles['paragraph-2'] = await getStyleDefFn(firstP, 'paragraph');
      paragraphSizes['paragraph-2'] = parseFloat(window.getComputedStyle(firstP).fontSize);
    } else {
      themeStyles.paragraphStyles['paragraph-2'] = 'Not used on the pages analyzed';
    }
  } else {
    themeStyles.paragraphStyles['paragraph-2'] = 'Not used on the pages analyzed';
  }

  if (p3Candidates.length > 0) {
    themeStyles.paragraphStyles['paragraph-3'] = await getMostCommonHeadingStyle(
      p3Candidates,
      getStyleDefFn,
      platform
    );
    const firstP3 = p3Candidates[0];
    paragraphSizes['paragraph-3'] = parseFloat(window.getComputedStyle(firstP3).fontSize);
  } else {
    themeStyles.paragraphStyles['paragraph-3'] = 'Not used on the pages analyzed';
  }

  themeStyles.paragraphSizes = paragraphSizes;

  // Check for miscellaneous font in CSS variables
  const root = document.documentElement;
  const computedStyle = window.getComputedStyle(root);
  const miscFontVar =
    computedStyle.getPropertyValue('--misc-font') ||
    computedStyle.getPropertyValue('--miscellaneous-font') ||
    computedStyle.getPropertyValue('--font-misc') ||
    computedStyle.getPropertyValue('--sqs-misc-font');

  if (miscFontVar) {
    const miscFont = miscFontVar.trim();
    themeStyles.miscFont = miscFont;

    const allElements = document.querySelectorAll('span, div, p, a, li, button');
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      const elComputed = window.getComputedStyle(el);
      const elFontFamily = elComputed.fontFamily;

      if (
        elFontFamily &&
        miscFont &&
        elFontFamily
          .toLowerCase()
          .includes(miscFont.toLowerCase().split(',')[0].trim().replace(/['"]/g, ''))
      ) {
        const miscStyleDef: string[] = [];
        miscStyleDef.push('font-family: ' + elComputed.fontFamily);
        miscStyleDef.push('font-size: ' + elComputed.fontSize);
        miscStyleDef.push('font-weight: ' + elComputed.fontWeight);
        miscStyleDef.push('line-height: ' + elComputed.lineHeight);
        miscStyleDef.push('color: ' + elComputed.color);
        if (elComputed.textTransform !== 'none')
          miscStyleDef.push('text-transform: ' + elComputed.textTransform);
        if (elComputed.letterSpacing !== 'normal' && elComputed.letterSpacing !== '0px')
          miscStyleDef.push('letter-spacing: ' + elComputed.letterSpacing);

        themeStyles.miscFontStyle = miscStyleDef.join('; ');
        break;
      }
    }
  }

  return themeStyles;
}
