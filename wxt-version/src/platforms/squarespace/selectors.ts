// Squarespace-specific element selectors
// Based on documentation: squarespace-specific-elements.md

export const SQS_BUTTON_SELECTORS = [
  'a[class*="sqs-button"]',
  'a[class*="sqs-block-button"]',
  '.sqs-block-button-element',
  '.sqs-button-element--primary',
  '.sqs-button-element--secondary',
  '.sqs-button-element--tertiary',
];

export const SQS_NAV_SELECTORS = [
  'nav[data-content-field="navigation"]',
  '.header-nav',
  '.header-nav-wrapper',
  '.header-menu',
  '[data-nc-group="top"]',
];

export const SQS_HEADING_SELECTORS = [
  '.sqs-block-content h1',
  '.sqs-block-content h2',
  '.sqs-block-content h3',
  '.sqs-block-content h4',
];

export const SQS_PARAGRAPH_SELECTORS = ['.sqs-block-content p', '.sqs-block-html p'];

export const SQS_IMAGE_SELECTORS = [
  '.sqs-block-image img',
  'img[data-src]', // Lazy-loaded SQS images
];

export const SQS_LINK_SELECTORS = ['.sqs-block-content a:not([class*="sqs-button"])'];

export const SQS_BLOCK_SELECTORS = ['.sqs-block', '.sqs-row', '.sqs-col'];

export const SQS_SECTION_SELECTORS = ['[data-section-id]', '.page-section'];

// Data attributes that indicate Squarespace elements
export const SQS_DATA_ATTRIBUTES = [
  'data-block-type',
  'data-section-id',
  'data-collection-id',
  'data-item-id',
  'data-content-field',
];

// Theme-specific classes patterns
export const SQS_THEME_PATTERNS = [
  /^header-/, // header-nav, header-menu, etc.
  /^footer-/, // footer-nav, footer-blocks, etc.
  /^sqs-/, // sqs-block, sqs-row, etc.
  /^Index-/, // Index-page, Index-section, etc.
];

// Image filename patterns (Squarespace CDN)
export const SQS_IMAGE_PATTERNS = [/images\.squarespace-cdn\.com/, /static1\.squarespace\.com/];

export function isSqsElement(element: Element): boolean {
  // Check for sqs- class prefix
  if (element.className && typeof element.className === 'string') {
    if (element.className.includes('sqs-')) return true;
  }

  // Check for data attributes
  for (const attr of SQS_DATA_ATTRIBUTES) {
    if (element.hasAttribute(attr)) return true;
  }

  return false;
}
