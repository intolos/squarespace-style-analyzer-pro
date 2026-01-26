import { getSectionInfo, getBlockInfo, generateSelector } from '../utils/domHelpers';
import { getStyleDefinition } from './styleExtractor';
import { ColorTracker } from '../utils/colorUtils';
import { ColorData } from './colors';

export async function analyzeLinks(
  results: any,
  navigationName: string,
  colorTracker: ColorTracker,
  colorData: ColorData
): Promise<void> {
  const contentAreas = document.querySelectorAll(
    'main, article, section, .content, .page-content, [role="main"], .sqs-block-content'
  );
  const processedLinkKeys = new Set<string>();

  const excludeSelectors = [
    'nav a',
    'header a',
    'footer a',
    '.navigation a',
    '.menu a',
    '[class*="nav"] a',
    '[class*="footer"] a',
    '[class*="social"] a',
    '[class*="share"] a',
    'a.button',
    'a.btn',
    'a[class*="sqs-button"]',
    'a[class*="btn"]',
    'a[role="button"]',
    '.button-block a',
  ];

  for (let ca = 0; ca < contentAreas.length; ca++) {
    const contentArea = contentAreas[ca];
    const allLinks = contentArea.querySelectorAll('a[href]');

    for (let li = 0; li < allLinks.length; li++) {
      const link = allLinks[li];

      let shouldExclude = false;
      for (const selector of excludeSelectors) {
        if (link.matches(selector) || link.closest(selector.replace(' a', ''))) {
          shouldExclude = true;
          break;
        }
      }
      if (shouldExclude) continue;

      const text = (link.textContent || '').trim();
      if (text.length < 2 || text.length > 200) continue;

      const section = getSectionInfo(link);
      const block = getBlockInfo(link);
      const linkKey = text + '|' + section + '|' + block;

      if (processedLinkKeys.has(linkKey)) continue;
      processedLinkKeys.add(linkKey);

      const styleDefinition = await getStyleDefinition(
        link as HTMLElement,
        'text',
        colorTracker,
        colorData
      );
      const href = link.getAttribute('href') || '';

      results.links['in-content'].locations.push({
        navigationName: navigationName,
        url: window.location.href,
        text: text.substring(0, 200),
        href: href,
        styleDefinition: styleDefinition,
        section: section,
        block: block,
        pageTitle: document.title || 'Unknown',
        selector: generateSelector(link),
      });
    }
  }
}
