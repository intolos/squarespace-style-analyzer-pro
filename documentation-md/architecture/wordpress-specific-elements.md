# WordPress-Specific Elements Analysis

**Date**: January 29, 2026  
**Purpose**: Technical catalog of WordPress-specific elements for multi-platform analysis  
**Related**: See [multi-platform-architecture.md](./multi-platform-architecture.md) for system design

---

## Overview

WordPress powers over 40% of websites globally, but its DOM structure varies significantly based on the editing system and page builder used. This document catalogs elements for three major WordPress variants:

1. **Gutenberg (Block Editor)** - Native WordPress editor since v5.0
2. **Elementor** - Most popular third-party page builder
3. **Divi** - Popular premium theme/builder by Elegant Themes

---

## Factor Count Summary

| Category                        | Count  | Details                                                                                                  |
| ------------------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| **Detection Indicators**        | 4      | Generator meta, wp-block prefix, admin-bar, wp-content in URLs                                           |
| **Gutenberg Block Selectors**   | 8      | `.wp-block-*` for paragraph, image, heading, group, columns, buttons, cover, gallery                     |
| **Elementor Section Selectors** | 5      | `.elementor-section`, `.elementor-container`, `.elementor-row`, `.elementor-column`, `.elementor-widget` |
| **Elementor Data Attributes**   | 3      | `data-id`, `data-element_type`, `data-settings`                                                          |
| **Divi Section Selectors**      | 5      | `.et_pb_section`, `.et_pb_row`, `.et_pb_column`, `.et_pb_module`, `.et_pb_text`                          |
| **Button Selectors**            | 6      | `.wp-block-button`, `.wp-element-button`, `.elementor-button`, `.et_pb_button` variants                  |
| **Navigation Selectors**        | 4      | `.wp-block-navigation`, `.elementor-nav-menu`, `nav.main-navigation`                                     |
| **Heading Selectors**           | 3      | `.wp-block-heading`, `.elementor-heading-title`, `.et_pb_module_header`                                  |
| **Image Handling**              | 4      | `wp-image-*`, `attachment-*`, lazy loading via `loading="lazy"`, srcset handling                         |
| **Dynamic ID Detection**        | 2      | `elementor-element-*` dynamic IDs, `et_pb_*_N` ordered IDs                                               |
| **Theme Patterns**              | 3      | RegEx for `wp-`, `elementor-`, `et_pb_` prefixes                                                         |
| **CSS Variables**               | 3      | `--wp-*`, `--e-global-*`, Divi custom properties                                                         |
| **Total**                       | **50** | **Individual factors across 12 categories**                                                              |

---

## Platform Detection

### Primary Detection

```javascript
// WordPress detection indicators
const isWordPress = !!(
  document.querySelector('meta[name="generator"][content*="WordPress"]') ||
  document.querySelector('.wp-block') ||
  document.querySelector('#wpadminbar') ||
  document.querySelector('link[href*="wp-content"]') ||
  document.querySelector('script[src*="wp-includes"]')
);
```

### Sub-Platform Detection (Page Builder)

```javascript
// Elementor detection
const isElementor = !!(
  document.querySelector('.elementor') ||
  document.querySelector('[data-elementor-type]') ||
  document.querySelector('.elementor-widget')
);

// Divi detection
const isDivi = !!(
  document.querySelector('.et_pb_section') ||
  document.querySelector('#et-main-area') ||
  document.querySelector('.et_divi_builder')
);

// Native Gutenberg (no page builder)
const isGutenberg = isWordPress && !isElementor && !isDivi;
```

---

## Gutenberg (Block Editor) Elements

### Block Structure

WordPress Gutenberg uses a standardized block naming convention:

| Element Type | CSS Class                | Notes                   |
| ------------ | ------------------------ | ----------------------- |
| Container    | `.wp-block-group`        | Wraps groups of blocks  |
| Columns      | `.wp-block-columns`      | Multi-column layout     |
| Column       | `.wp-block-column`       | Individual column       |
| Paragraph    | `.wp-block-paragraph`    | Standard text block     |
| Heading      | `.wp-block-heading`      | H1-H6 headings          |
| Image        | `.wp-block-image`        | Image container         |
| Button       | `.wp-block-button`       | Button container        |
| Button Link  | `.wp-block-button__link` | Actual clickable button |
| Cover        | `.wp-block-cover`        | Hero/banner sections    |
| Gallery      | `.wp-block-gallery`      | Image galleries         |

### Data Attributes

Gutenberg stores block data in HTML comments, but some attributes are exposed:

```html
<!-- wp:paragraph {"className":"custom-class"} -->
<p class="wp-block-paragraph custom-class">Content</p>
<!-- /wp:paragraph -->
```

Key attributes for analysis:

- Block type stored in HTML comment delimiters
- Custom classes added via Advanced panel
- No stable unique IDs by default (unlike Squarespace)

### CSS Variables

```javascript
// WordPress global styles CSS variables
const wpVariables = [
  '--wp--preset--color--primary',
  '--wp--preset--color--secondary',
  '--wp--preset--font-size--small',
  '--wp--preset--font-size--medium',
  '--wp--preset--font-size--large',
  '--wp--preset--spacing--20',
  '--wp--preset--spacing--40',
];
```

---

## Elementor Elements

### Section/Widget Structure

| Element Type | CSS Class                | Data Attribute                |
| ------------ | ------------------------ | ----------------------------- |
| Section      | `.elementor-section`     | `data-element_type="section"` |
| Container    | `.elementor-container`   | -                             |
| Column       | `.elementor-column`      | `data-element_type="column"`  |
| Widget       | `.elementor-widget`      | `data-widget_type="*"`        |
| Widget Wrap  | `.elementor-widget-wrap` | -                             |

### Unique Identifiers

Elementor provides stable unique IDs:

```html
<section data-id="a1b2c3d" data-element_type="section" class="elementor-section">
  <div class="elementor-container">
    <div data-id="e4f5g6h" data-element_type="column" class="elementor-column">
      <div data-id="i7j8k9l" data-widget_type="heading.default" class="elementor-widget"></div>
    </div>
  </div>
</section>
```

These `data-id` values are **stable and unique** - excellent for targeting specific elements.

### Widget Types

Common widget type selectors:

| Widget  | Class                      | Widget Type Attribute |
| ------- | -------------------------- | --------------------- |
| Heading | `.elementor-heading-title` | `heading.default`     |
| Text    | `.elementor-text-editor`   | `text-editor.default` |
| Image   | `.elementor-image`         | `image.default`       |
| Button  | `.elementor-button`        | `button.default`      |
| Icon    | `.elementor-icon`          | `icon.default`        |
| Divider | `.elementor-divider`       | `divider.default`     |

### CSS Variables (Global Colors/Fonts)

```javascript
// Elementor global style variables
const elementorVariables = [
  '--e-global-color-primary',
  '--e-global-color-secondary',
  '--e-global-color-text',
  '--e-global-color-accent',
  '--e-global-typography-primary-font-family',
  '--e-global-typography-secondary-font-family',
];
```

---

## Divi Elements

### Section/Module Structure

| Element Type  | CSS Class                      | Notes                                         |
| ------------- | ------------------------------ | --------------------------------------------- |
| Section       | `.et_pb_section`               | Top-level container                           |
| Row           | `.et_pb_row`                   | Row within section                            |
| Column        | `.et_pb_column`                | Column within row (e.g., `.et_pb_column_4_4`) |
| Module        | `.et_pb_module`                | Any content module                            |
| Text Module   | `.et_pb_text`                  | Rich text content                             |
| Image Module  | `.et_pb_image`                 | Image container                               |
| Button Module | `.et_pb_button_module_wrapper` | Button wrapper                                |
| Button        | `.et_pb_button`                | Actual button element                         |

### Dynamic IDs (Unstable)

Divi generates ordered IDs that change when modules are reordered:

```html
<div class="et_pb_text et_pb_text_0">First text module</div>
<div class="et_pb_text et_pb_text_1">Second text module</div>
```

> [!WARNING]
> These `*_0`, `*_1` suffixes are **NOT stable** - they change based on module order. Filter these from generated selectors.

### Custom CSS ID/Class Support

Divi allows custom IDs and classes via Advanced tab:

```html
<div class="et_pb_section my-custom-class" id="my-unique-id"></div>
```

These user-defined identifiers ARE stable and should be preserved in reports.

---

## Image Handling

### WordPress Image Classes

```javascript
// WordPress adds these classes to images
const wpImagePatterns = [
  /wp-image-\d+/, // wp-image-123 (attachment ID)
  /attachment-\w+/, // attachment-large, attachment-thumbnail
  /size-\w+/, // size-full, size-medium, size-thumbnail
];
```

### Lazy Loading Detection

```javascript
// WordPress native lazy loading (since 5.5)
const hasNativeLazy = img.getAttribute('loading') === 'lazy';

// Common plugin lazy loading
const hasPluginLazy =
  img.getAttribute('data-src') ||
  img.getAttribute('data-lazy-src') ||
  img.classList.contains('lazy');
```

### Responsive Images (srcset)

WordPress generates srcset for responsive images:

```html
<img
  src="image-1024x768.jpg"
  srcset="image-300x225.jpg 300w, image-768x576.jpg 768w, image-1024x768.jpg 1024w"
  sizes="(max-width: 1024px) 100vw, 1024px"
/>
```

---

## Navigation Selectors

| Builder       | Primary Selector             | Fallbacks                            |
| ------------- | ---------------------------- | ------------------------------------ |
| Gutenberg     | `.wp-block-navigation`       | `nav.navigation`, `.main-navigation` |
| Elementor     | `.elementor-nav-menu`        | `.elementor-widget-nav-menu`         |
| Divi          | `.et_pb_menu`                | `#top-menu`, `.nav-menu`             |
| Theme Default | `nav`, `[role="navigation"]` | `.menu`, `.nav`                      |

---

## Implementation Notes

### Selector Priority

For WordPress sites in the generic analyzer:

1. First detect sub-platform (Elementor/Divi/Gutenberg)
2. Use sub-platform-specific selectors with highest priority
3. Fall back to general WordPress selectors
4. Final fallback to generic HTML selectors

### Adaptive Delay

```javascript
// WordPress sites may need extra time for:
// - Lazy loading plugins
// - Deferred JavaScript execution
// - Server-side caching hydration
const wpDelay = isElementor ? 2500 : isDivi ? 2500 : 2000;
```

### Dynamic ID Filtering

```javascript
// Filter unstable WordPress/builder IDs
function isUnstableWpId(id) {
  return (
    /^et_pb_\w+_\d+$/.test(id) || // Divi ordered IDs
    /^elementor-element-\w+$/.test(id)
  ); // Elementor random IDs
}
```

---

## Value for Developers

These identifiers provide significant value:

1. **Elementor `data-id`**: Stable unique identifier for targeting specific widgets
2. **Custom CSS classes**: User-defined, stable, intentional
3. **Block type detection**: Helps developers understand content structure
4. **CSS variables**: Enable theme-consistent color/typography extraction

---

## References

- [WordPress Block Editor Handbook](https://developer.wordpress.org/block-editor/)
- [Elementor Developer Documentation](https://developers.elementor.com/)
- [Divi Theme Documentation](https://www.elegantthemes.com/documentation/divi/)
