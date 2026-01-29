export const WP_BUTTON_SELECTORS = [
  '.wp-block-button',
  '.wp-block-button__link',
  '.elementor-button',
  '.et_pb_button',
  '.et_pb_button_module_wrapper',
  '.wp-element-button',
  'button[class*="wp-block-button"]',
];

export const WP_NAV_SELECTORS = [
  '.wp-block-navigation',
  '.elementor-nav-menu',
  '.elementor-widget-nav-menu',
  '.et_pb_menu',
  'nav.main-navigation',
  '.main-navigation',
  '#site-navigation',
  '.menu-item a',
  '.wp-block-navigation-link',
];

export const WP_HEADING_SELECTORS = [
  '.wp-block-heading',
  '.elementor-heading-title',
  '.et_pb_module_header',
  '.entry-title',
  '.site-title',
  'h1.wp-block-post-title',
  'h2.wp-block-post-title',
];

export const WP_PARAGRAPH_SELECTORS = [
  '.wp-block-paragraph',
  '.elementor-text-editor p',
  '.et_pb_text_inner p',
  '.entry-content p',
  '.wp-block-quote p',
];

export const WP_IMAGE_SELECTORS = [
  '.wp-block-image img',
  '.elementor-image img',
  '.et_pb_image img',
  'img[class*="wp-image-"]',
  'figure.wp-block-image',
  '.wp-block-gallery img',
];

export const WP_LINK_SELECTORS = [
  '.entry-content a',
  '.wp-block-button__link',
  '.elementor-button-link',
];

export const WP_SECTION_SELECTORS = [
  '.wp-block-group',
  '.wp-block-columns',
  '.wp-block-cover',
  '.elementor-section',
  '.elementor-container',
  '.et_pb_section',
  '.et_pb_row',
  'article.post',
  'article.page',
];

export const WP_BLOCK_SELECTORS = ['.wp-block', '.elementor-widget', '.et_pb_module'];

export const WP_DATA_ATTRIBUTES = [
  'data-id',
  'data-element_type',
  'data-widget_type',
  'data-settings',
];

export const WP_UNSTABLE_ID_PATTERNS = [
  /^et_pb_\w+_\d+$/, // Divi ordered IDs
  /^elementor-element-/, // Elementor dynamic IDs
];

// Helper to determine if an element is a WordPress element
export const isWpElement = (element: Element): boolean => {
  if (!element) return false;

  if (element.className && typeof element.className === 'string') {
    if (element.className.includes('wp-block-')) return true;
    if (element.className.includes('elementor-')) return true;
    if (element.className.includes('et_pb_')) return true;
  }

  // Check attributes
  if (element.getAttribute('data-element_type')) return true;
  if (element.getAttribute('data-widget_type')) return true;

  return false;
};
