import { getSectionInfo, getBlockInfo, generateSelector } from '../utils/domHelpers';
import { getStyleDefinition } from './styleExtractor';
import { ColorTracker } from '../utils/colorUtils';
import { ColorData } from './colors';

export async function analyzeButtons(
  results: any,
  navigationName: string,
  colorTracker: ColorTracker,
  colorData: ColorData
): Promise<void> {
  const buttonSelectors = [
    'button:not([aria-hidden="true"])',
    'a.button',
    'a.btn',
    'a[class*="sqs-button"]',
    'a[class*="sqs-block-button"]',
    '.sqs-block-button-element',
    'a[href][class*="btn"]',
    'a[href][class*="button"]',
    'input[type="submit"]',
    'input[type="button"]',
    '.button-block a',
    'a[role="button"]',
    '.sqs-button-element--primary',
    '.sqs-button-element--secondary',
    '.sqs-button-element--tertiary',
  ];

  const buttons = document.querySelectorAll(buttonSelectors.join(', '));
  console.log('Found potential buttons:', buttons.length);

  const excludedPatterns = [
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
  const processedButtonKeys = new Set<string>();

  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    let text = (btn.textContent || (btn as HTMLElement).innerText || '').trim();

    if (!text || text.length === 0) {
      if (btn.getAttribute('aria-label')) {
        text = btn.getAttribute('aria-label')!.trim();
      }
      if (!text) continue;
    }

    const section = getSectionInfo(btn);
    const block = getBlockInfo(btn);

    // Skip accordion/FAQ buttons
    const ariaExpanded = btn.getAttribute('aria-expanded');
    const ariaControls = btn.getAttribute('aria-controls');
    const btnClasses = (btn.className || '').toLowerCase();
    let isAccordion = false;

    if (ariaExpanded !== null || ariaControls !== null) isAccordion = true;
    if (
      btnClasses.includes('accordion') ||
      btnClasses.includes('collapse') ||
      btnClasses.includes('toggle') ||
      btnClasses.includes('dropdown')
    )
      isAccordion = true;

    let parentEl: Element | null = btn;
    for (let p = 0; p < 3; p++) {
      if (!parentEl) break;
      const parentClass = (parentEl.className || '').toLowerCase();
      if (
        parentClass.includes('accordion') ||
        parentClass.includes('faq') ||
        parentClass.includes('collapse')
      ) {
        isAccordion = true;
        break;
      }
      parentEl = parentEl.parentElement;
    }

    if (isAccordion) continue;

    // Check if button is in navigation/header/footer (for inventory filtering)
    parentEl = btn;
    let isInNav = false;
    for (let p = 0; p < 5; p++) {
      if (!parentEl) break;
      const parentTag = (parentEl.tagName || '').toLowerCase();
      if (parentTag === 'nav' || parentTag === 'header' || parentTag === 'footer') {
        isInNav = true;
        break;
      }
      parentEl = parentEl.parentElement;
    }

    // Skip excluded patterns
    const lowerText = text.toLowerCase();
    let isExcluded = false;
    for (const pattern of excludedPatterns) {
      if (lowerText.includes(pattern)) {
        isExcluded = true;
        break;
      }
    }
    if (isExcluded) continue;

    // Skip very short text
    if (text.length < 3 && !['ok', 'go'].includes(lowerText)) continue;
    if (text.length > 200) continue;

    // IMPORTANT: Dimension-based Deduplication for Buttons
    // Uses button position rounded by its own dimensions to create unique keys.
    // This catches framework duplicates (same position ± sub-pixel) while counting
    // intentional repetitions at different positions. Works for both Squarespace
    // and generic sites without needing section/block metadata.
    const rect = (btn as HTMLElement).getBoundingClientRect();
    const posY = Math.round(rect.top / rect.height) * rect.height;
    const posX = Math.round(rect.left / rect.width) * rect.width;
    const buttonKey = text + '|' + posY + '|' + posX;
    if (processedButtonKeys.has(buttonKey)) continue;

    const tagName = btn.tagName.toLowerCase();
    const hasHref = tagName === 'a' && btn.hasAttribute('href');
    const isButton = tagName === 'button' || tagName === 'input';
    const hasButtonRole = btn.getAttribute('role') === 'button';
    const hasButtonClass =
      (btn.className || '').toLowerCase().includes('button') ||
      (btn.className || '').toLowerCase().includes('btn');

    if (!hasHref && !isButton && !hasButtonRole && !hasButtonClass) continue;

    // ALWAYS check contrast for all buttons (including nav/header/footer)
    const styleDefinition = await getStyleDefinition(btn, 'button', colorTracker, colorData);

    // Only add to button inventory if NOT in nav/header/footer
    if (!isInNav) {
      const btnClass = (btn.className || '').toLowerCase();

      let buttonType = 'other';
      if (
        btnClass.includes('primary') ||
        btnClass.includes('main-action') ||
        btnClass.includes('cta')
      ) {
        buttonType = 'primary';
      } else if (btnClass.includes('secondary') || btnClass.includes('outline')) {
        buttonType = 'secondary';
      } else if (
        btnClass.includes('tertiary') ||
        btnClass.includes('text-button') ||
        btnClass.includes('link-button')
      ) {
        buttonType = 'tertiary';
      }

      results.buttons[buttonType].locations.push({
        navigationName: navigationName,
        url: window.location.href,
        styleDefinition: styleDefinition,
        text: text.substring(0, 200),
        pageTitle: document.title || 'Unknown',
        section: section,
        block: block,
        element: tagName,
        classes: btn.className || '',
        selector: generateSelector(btn),
      });

      processedButtonKeys.add(buttonKey);
    }
  }
}
