import { getSectionInfo, getBlockInfo, generateSelector } from '../utils/domHelpers';
import { getStyleDefinition } from './styleExtractor';
import { ColorTracker } from '../utils/colorUtils';
import { ColorData } from './colors';

import { PlatformSelectors } from '../platforms/selectorManager';
import type { Platform } from '../platforms';

export async function analyzeLinks(
  results: any,
  navigationName: string,
  colorTracker: ColorTracker,
  colorData: ColorData,
  selectors: PlatformSelectors,
  platform: Platform = 'generic'
): Promise<void> {
  // Use platform section selectors + generics
  const defaultSections = ['main', 'article', 'section', '[role="main"]'];
  const sectionSelectors =
    selectors && selectors.sections
      ? [...new Set([...selectors.sections, ...defaultSections])]
      : defaultSections;

  const contentAreas = document.querySelectorAll(sectionSelectors.join(', '));
  const processedLinkKeys = new Set<string>();

  // Prepare exclusion checks
  const navSelectorString =
    selectors && selectors.nav && selectors.nav.length > 0
      ? selectors.nav.join(', ')
      : 'nav, header, footer';

  const buttonSelectorString =
    selectors && selectors.buttons && selectors.buttons.length > 0
      ? selectors.buttons.join(', ')
      : 'button, .button, .btn';

  for (let ca = 0; ca < contentAreas.length; ca++) {
    const contentArea = contentAreas[ca];
    const allLinks = contentArea.querySelectorAll('a[href]');

    for (let li = 0; li < allLinks.length; li++) {
      const link = allLinks[li];

      let shouldExclude = false;

      // key check: is it inside a nav?
      if (link.closest(navSelectorString)) shouldExclude = true;

      // key check: is it a button?
      if (!shouldExclude && link.matches(buttonSelectorString)) shouldExclude = true;

      if (shouldExclude) continue;

      const text = (link.textContent || '').trim();
      if (text.length < 2 || text.length > 200) continue;

      const section = getSectionInfo(link);
      const block = getBlockInfo(link);
      const linkKey = text + '|' + section + '|' + block;

      if (processedLinkKeys.has(linkKey)) continue;
      processedLinkKeys.add(linkKey);

      // Use platform-specific background detection for accurate color analysis
      const styleDefinition = await getStyleDefinition(
        link as HTMLElement,
        'text',
        colorTracker,
        colorData,
        platform
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
