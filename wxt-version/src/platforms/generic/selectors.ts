// Generic element selectors for non-platform-specific analysis

export const GENERIC_BUTTON_SELECTORS = [
  'button',
  'a[role="button"]',
  'input[type="button"]',
  'input[type="submit"]',
  '.btn',
  '.button',
  '[class*="btn-"]',
  '[class*="button-"]',
];

export const GENERIC_NAV_SELECTORS = [
  'nav',
  '[role="navigation"]',
  '.nav',
  '.navbar',
  '.navigation',
  '.menu',
  'header nav',
];

export const GENERIC_HEADING_SELECTORS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

export const GENERIC_PARAGRAPH_SELECTORS = ['p', '.text', '.content p', 'article p'];

export const GENERIC_IMAGE_SELECTORS = ['img', 'picture img', 'figure img'];

export const GENERIC_LINK_SELECTORS = ['a[href]:not([role="button"]):not(.btn):not(.button)'];
