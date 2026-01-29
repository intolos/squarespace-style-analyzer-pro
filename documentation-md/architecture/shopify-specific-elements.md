# Shopify-Specific Elements Analysis

**Date**: January 29, 2026  
**Purpose**: Technical catalog of Shopify-specific elements for multi-platform analysis  
**Related**: See [multi-platform-architecture.md](./multi-platform-architecture.md) for system design

---

## Overview

Shopify uses a template-based architecture with Liquid as its templating language. Unlike page builders, Shopify's structure is heavily theme-dependent. However, there are consistent patterns around sections, blocks, and the checkout process that can be leveraged for analysis.

---

## Factor Count Summary

| Category                  | Count  | Details                                                           |
| ------------------------- | ------ | ----------------------------------------------------------------- |
| **Detection Indicators**  | 5      | Shopify meta, `/cdn/shop/`, checkout patterns, `.shopify-section` |
| **Section Selectors**     | 4      | `.shopify-section`, `[data-section-type]`, `[data-section-id]`    |
| **Block Selectors**       | 3      | `[data-block-type]`, `{{ block.shopify_attributes }}` patterns    |
| **Product Elements**      | 6      | `.product-*`, `[data-product-*]`, cart elements                   |
| **Button Selectors**      | 4      | `.btn`, `.shopify-payment-button`, add-to-cart patterns           |
| **Navigation Selectors**  | 4      | `.site-nav`, `.mobile-nav`, header-menu, drawer patterns          |
| **Heading Selectors**     | 3      | `.section-header__title`, `.product__title`, heading classes      |
| **Image Handling**        | 6      | Shopify CDN URLs, srcset, lazy loading, image sizes               |
| **Price/Currency**        | 3      | `.price`, `[data-price]`, money format patterns                   |
| **Cart Elements**         | 4      | `.cart-*`, `[data-cart-*]`, drawer cart patterns                  |
| **Theme.liquid Patterns** | 3      | Common Dawn/Debut theme patterns                                  |
| **Adaptive Timing**       | 2      | Dynamic cart updates, section re-rendering                        |
| **Total**                 | **47** | **Individual factors across 12 categories**                       |

---

## Platform Detection

### Primary Detection

```javascript
// Shopify detection indicators
const isShopify = !!(
  document.querySelector('meta[name="shopify-checkout-api-token"]') ||
  document.querySelector('link[href*="/cdn/shop/"]') ||
  document.querySelector('script[src*="cdn.shopify.com"]') ||
  document.querySelector('[data-shopify]') ||
  document.querySelector('.shopify-section') ||
  window.Shopify !== undefined
);
```

### Theme Detection (Common Themes)

```javascript
// Dawn theme (Shopify's default since 2.0)
const isDawn = !!(
  document.querySelector('[data-section-type="header"]') &&
  document.querySelector('.header__icon--menu')
);

// Debut theme (older default)
const isDebut = !!(
  document.querySelector('#shopify-section-header') && document.querySelector('.site-header')
);

// OS 2.0 theme detection (section groups)
const isOS2Theme = !!(
  document.querySelector('[data-section-id]') && document.querySelector('template')
);
```

---

## Section Architecture

### Section Structure

Shopify themes are built from sections, which are reusable content modules:

```html
<!-- Shopify wraps each section -->
<div id="shopify-section-template--12345--header" class="shopify-section shopify-section--header">
  <!-- Section content rendered by Liquid -->
  <header data-section-type="header" data-section-id="template--12345--header">...</header>
</div>
```

### Section Selectors

```javascript
const SHOPIFY_SECTION_SELECTORS = [
  '.shopify-section',
  '[id^="shopify-section-"]',
  '[data-section-type]',
  '[data-section-id]',
];
```

### Section Data Attributes

| Attribute           | Purpose                 | Example                                   |
| ------------------- | ----------------------- | ----------------------------------------- |
| `data-section-type` | Section type identifier | `header`, `product`, `collection`         |
| `data-section-id`   | Unique section instance | `template--12345--header`                 |
| `id`                | Full section ID         | `shopify-section-template--12345--header` |

---

## Block Architecture

### Block Structure

Blocks are configurable elements within sections:

```html
<div
  class="slideshow__slide"
  {{
  block.shopify_attributes
  }}
  data-block-id="block-123"
  data-block-type="slide"
>
  <!-- Block content -->
</div>
```

### Block Selectors

```javascript
const SHOPIFY_BLOCK_SELECTORS = [
  '[data-block-id]',
  '[data-block-type]',
  // {{ block.shopify_attributes }} adds these automatically
];
```

---

## Product Elements

### Product Page Selectors

```javascript
const SHOPIFY_PRODUCT_SELECTORS = [
  '.product',
  '.product-single',
  '[data-product]',
  '[data-product-form]',
  '.product__info-wrapper',
  '.product__media-wrapper',
];
```

### Product Data Attributes

```html
<div
  class="product"
  data-product-id="789456123"
  data-product-handle="product-name"
  data-url="/products/product-name"
></div>
```

### Product Images

```javascript
const SHOPIFY_PRODUCT_IMAGE_SELECTORS = [
  '.product__media img',
  '.product-single__photo img',
  '[data-product-media-type="image"] img',
  '.product__media-item img',
];
```

---

## Button Elements

### Button Selectors

```javascript
const SHOPIFY_BUTTON_SELECTORS = [
  '.btn',
  '.button',
  '.shopify-payment-button',
  '[name="add"]', // Add to cart
  '[data-add-to-cart]',
  '.add-to-cart',
  '.product-form__submit',
  '.cart__checkout-button',
];
```

### Payment Buttons (Dynamic)

```html
<!-- Shopify Payment buttons are dynamically injected -->
<div data-shopify="payment-button" class="shopify-payment-button">
  <!-- Shop Pay, Apple Pay, Google Pay, etc. -->
</div>
```

---

## Navigation Elements

### Header Navigation

```javascript
const SHOPIFY_NAV_SELECTORS = [
  '.site-nav',
  '.header__menu',
  'nav.header__inline-menu',
  '.mobile-nav',
  '.drawer-menu',
  '[data-section-type="header"] nav',
  '.menu-drawer',
];
```

### Menu Item Patterns

```javascript
const SHOPIFY_MENU_SELECTORS = [
  '.site-nav__link',
  '.header__menu-item',
  '.menu-drawer__menu-item',
  '.mobile-nav__link',
  'a[href^="/collections"]',
  'a[href^="/products"]',
];
```

---

## Image Handling

### Shopify CDN URLs

```javascript
// Shopify CDN URL patterns
const SHOPIFY_IMAGE_PATTERNS = [/cdn\.shopify\.com\/s\/files/, /cdn\.shopifycdn\.net/];

// Shopify image URL structure
// https://cdn.shopify.com/s/files/1/0000/0000/0000/files/image.jpg?v=1234567890
```

### Image Size Transformations

Shopify allows on-the-fly image resizing via URL parameters:

```javascript
// Shopify image parameters
// _small, _medium, _large, _grande, _1024x1024
// or custom: _300x300, _500x

const getShopifyImageSize = url => {
  const sizeMatch = url.match(/_(\d+x\d*|\w+)\./);
  return sizeMatch ? sizeMatch[1] : 'original';
};
```

### Lazy Loading

```javascript
// Shopify themes commonly use:
const SHOPIFY_LAZY_PATTERNS = [
  'img[loading="lazy"]',
  'img[data-src]',
  'img[data-srcset]',
  '.lazyload',
];
```

---

## Price/Currency Elements

### Price Selectors

```javascript
const SHOPIFY_PRICE_SELECTORS = [
  '.price',
  '.price__regular',
  '.price__sale',
  '.price--sold-out',
  '[data-price]',
  '.product__price',
  '.money',
];
```

### Money Format

```javascript
// Shopify uses a money format from theme settings
// {{ 1999 | money }} -> $19.99
const SHOPIFY_MONEY_PATTERNS = [
  /\$[\d,]+\.\d{2}/, // $19.99
  /€[\d,]+[.,]\d{2}/, // €19,99 or €19.99
  /£[\d,]+\.\d{2}/, // £19.99
];
```

---

## Cart Elements

### Cart Selectors

```javascript
const SHOPIFY_CART_SELECTORS = [
  '.cart',
  '[data-cart-contents]',
  '.cart-drawer',
  '.cart__items',
  '.cart-item',
  '[data-cart-item]',
  '.cart-notification',
];
```

### Cart Count Badge

```javascript
const SHOPIFY_CART_COUNT_SELECTORS = [
  '.cart-count',
  '.cart-count-bubble',
  '[data-cart-count]',
  '.header__cart-count',
];
```

---

## Common Theme Patterns

### Dawn Theme (OS 2.0 Default)

```javascript
const DAWN_PATTERNS = {
  header: '[data-section-type="header"]',
  footer: '[data-section-type="footer"]',
  product: '.product',
  collection: '.collection',
  cart: '.cart-drawer',
  button: '.button',
  icon: '.icon-*',
};
```

### Debut Theme (Legacy Default)

```javascript
const DEBUT_PATTERNS = {
  header: '.site-header',
  footer: '.site-footer',
  product: '.product-single',
  collection: '.collection-products',
  cart: '.cart-drawer',
  button: '.btn',
};
```

---

## CSS Variables

### Common Shopify Theme Variables

```javascript
const SHOPIFY_CSS_VARIABLES = [
  '--color-base-text',
  '--color-base-background',
  '--color-base-accent',
  '--font-body-family',
  '--font-heading-family',
  '--font-body-scale',
  '--font-heading-scale',
  '--buttons-radius',
  '--inputs-radius',
];
```

---

## Adaptive Timing

### Section Re-rendering

Shopify's Section Rendering API can dynamically update sections:

```javascript
// Wait for potential dynamic updates
const shopifyDelay = 2000;

// Check for AJAX cart updates
const waitForCartUpdate = () => {
  return new Promise(resolve => {
    const observer = new MutationObserver((mutations, obs) => {
      if (document.querySelector('.cart-notification--active')) {
        obs.disconnect();
        resolve();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, 2000);
  });
};
```

---

## Dynamic ID Patterns

### Filtering Shopify IDs

```javascript
// Shopify section IDs are stable but verbose
// template--12345--header -> keep for targeting
function isShopifyTemplateId(id) {
  return /^template--\d+--\w+/.test(id);
}

// Dynamic/session IDs to filter
function isUnstableShopifyId(id) {
  return /^cart-notification-/.test(id) || /^popup-/.test(id);
}
```

---

## Value for Developers

Shopify-specific identifiers provide significant value:

1. **Section IDs**: Stable, can target specific theme sections
2. **Product handles**: SEO-friendly, human-readable identifiers
3. **CDN URLs**: Can manipulate for different image sizes
4. **Data attributes**: Rich product/cart data available

---

## Implementation Notes

### Selector Priority for Shopify

1. `data-section-type` and `data-section-id` (structural)
2. Product/cart data attributes
3. Theme-specific classes (`.shopify-section`, `.btn`)
4. Generic HTML fallbacks

### Challenges

- Heavy theme variation (custom themes differ significantly)
- Dynamic cart/checkout elements
- Third-party app injections can alter DOM

---

## References

- [Shopify Theme Development Documentation](https://shopify.dev/docs/themes)
- [Liquid Template Language](https://shopify.github.io/liquid/)
- [Dawn Theme Source Code](https://github.com/Shopify/dawn)
