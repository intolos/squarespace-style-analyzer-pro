# Webflow-Specific Elements Analysis

**Date**: January 29, 2026  
**Purpose**: Technical catalog of Webflow-specific elements for multi-platform analysis  
**Related**: See [multi-platform-architecture.md](./multi-platform-architecture.md) for system design

---

## Overview

Webflow generates clean, semantic HTML with consistent CSS class naming conventions. Unlike Wix's obfuscated classes or Squarespace's `sqs-` prefixes, Webflow uses human-readable class names defined by the designer. This makes Webflow sites particularly well-suited for style analysis.

---

## Factor Count Summary

| Category                   | Count  | Details                                                                 |
| -------------------------- | ------ | ----------------------------------------------------------------------- |
| **Detection Indicators**   | 5      | Generator meta, `data-wf-*` attributes, `.w-*` classes, Webflow domains |
| **Structural Classes**     | 6      | `.w-container`, `.w-row`, `.w-col`, `.w-section`, `.w-layout-*`         |
| **Navigation Elements**    | 5      | `.w-nav`, `.w-nav-menu`, `.w-nav-link`, `.w-dropdown`, `.w-nav-button`  |
| **Button Elements**        | 4      | `.w-button`, `.w-inline-block`, link blocks                             |
| **Form Elements**          | 5      | `.w-form`, `.w-input`, `.w-select`, `.w-checkbox`, `.w-radio`           |
| **Image Handling**         | 5      | `.w-image`, srcset, Webflow CDN, responsive images                      |
| **CMS Elements**           | 5      | `.w-dyn-list`, `.w-dyn-item`, collection elements                       |
| **Interaction Attributes** | 4      | `data-wf-*`, `data-w-id`, interaction triggers                          |
| **Typography Classes**     | 3      | `.w-richtext`, heading classes, paragraph styling                       |
| **Slider/Tab Components**  | 5      | `.w-slider`, `.w-tabs`, `.w-lightbox`                                   |
| **Responsive Utilities**   | 3      | `.w-hidden-*`, `.w-container`, responsive modifiers                     |
| **Adaptive Timing**        | 2      | Interaction initialization, lazy loading                                |
| **Total**                  | **52** | **Individual factors across 12 categories**                             |

---

## Platform Detection

### Primary Detection

```javascript
// Webflow detection indicators
const isWebflow = !!(
  document.querySelector('meta[name="generator"][content*="Webflow"]') ||
  document.querySelector('html[data-wf-domain]') ||
  document.querySelector('html[data-wf-site]') ||
  document.querySelector('.w-nav') ||
  document.querySelector('.w-container') ||
  document.querySelector('[data-wf-page]')
);
```

### Published vs Exported Detection

```javascript
// Webflow-hosted site (has live form handling)
const isWebflowHosted = !!document.querySelector('html[data-wf-status="published"]');

// Exported site (may lack some Webflow JS)
const isWebflowExported = isWebflow && !isWebflowHosted;
```

---

## Structural Elements

### Container/Layout Classes

Webflow uses a consistent prefix system for structural elements:

| Class            | Purpose      | Description                               |
| ---------------- | ------------ | ----------------------------------------- |
| `.w-container`   | Container    | Standard width container (max-width)      |
| `.w-section`     | Section      | Full-width section wrapper                |
| `.w-row`         | Row          | Flexbox/grid row container                |
| `.w-col`         | Column       | Column within row                         |
| `.w-col-*`       | Sized Column | Specific column widths (e.g., `.w-col-6`) |
| `.w-layout-grid` | Grid         | CSS Grid container                        |
| `.w-layout-cell` | Grid Cell    | Cell within grid                          |

### Selectors

```javascript
const WEBFLOW_SECTION_SELECTORS = [
  '.w-section',
  'section', // Webflow encourages semantic HTML
  '[class*="section"]', // Designer-named sections
  '.w-layout-grid',
];

const WEBFLOW_CONTAINER_SELECTORS = [
  '.w-container',
  '.w-row',
  '.container', // Common custom class
  '.w-layout-grid',
];
```

---

## Navigation Elements

### Nav Component Structure

```html
<nav class="w-nav" data-w-id="nav-id" role="navigation">
  <div class="w-nav-brand"><!-- Logo --></div>
  <nav role="navigation" class="w-nav-menu">
    <a href="/page" class="w-nav-link">Link</a>
    <div class="w-dropdown">
      <div class="w-dropdown-toggle">
        <div class="w-dropdown-btn">▼</div>
        <div>Dropdown</div>
      </div>
      <nav class="w-dropdown-list">
        <a href="/sub" class="w-dropdown-link">Subitem</a>
      </nav>
    </div>
  </nav>
  <div class="w-nav-button"><!-- Mobile hamburger --></div>
</nav>
```

### Navigation Selectors

```javascript
const WEBFLOW_NAV_SELECTORS = [
  '.w-nav',
  '.w-nav-menu',
  '.w-nav-link',
  '.w-dropdown',
  '.w-dropdown-list',
  '.w-dropdown-link',
  '.w-nav-button', // Mobile menu trigger
  '.w-nav-brand', // Logo/brand area
  'nav[role="navigation"]',
];
```

---

## Button Elements

### Button Patterns

```javascript
const WEBFLOW_BUTTON_SELECTORS = [
  '.w-button',
  'a.button', // Common custom naming
  '.w-inline-block', // Link block (often styled as button)
  '[class*="button"]',
  '[class*="btn"]',
  'input[type="submit"]',
];
```

### Link Blocks

Webflow's "Link Block" wraps content in a clickable container:

```html
<a href="/page" class="w-inline-block">
  <div class="card"><!-- Content --></div>
</a>
```

---

## Form Elements

### Form Component Structure

```html
<div class="w-form">
  <form id="form" name="form" data-name="Form">
    <input type="text" class="w-input" name="name" placeholder="Name" />
    <textarea class="w-input" name="message" placeholder="Message"></textarea>
    <input type="submit" class="w-button" value="Submit" />
  </form>
  <div class="w-form-done"><!-- Success message --></div>
  <div class="w-form-fail"><!-- Error message --></div>
</div>
```

### Form Selectors

```javascript
const WEBFLOW_FORM_SELECTORS = [
  '.w-form',
  '.w-input',
  '.w-select',
  '.w-checkbox',
  '.w-radio',
  '.w-form-label',
  '.w-checkbox-input',
  '.w-radio-input',
  '.w-form-done',
  '.w-form-fail',
];
```

---

## Image Handling

### Image Structure

Webflow generates responsive images with srcset:

```html
<img
  src="image.jpg"
  loading="lazy"
  srcset="image-500.jpg 500w, image-800.jpg 800w, image-1080.jpg 1080w"
  sizes="(max-width: 479px) 100vw, (max-width: 767px) 90vw, 500px"
  alt="Description"
  class="image"
/>
```

### Image Selectors

```javascript
const WEBFLOW_IMAGE_SELECTORS = [
  'img', // Webflow uses semantic img tags
  '.w-lightbox img', // Lightbox images
  '.w-slider-slide img', // Slider images
  '.w-background-video', // Background video
];
```

### Webflow CDN URLs

```javascript
// Webflow CDN patterns
const WEBFLOW_IMAGE_PATTERNS = [
  /assets\.website-files\.com/,
  /uploads-ssl\.webflow\.com/,
  /d\d+\.com\/assets/,
];
```

### Responsive Images

Webflow automatically generates multiple image sizes:

```javascript
// Webflow image sizing in URL
// image-p-500.jpg, image-p-800.jpg, image-p-1080.jpg
const getWebflowImageSize = url => {
  const sizeMatch = url.match(/-p-(\d+)\./);
  return sizeMatch ? parseInt(sizeMatch[1]) : 'original';
};
```

---

## CMS (Dynamic Content) Elements

### Collection List Structure

```html
<div class="w-dyn-list">
  <div role="list" class="w-dyn-items">
    <div role="listitem" class="w-dyn-item">
      <!-- Dynamic content -->
    </div>
    <div role="listitem" class="w-dyn-item">
      <!-- Dynamic content -->
    </div>
  </div>
  <div class="w-dyn-empty">
    <div>No items found.</div>
  </div>
</div>
```

### CMS Selectors

```javascript
const WEBFLOW_CMS_SELECTORS = [
  '.w-dyn-list', // Collection list wrapper
  '.w-dyn-items', // Items container
  '.w-dyn-item', // Individual item
  '.w-dyn-empty', // Empty state
  '.w-richtext', // Rich text field
  '.w-condition-invisible', // Conditional visibility
];
```

---

## Interactive Components

### Slider

```javascript
const WEBFLOW_SLIDER_SELECTORS = [
  '.w-slider',
  '.w-slider-mask',
  '.w-slide',
  '.w-slider-arrow-left',
  '.w-slider-arrow-right',
  '.w-slider-dot',
  '.w-slider-nav',
];
```

### Tabs

```javascript
const WEBFLOW_TABS_SELECTORS = [
  '.w-tabs',
  '.w-tab-menu',
  '.w-tab-link',
  '.w-tab-content',
  '.w-tab-pane',
];
```

### Lightbox

```javascript
const WEBFLOW_LIGHTBOX_SELECTORS = ['.w-lightbox', '.w-lightbox-thumbnail', '.w-lightbox-group'];
```

---

## Data Attributes

### Webflow System Attributes

| Attribute        | Purpose                | Persistence             |
| ---------------- | ---------------------- | ----------------------- |
| `data-wf-domain` | Site domain            | On `<html>`             |
| `data-wf-page`   | Page identifier        | On `<html>`             |
| `data-wf-site`   | Site identifier        | On `<html>`             |
| `data-wf-status` | Published/draft        | On `<html>`             |
| `data-w-id`      | Element interaction ID | On interactive elements |

### Interaction Attributes

```javascript
// Webflow Interactions use data-w-id for targeting
const interactiveElements = document.querySelectorAll('[data-w-id]');

// Interaction triggers
const WEBFLOW_INTERACTION_ATTRS = ['data-w-id', 'data-animation-type', 'data-is-ix2-target'];
```

---

## Typography

### Rich Text Field

```html
<div class="w-richtext">
  <h2>Heading</h2>
  <p>Paragraph with <a href="#">link</a> and <strong>bold</strong>.</p>
  <ul>
    <li>List item</li>
  </ul>
</div>
```

### Typography Selectors

```javascript
const WEBFLOW_TYPOGRAPHY_SELECTORS = [
  '.w-richtext',
  '.w-richtext h1',
  '.w-richtext h2',
  '.w-richtext h3',
  '.w-richtext p',
  '.w-richtext a',
  '.w-richtext ul',
  '.w-richtext ol',
  '.w-richtext blockquote',
  '.w-richtext figure',
];
```

---

## Responsive Utilities

### Visibility Classes

```javascript
const WEBFLOW_VISIBILITY_CLASSES = [
  '.w-hidden-main', // Hidden on desktop
  '.w-hidden-medium', // Hidden on tablet
  '.w-hidden-small', // Hidden on mobile landscape
  '.w-hidden-tiny', // Hidden on mobile portrait
];
```

### Breakpoints

Webflow uses fixed breakpoints:

- Desktop: 992px+
- Tablet: 768px - 991px
- Mobile Landscape: 480px - 767px
- Mobile Portrait: < 480px

---

## CSS Class Naming

### Webflow's Clean Class Approach

Unlike other platforms, Webflow uses designer-defined class names:

```html
<!-- Classes are human-readable, defined by designer -->
<div class="hero-section">
  <div class="container">
    <h1 class="hero-heading">Welcome</h1>
    <p class="hero-paragraph">Description</p>
    <a href="/start" class="hero-button w-button">Get Started</a>
  </div>
</div>
```

### Combo Classes

```html
<!-- Webflow supports combo classes for variations -->
<a class="button button-primary">Primary</a>
<a class="button button-secondary">Secondary</a>
```

---

## Adaptive Timing

### Interaction Initialization

```javascript
// Webflow Interactions (IX2) need time to initialize
const webflowDelay = 2000;

// Check for Webflow JS initialization
const isWebflowReady = () => {
  return window.Webflow && window.Webflow.ready;
};
```

### Lazy Loading

```javascript
// Webflow uses native lazy loading
const WEBFLOW_LAZY_SELECTOR = 'img[loading="lazy"]';
```

---

## Value for Developers

Webflow-specific patterns provide significant value:

1. **Clean class names**: Human-readable, intentional naming
2. **Semantic HTML**: Proper use of nav, section, article, etc.
3. **Consistent patterns**: `.w-*` prefix for framework elements
4. **Responsive images**: Built-in srcset/sizes handling
5. **Interaction IDs**: `data-w-id` for animation debugging

---

## Implementation Notes

### Selector Priority for Webflow

1. `data-w-id` for interactive elements
2. `.w-*` framework classes (most stable)
3. Designer-defined classes (human-readable)
4. Semantic HTML elements as fallback

### Advantages

- Cleanest HTML output of all page builders
- Consistent class naming conventions
- Semantic, accessible markup
- Easy to analyze and understand

### Challenges

- Designer class names vary per site
- Exported sites may lack Webflow JS
- Interactions can affect measured styles

---

## References

- [Webflow University](https://university.webflow.com/)
- [Webflow CSS Reference](https://www.webflow.com/blog/full-list-webflow-css-classes)
- [Webflow Designer Documentation](https://developers.webflow.com/)
