// analyzers/typography.ts
// Analyzes headings, paragraphs, and lists

import {
  getSectionInfo,
  getBlockInfo,
  generateSelector,
  extractFontSize,
} from '../utils/domHelpers';
import { getStyleDefinition } from './styleExtractor';
import { type ColorData } from './colors';

export async function analyzeHeadings(
  results: any,
  navigationName: string,
  colorTracker: any, // Legacy
  colorData: ColorData
): Promise<void> {
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  console.log('Found headings:', headings.length);

  let h1Count = 0;
  const headingSequence: number[] = [];
  const fontSizesByType: Record<string, any[]> = {
    'heading-1': [],
    'heading-2': [],
    'heading-3': [],
    'heading-4': [],
    'heading-5': [],
    'heading-6': [],
  };

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i] as HTMLElement;
    const tagName = heading.tagName.toLowerCase();
    const headingLevel = parseInt(tagName.charAt(1));
    const headingType = 'heading-' + headingLevel;

    if (tagName === 'h1') h1Count++;

    headingSequence.push(headingLevel);

    const text = (heading.textContent || '').trim();
    const section = getSectionInfo(heading);
    const block = getBlockInfo(heading);
    const styleDefinition = await getStyleDefinition(heading, 'heading', colorTracker, colorData);
    const computed = window.getComputedStyle(heading);
    const fontSize = computed.fontSize;

    if (headingType in fontSizesByType) {
      fontSizesByType[headingType].push({
        size: fontSize,
        location: navigationName + ' - ' + section,
      });
    }

    if (headingType in results.headings && results.headings[headingType].locations) {
      results.headings[headingType].locations.push({
        navigationName: navigationName,
        url: window.location.href,
        styleDefinition: styleDefinition,
        text: text.substring(0, 200),
        pageTitle: document.title || 'Unknown',
        section: section,
        block: block,
        styles: heading.className || '',
        selector: generateSelector(heading),
      });
    }
  }

  // Quality checks
  if (h1Count === 0) {
    results.qualityChecks.missingH1.push({
      page: navigationName,
      url: window.location.href,
    });
  }

  if (h1Count > 1) {
    results.qualityChecks.multipleH1.push({
      page: navigationName,
      url: window.location.href,
      count: h1Count,
    });
  }

  // Broken heading hierarchy check
  if (headingSequence.length > 0) {
    let lastLevel = 0;
    let lastHeadingText = '';

    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const currentLevel = parseInt(heading.tagName.charAt(1));
      const currentText = (heading.textContent || '').trim();
      const section = getSectionInfo(heading);
      const block = getBlockInfo(heading);

      if (lastLevel > 0 && currentLevel > lastLevel + 1) {
        const skippedLevels = [];
        for (let skip = lastLevel + 1; skip < currentLevel; skip++) {
          skippedLevels.push('H' + skip);
        }

        const issueText =
          'Broken hierarchy: H' +
          lastLevel +
          ' -> H' +
          currentLevel +
          ' (skipped ' +
          skippedLevels.join(', ') +
          ')';
        const description =
          'After "' +
          lastHeadingText.substring(0, 50) +
          (lastHeadingText.length > 50 ? '...' : '') +
          '" (H' +
          lastLevel +
          '), jumped to "' +
          currentText.substring(0, 50) +
          (currentText.length > 50 ? '...' : '') +
          '" (H' +
          currentLevel +
          ') in ' +
          section +
          ' / ' +
          block;

        results.qualityChecks.brokenHeadingHierarchy.push({
          url: window.location.href,
          page: navigationName,
          issue: issueText,
          description: description,
          afterHeading: lastHeadingText.substring(0, 100),
          afterHeadingType: 'H' + lastLevel,
          problemHeading: currentText.substring(0, 100),
          problemHeadingType: 'H' + currentLevel,
          section: section,
          block: block,
        });
      }

      lastLevel = currentLevel;
      lastHeadingText = currentText;
    }
  }

  // Font size inconsistency check
  const headingTypes = [
    'heading-1',
    'heading-2',
    'heading-3',
    'heading-4',
    'heading-5',
    'heading-6',
  ];
  for (const headingType of headingTypes) {
    if (!results.headings[headingType] || !results.headings[headingType].locations) continue;

    const sizesMap: Record<string, { count: number; pages: string[] }> = {};

    for (const location of results.headings[headingType].locations) {
      const fontSize = extractFontSize(location.styleDefinition);

      if (fontSize) {
        if (!sizesMap[fontSize]) {
          sizesMap[fontSize] = { count: 0, pages: [] };
        }
        sizesMap[fontSize].count++;
        if (!sizesMap[fontSize].pages.includes(location.navigationName)) {
          sizesMap[fontSize].pages.push(location.navigationName);
        }
      }
    }

    const uniqueSizes = Object.keys(sizesMap);
    if (uniqueSizes.length >= 3) {
      const distributionText = uniqueSizes
        .map(size => {
          return size + ' (' + sizesMap[size].count + ' times)';
        })
        .join(', ');

      const headingLabel = headingType.replace('heading-', 'H');
      const issueText =
        headingType.replace('-', ' ').toUpperCase() +
        ' appears in ' +
        uniqueSizes.length +
        ' different font sizes';
      const description =
        headingLabel +
        ' headings found in ' +
        uniqueSizes.length +
        ' different sizes: ' +
        distributionText +
        '. Review if these variations are intentional.';

      results.qualityChecks.fontSizeInconsistency.push({
        url: window.location.href,
        page: navigationName,
        headingType: headingType,
        issue: issueText,
        description: description,
        sizes: uniqueSizes,
        distribution: distributionText,
      });
    }
  }
}

async function analyzeListItems(
  results: any,
  navigationName: string,
  colorTracker: any,
  colorData: ColorData
): Promise<void> {
  const listItems = document.querySelectorAll('li');

  for (let i = 0; i < listItems.length; i++) {
    const listItem = listItems[i];
    const text = (listItem.textContent || '').trim();

    if (text.length <= 10) continue;
    if (listItem.querySelector('p')) continue;

    let parentEl: HTMLElement | null = listItem;
    let inNavigation = false;
    let depth = 0;

    while (parentEl && depth < 5) {
      const parentTag = (parentEl.tagName || '').toLowerCase();
      const parentClass = (parentEl.className || '').toLowerCase();

      if (parentTag === 'nav' || parentClass.includes('nav') || parentClass.includes('menu')) {
        inNavigation = true;
        break;
      }
      parentEl = parentEl.parentElement;
      depth++;
    }

    if (inNavigation) continue;

    let paragraphType = 'paragraph-2';

    parentEl = listItem;
    depth = 0;
    while (parentEl && depth < 5) {
      const parentClass = (parentEl.className || '').toLowerCase();

      if (
        parentClass.includes('hero') ||
        parentClass.includes('banner') ||
        parentClass.includes('intro')
      ) {
        paragraphType = 'paragraph-1';
        break;
      } else if (parentClass.includes('footer') || parentClass.includes('sidebar')) {
        paragraphType = 'paragraph-4';
        break;
      } else if (parentClass.includes('testimonial') || parentClass.includes('quote')) {
        paragraphType = 'paragraph-3';
        break;
      }
      parentEl = parentEl.parentElement;
      depth++;
    }

    if (paragraphType === 'paragraph-2') {
      const computed = window.getComputedStyle(listItem);
      const fontSize = parseFloat(computed.fontSize);
      const fontWeight = parseInt(computed.fontWeight, 10);

      if (fontSize > 18 || fontWeight > 500) {
        paragraphType = 'paragraph-1';
      }
    }

    const section = getSectionInfo(listItem);
    const block = getBlockInfo(listItem);
    const styleDefinition = await getStyleDefinition(
      listItem,
      'paragraph',
      colorTracker,
      colorData
    );

    // Ensure array exists (just in case)
    if (!results.paragraphs[paragraphType]) {
      results.paragraphs[paragraphType] = { locations: [] };
    }

    results.paragraphs[paragraphType].locations.push({
      navigationName: navigationName,
      url: window.location.href,
      styleDefinition: styleDefinition,
      text: text.substring(0, 200),
      pageTitle: document.title || 'Unknown',
      section: section,
      block: block,
      styles: listItem.className || '',
      selector: generateSelector(listItem),
    });
  }
}

export async function analyzeParagraphs(
  results: any,
  navigationName: string,
  squarespaceThemeStyles: any,
  colorTracker: any,
  colorData: ColorData
): Promise<void> {
  const paragraphs = document.querySelectorAll('p');
  console.log('Found paragraphs:', paragraphs.length);

  const paragraphsInLists = new Set<Element>();
  const listItems = document.querySelectorAll('li');
  for (let li = 0; li < listItems.length; li++) {
    const nestedPs = listItems[li].querySelectorAll('p');
    for (let np = 0; np < nestedPs.length; np++) {
      paragraphsInLists.add(nestedPs[np]);
    }
  }

  for (let j = 0; j < paragraphs.length; j++) {
    const p = paragraphs[j];

    if (paragraphsInLists.has(p)) continue;

    const text = (p.textContent || '').trim();
    if (text.length > 10) {
      let paragraphType = 'paragraph-2';

      let pClasses = (p.className || '').toLowerCase();
      // Handle non-string className (e.g. SVGAnimatedString, though rare for P)
      if (typeof p.className !== 'string' && p.getAttribute) {
        pClasses = (p.getAttribute('class') || '').toLowerCase();
      }

      if (
        pClasses.includes('paragraph-1') ||
        pClasses.includes('intro-text') ||
        pClasses.includes('hero-text') ||
        pClasses.includes('lead')
      ) {
        paragraphType = 'paragraph-1';
      } else if (
        pClasses.includes('paragraph-3') ||
        pClasses.includes('caption') ||
        pClasses.includes('quote') ||
        pClasses.includes('blockquote')
      ) {
        paragraphType = 'paragraph-3';
      } else if (pClasses.includes('paragraph-4') || pClasses.includes('footer-text')) {
        paragraphType = 'paragraph-4';
      } else {
        let parentEl = p.parentElement;
        let depth = 0;

        while (parentEl && depth < 5) {
          let parentClass = (parentEl.className || '').toLowerCase();
          if (typeof parentEl.className !== 'string' && parentEl.getAttribute) {
            parentClass = (parentEl.getAttribute('class') || '').toLowerCase();
          }

          if (
            parentClass.includes('hero') ||
            parentClass.includes('banner') ||
            parentClass.includes('intro')
          ) {
            paragraphType = 'paragraph-1';
            break;
          } else if (parentClass.includes('footer') || parentClass.includes('sidebar')) {
            paragraphType = 'paragraph-4';
            break;
          } else if (
            parentClass.includes('testimonial') ||
            parentClass.includes('quote') ||
            parentClass.includes('blockquote')
          ) {
            paragraphType = 'paragraph-3';
            break;
          }

          parentEl = parentEl.parentElement;
          depth++;
        }
      }

      const computed = window.getComputedStyle(p);
      const fontSize = parseFloat(computed.fontSize);

      const themeSizes = squarespaceThemeStyles.paragraphSizes || {};
      const p1Size = themeSizes['paragraph-1'] || 1.5 * 16;
      const p2Size = themeSizes['paragraph-2'] || 1.1 * 16;
      const p3Size = themeSizes['paragraph-3'] || 1.0 * 16;

      const distanceToP1 = Math.abs(fontSize - p1Size);
      const distanceToP2 = Math.abs(fontSize - p2Size);
      const distanceToP3 = Math.abs(fontSize - p3Size);

      const minDistance = Math.min(distanceToP1, distanceToP2, distanceToP3);
      if (minDistance === distanceToP1) {
        paragraphType = 'paragraph-1';
      } else if (minDistance === distanceToP3) {
        paragraphType = 'paragraph-3';
      } else {
        paragraphType = 'paragraph-2';
      }

      const section = getSectionInfo(p);
      const block = getBlockInfo(p);
      const styleDefinition = await getStyleDefinition(p, 'paragraph', colorTracker, colorData);

      if (!results.paragraphs[paragraphType]) {
        results.paragraphs[paragraphType] = { locations: [] };
      }

      results.paragraphs[paragraphType].locations.push({
        navigationName: navigationName,
        url: window.location.href,
        styleDefinition: styleDefinition,
        text: text.substring(0, 200),
        pageTitle: document.title || 'Unknown',
        section: section,
        block: block,
        styles: p.className || '',
        selector: generateSelector(p),
      });
    }
  }

  // Analyze list items as paragraphs
  await analyzeListItems(results, navigationName, colorTracker, colorData);
}
