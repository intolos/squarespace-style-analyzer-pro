export const SHOPIFY_BUTTON_SELECTORS = [
  '.product-form__submit',
  '.shopify-payment-button__button',
  '.btn',
  '.button',
  'button[type="submit"][name="add"]',
  '.cart__checkout-button',
  'a.btn',
  '.hero__btn',
];

export const SHOPIFY_NAV_SELECTORS = [
  '.site-nav',
  '.mobile-nav',
  'header nav',
  '.header__menu-item',
  '.site-header__icon',
];

export const SHOPIFY_HEADING_SELECTORS = [
  '.h1',
  '.h2',
  '.h3',
  '.h4',
  '.product__title',
  '.section-header__title',
  '.article__title',
  '.collection__title',
];

export const SHOPIFY_PARAGRAPH_SELECTORS = [
  '.rte p',
  '.product__description p',
  '.article__content p',
  '.rte', // Catch-all for Rich Text Editor content
];

export const SHOPIFY_IMAGE_SELECTORS = [
  '.product__media img',
  '.article__image img',
  '.collection-grid-item__image',
  'img[data-srcset]', // Common in Shopify lazy loading
  '.media img',
];

export const SHOPIFY_LINK_SELECTORS = ['.rte a', '.product__description a', '.footer-link'];

export const SHOPIFY_SECTION_SELECTORS = [
  '.shopify-section',
  '.page-width',
  '.grid',
  '.section-header',
  '.product-section',
];

export const SHOPIFY_BLOCK_SELECTORS = [
  '.grid__item',
  '.product-block',
  '.card', // Dawn theme
];

export const SHOPIFY_DATA_ATTRIBUTES = [
  'data-section-id',
  'data-section-type',
  'data-product-id',
  'data-variant-id',
];

export const SHOPIFY_UNSTABLE_ID_PATTERNS = [/^shopify-section-/, /^ProductSection-/];

// Helper to determine if an element is a Shopify element
export const isShopifyElement = (element: Element): boolean => {
  if (!element) return false;

  if (element.className && typeof element.className === 'string') {
    if (element.className.includes('shopify-')) return true;
    if (element.className.includes('product-')) return true; // High likelihood
  }

  if (element.getAttribute('data-shopify-editor-section')) return true;
  if (element.id && element.id.startsWith('shopify-section-')) return true;

  return false;
};
