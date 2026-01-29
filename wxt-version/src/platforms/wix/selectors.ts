export const WIX_BUTTON_SELECTORS = [
  '[data-testid="buttonElement"]',
  '.wixui-button',
  'a[role="button"]', // Common in Wix Studio
  '[class*="button_"]',
  '[id^="comp-"][class*="link"]', // Wix editor internal buttons often look like this
];

export const WIX_NAV_SELECTORS = [
  '[data-testid="stylable-horizontal-menu"]',
  '.horizontal-menu',
  '.wixui-horizontal-menu',
  '.wixui-dropdown-menu',
  '[data-testid="linkElement"]', // Menu links often labelled this way
  'nav[role="navigation"]',
];

export const WIX_HEADING_SELECTORS = [
  'h1.font_0',
  'h2.font_2',
  'h3.font_3',
  'h4.font_4',
  'h5.font_5',
  'h6.font_6',
  '[data-testid="richTextElement"] h1',
  '[data-testid="richTextElement"] h2',
  '[data-testid="richTextElement"] h3',
];

export const WIX_PARAGRAPH_SELECTORS = [
  'p.font_7',
  'p.font_8',
  'p.font_9',
  '[data-testid="richTextElement"] p',
  '.wixui-rich-text__text',
];

export const WIX_IMAGE_SELECTORS = [
  'wix-image',
  'img[data-testid="image"]',
  '.wixui-image',
  'wow-image', // Legacy
  '[data-image-info]', // Contains JSON data often
];

export const WIX_LINK_SELECTORS = ['[data-testid="linkElement"]', '.wixui-rich-text__text a'];

export const WIX_SECTION_SELECTORS = [
  'section[data-testid="section"]',
  'section.wixui-section',
  '.wixui-column-strip',
  'div[data-mesh-id]',
];

export const WIX_BLOCK_SELECTORS = [
  '.comp-rich-text',
  '.wixui-box',
  '[data-testid="container-bg"]',
];

export const WIX_DATA_ATTRIBUTES = ['data-testid', 'data-mesh-id', 'data-comp-id'];

export const WIX_UNSTABLE_ID_PATTERNS = [
  /^comp-[a-zA-Z0-9]+$/, // Most common Wix ID pattern
  /^tp-[a-zA-Z0-9]+$/, // Third party apps
  /^bgLayers_comp-/,
];

// Helper to determine if an element is a Wix element
export const isWixElement = (element: Element): boolean => {
  if (!element) return false;

  if (element.id && element.id.startsWith('comp-')) return true;
  if (element.getAttribute('data-mesh-id')) return true;
  if (element.getAttribute('data-testid')) return true;

  if (element.className && typeof element.className === 'string') {
    if (element.className.includes('wixui-')) return true;
  }

  return false;
};
