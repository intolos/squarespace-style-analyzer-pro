# Wix-Specific Elements Analysis

**Date**: January 29, 2026  
**Purpose**: Technical catalog of Wix-specific elements for multi-platform analysis  
**Related**: See [multi-platform-architecture.md](./multi-platform-architecture.md) for system design

---

## Overview

Wix uses a component-based architecture with auto-generated IDs and a robust data attribute system. Unlike Squarespace's predictable class naming, Wix relies heavily on unique component IDs and `data-testid` attributes for element identification.

---

## Factor Count Summary

| Category                      | Count  | Details                                                               |
| ----------------------------- | ------ | --------------------------------------------------------------------- |
| **Detection Indicators**      | 4      | Generator meta, `wix-` domains, `#comp-*` IDs, `data-mesh-id`         |
| **Component ID Patterns**     | 3      | `#comp-*` elements, `#SITE_*` structure, `#TPAWidget_*` apps          |
| **Section Selectors**         | 4      | `.comp-section`, `[data-testid*="section"]`, `[data-mesh-id]`         |
| **Block/Component Selectors** | 5      | Component classes, `data-testid` patterns                             |
| **Button Selectors**          | 4      | `[data-testid="buttonElement"]`, `.StylableButton*`, `.wixui-button`  |
| **Navigation Selectors**      | 3      | `[data-testid="horizontal-menu"]`, `.TINY_MENU`, `.wixui-navigation`  |
| **Heading Selectors**         | 3      | `[data-testid*="heading"]`, `.wixui-rich-text h*`                     |
| **Image Handling**            | 5      | `wow-image`, `data-src`, srcset via Wix CDN, `wix:image://` protocol  |
| **Data Attributes**           | 6      | `data-testid`, `data-mesh-id`, `data-comp`, `data-state`, `data-hook` |
| **CSS Classes**               | 4      | Global/semantic classes, `wixui-*` components                         |
| **Dynamic ID Detection**      | 2      | `comp-*` pattern filtering, random suffix detection                   |
| **Adaptive Timing**           | 2      | Thunderbolt hydration delay, lazy loading wait                        |
| **Total**                     | **45** | **Individual factors across 12 categories**                           |

---

## Platform Detection

### Primary Detection

```javascript
// Wix detection indicators
const isWix = !!(
  document.querySelector('meta[name="generator"][content*="Wix"]') ||
  document.querySelector('[id^="comp-"]') ||
  document.querySelector('[data-mesh-id]') ||
  document.querySelector('link[href*="static.wixstatic.com"]') ||
  document.querySelector('script[src*="wix-code"]') ||
  window.wixBiSession !== undefined
);
```

### Wix Editor Type Detection

```javascript
// Editor X / Wix Studio (responsive sites)
const isEditorX = !!(
  document.querySelector('[data-testid="responsive-container"]') ||
  document.body.classList.contains('responsive-site')
);

// Classic Wix Editor
const isClassicWix = isWix && !isEditorX;
```

---

## Component Structure

### Top-Level Site Structure

```html
<div id="SITE_CONTAINER">
  <div id="SITE_ROOT">
    <header id="SITE_HEADER">
      <div id="comp-xyz123"><!-- Header component --></div>
    </header>
    <main id="PAGES_CONTAINER">
      <div id="comp-abc456"><!-- Page section --></div>
    </main>
    <footer id="SITE_FOOTER">
      <div id="comp-def789"><!-- Footer component --></div>
    </footer>
  </div>
</div>
```

### Component ID Pattern

Wix generates unique IDs for every component:

| Pattern       | Example          | Description                 |
| ------------- | ---------------- | --------------------------- |
| `comp-*`      | `comp-kxcy12abc` | User-added components       |
| `SITE_*`      | `SITE_HEADER`    | Structural elements         |
| `TPAWidget_*` | `TPAWidget_123`  | Third-party apps (Wix Apps) |

> [!IMPORTANT]
> `comp-*` IDs are **stable** within a site and can be used for targeting specific elements with custom CSS.

---

## Section/Strip Elements

### Selectors

```javascript
const WIX_SECTION_SELECTORS = [
  '[id^="comp-"]', // Component containers
  '[data-testid*="section"]', // Section test IDs
  '[data-mesh-id]', // Mesh grid containers
  '.comp-section', // Section class (some themes)
  '[data-testid="StripContainer"]', // Strip containers
];
```

### Data Attributes

| Attribute      | Purpose                     | Example                             |
| -------------- | --------------------------- | ----------------------------------- |
| `data-mesh-id` | Grid layout identifier      | `data-mesh-id="comp-kx123"`         |
| `data-testid`  | Testing/automation selector | `data-testid="section-heading"`     |
| `data-comp`    | Component type              | `data-comp="StripColumnsContainer"` |
| `data-state`   | Component state             | `data-state="initial\|loaded"`      |

---

## Component Elements

### Button Elements

```javascript
const WIX_BUTTON_SELECTORS = [
  '[data-testid="buttonElement"]',
  '[data-testid="linkElement"]',
  '.StylableButton2545352419__root',
  '.wixui-button',
  '.wixui-button__label',
  'button[class*="Button"]',
  'a[data-testid="button"]',
];
```

### Navigation Elements

```javascript
const WIX_NAV_SELECTORS = [
  '[data-testid="horizontal-menu"]',
  '[data-testid="vertical-menu"]',
  '.TINY_MENU', // Mobile hamburger
  '.wixui-navigation',
  '[data-comp="Menu"]',
  'nav[data-testid]',
];
```

### Text/Heading Elements

```javascript
const WIX_HEADING_SELECTORS = [
  '[data-testid*="heading"]',
  '.wixui-rich-text h1',
  '.wixui-rich-text h2',
  '.wixui-rich-text h3',
  '[data-testid="richTextElement"] h1',
  '[data-testid="richTextElement"] h2',
];

const WIX_PARAGRAPH_SELECTORS = [
  '[data-testid="richTextElement"] p',
  '.wixui-rich-text p',
  '[data-testid="textElement"]',
];
```

---

## Image Handling

### Image Element Structure

```html
<wow-image class="HcOXKn SJ8zOe" data-image-info='{"imageData":{"uri":"..."}}'>
  <img
    src="https://static.wixstatic.com/media/..."
    srcset="..."
    fetchpriority="high"
    alt="Image description"
  />
</wow-image>
```

### Image Detection

```javascript
const WIX_IMAGE_SELECTORS = [
  'wow-image img', // Wix wrapper element
  '[data-testid="imageElement"] img',
  '.wixui-image img',
  'img[src*="static.wixstatic.com"]',
  'img[data-src*="wixstatic"]',
];
```

### Wix Media URLs

```javascript
// Wix CDN URL patterns
const WIX_IMAGE_PATTERNS = [
  /static\.wixstatic\.com\/media/,
  /images-cdn\.wix\.com/,
  /images\/[a-f0-9]+/, // Wix internal image ID format
];

// Wix uses protocol for internal images
// wix:image://v1/abc123/image.jpg
```

### Lazy Loading

```javascript
// Wix lazy loading uses IntersectionObserver
const wixLazyImage = img.getAttribute('data-src') || img.closest('wow-image')?.dataset.imageSrc;
```

---

## CSS Classes

### Global Classes

Wix provides built-in global classes for styling:

```javascript
const WIX_GLOBAL_CLASSES = [
  '.wixui-rich-text',
  '.wixui-button',
  '.wixui-image',
  '.wixui-navigation',
  '.wixui-gallery',
];
```

### Semantic Classes

More specific classes for component parts:

```javascript
const WIX_SEMANTIC_CLASSES = [
  '.button__label', // Button text
  '.button__icon', // Button icon
  '.image__image', // Actual img element
  '.rich-text__text', // Text content
];
```

> [!TIP]
> Wix's class names can be obfuscated (e.g., `.HcOXKn`). Prefer `data-testid` selectors for stability.

---

## Data Attributes Deep Dive

### `data-testid` (Most Important)

The `data-testid` attribute is Wix's primary stable selector:

```javascript
const WIX_TESTID_PATTERNS = {
  button: '[data-testid="buttonElement"]',
  link: '[data-testid="linkElement"]',
  image: '[data-testid="imageElement"]',
  text: '[data-testid="richTextElement"]',
  heading: '[data-testid*="heading"]',
  section: '[data-testid*="section"]',
  menu: '[data-testid="horizontal-menu"]',
  gallery: '[data-testid="gallery"]',
  video: '[data-testid="videoPlayer"]',
};
```

### `data-hook` (Velo Development)

For sites using Velo (Wix's development platform):

```javascript
// Velo hooks for JavaScript interaction
const veloHooks = document.querySelectorAll('[data-hook]');
// These are developer-defined and stable for specific functionality
```

---

## Dynamic ID Detection

### Filtering Unstable IDs

```javascript
// Wix IDs to filter from generated selectors
function isUnstableWixId(id) {
  // comp-* IDs are actually STABLE in Wix (unlike Divi)
  // But class-based random suffixes should be filtered
  return /^Stylable[A-Z][a-z]+\d+__/.test(id); // Stylable components
}

// Wix class obfuscation detection
function isObfuscatedClass(className) {
  // Obfuscated classes like "HcOXKn" - 6 random chars
  return /^[A-Za-z]{6}$/.test(className);
}
```

---

## Adaptive Timing

### Thunderbolt Framework Hydration

Wix uses the "Thunderbolt" framework with progressive hydration:

```javascript
// Wait for Wix site hydration
const wixDelay = 2500; // 2.5 seconds recommended

// Check for hydration completion
const isHydrated = () => {
  return (
    document.querySelector('[data-testid]') !== null && !document.body.classList.contains('loading')
  );
};
```

### Lazy Loading Handling

```javascript
// Wix defers many images
// May need to scroll or wait for IntersectionObserver
async function waitForWixImages() {
  await new Promise(r => setTimeout(r, 1500));
  // Trigger visibility for lazy images
  window.dispatchEvent(new Event('scroll'));
}
```

---

## Velo API Selectors (Advanced)

For sites using Velo (Corvid):

```javascript
// Velo uses $w() selector function
// $w('#myElement') - by ID
// $w('Button') - by type

// These map to DOM as:
// id="myElement" or data-hook="myElement"
```

---

## Value for Developers

Wix-specific identifiers provide significant value:

1. **`comp-*` IDs**: Stable unique identifiers for custom CSS targeting
2. **`data-testid`**: Semantic, stable selectors for element types
3. **Wix Media URLs**: Can extract original image dimensions from URL
4. **Global classes**: Consistent across Wix themes

---

## Implementation Notes

### Selector Priority for Wix

1. `data-testid` attributes (most stable)
2. `comp-*` IDs (stable, unique)
3. `wixui-*` classes (semantic)
4. Generic fallbacks

### Challenges

- Obfuscated class names require filtering
- Heavy lazy loading requires timing adjustments
- Editor X vs Classic Wix have different structures

---

## References

- [Wix Developer Documentation](https://dev.wix.com/)
- [Velo by Wix API Reference](https://www.wix.com/velo/reference/)
- [Wix Studio Documentation](https://support.wix.com/en/studio)
