# Squarespace-Specific Elements Analysis

**Date**: January 15, 2026  
**Purpose**: Technical catalog of SQS-specific elements for dual-extension architecture  
**Related**: See [PRODUCT_STRATEGY.md](../PRODUCT_STRATEGY.md) for the full product vision

---

## Context

This document catalogs all Squarespace-specific elements in the codebase. These elements are used by:

- **Squarespace Style Analyzer Pro**: Always active, branding included
- **Website Style Analyzer Pro**: Auto-activated when SQS site detected, no SQS branding

**Element Count for Platform Detection Messaging**: **15+ elements** (used in generic version's bonus message)

---

## Three-Way Classification

Elements are classified into three categories:

| Category           | Description                                                                         | Action               |
| ------------------ | ----------------------------------------------------------------------------------- | -------------------- |
| 🔴 **TOGGLE**      | Branding-only, no functional value for generic                                      | Toggle via config    |
| 🟢 **KEEP ALWAYS** | Functional value for ALL websites (including SQS sites analyzed by generic version) | No change needed     |
| 🟡 **REORDER**     | Both SQS and generic selectors exist; reorder priority based on version             | Conditional ordering |

---

## 🔴 TOGGLE: Branding & Product Identity

These elements have **no functional value** in the generic version and should be toggled.

### Product Names & Strings

| File                                | Line     | Current Value                    | Generic Value                |
| ----------------------------------- | -------- | -------------------------------- | ---------------------------- |
| export-style-guide-colors-report.js | 808      | "Squarespace Style Analyzer Pro" | "Website Style Analyzer Pro" |
| export-html-reports.js              | 675/1001 | "Squarespace Style Analyzer Pro" | "Website Style Analyzer Pro" |
| export-images-report.js             | 101      | "Squarespace Style Analyzer Pro" | "Website Style Analyzer Pro" |
| export-mobile-report.js             | 160      | "Squarespace Style Analyzer Pro" | "Website Style Analyzer Pro" |
| sqs-style-analyzer-main.js          | 9        | Console log with product name    | Update name                  |

### Report Disclaimer

**File**: `export-html-reports.js` line 1036

```
Current: "...Squarespace code is not always easy to analyze..."
Generic: Remove Squarespace-specific disclaimer OR use neutral language
```

### Icon/Favicon URLs

| File                                | Lines    | Current                                     |
| ----------------------------------- | -------- | ------------------------------------------- |
| export-style-guide-colors-report.js | 460      | `squarespace-style-analyzer-pro/icon32.png` |
| export-html-reports.js              | 653, 932 | Same                                        |
| export-images-report.js             | 61       | Same                                        |
| export-mobile-report.js             | 107      | Same                                        |

### API & Payment URLs

**File**: `license-manager.js`

```javascript
// TOGGLE: Different product IDs and URLs per version
API_BASE: 'https://squarespace-style-analyzer-pro.eamass.workers.dev',
PRODUCT_ID: 'squarespace-style-analyzer',
SUCCESS_URL_YEARLY: 'https://intolos.github.io/squarespace-style-analyzer-pro/...',
// etc.
```

---

## 🟢 KEEP ALWAYS: Functional for All Websites

These elements provide value even when the generic version analyzes Squarespace sites.

### Generic Image Filename Detection

**File**: `content-script-analyzers.js` line 755

```javascript
// KEEP: Generic version will still encounter SQS sites
// Users benefit from knowing their images have SQS default names
if (/^(sqs[-_]?image|hero[-_]?image)\d*\./i.test(filename)) return 'squarespace-default';
```

> [!IMPORTANT]
> The generic version will analyze Squarespace sites too. Users should still be warned about platform-generated filenames that hurt SEO.

### Data Attribute Handling for Images

**File**: `content-script-analyzers.js` lines 849-878

```javascript
// KEEP: Lazy loading attributes work on SQS sites visited by generic version
var src = img.src || img.getAttribute('data-src') || img.getAttribute('data-image') || ...;

// KEEP: SQS dimension attributes useful when analyzing SQS sites
var dims = img.getAttribute('data-image-dimensions');
```

### YUI Dynamic ID Detection

**File**: `content-script-helpers.js` lines 189-190

```javascript
// KEEP: Prevents bad selectors when generic version analyzes SQS sites
if (/^yui_/.test(id)) return true; // Skip YUI dynamic IDs
```

### Squarespace Detection Logic

**File**: `domain-analyzer.js` lines 391-413

```javascript
// KEEP: Could be useful for adaptive behavior in generic version
// (e.g., longer wait times for SQS sites)
var isSquarespace = document.querySelector('meta[name="generator"][content*="Squarespace"]');
```

> [!TIP]
> Consider making this a general "platform detection" feature that could identify Squarespace, WordPress, Wix, etc. for optimized analysis.

---

## 🟡 REORDER: Selector Priority

These have both SQS-specific and generic selectors. Keep all selectors but change priority order.

### Button Selectors

**File**: `content-script-analyzers.js` lines 12-28

| Selector                           | Type    | Keep?                   |
| ---------------------------------- | ------- | ----------------------- |
| `button:not([aria-hidden="true"])` | Generic | ✅                      |
| `a.button`, `a.btn`                | Generic | ✅                      |
| `a[class*="sqs-button"]`           | SQS     | ✅ (helps on SQS sites) |
| `a[class*="sqs-block-button"]`     | SQS     | ✅                      |
| `.sqs-block-button-element`        | SQS     | ✅                      |
| `.sqs-button-element--*`           | SQS     | ✅                      |
| `a[href][class*="btn"]`, etc.      | Generic | ✅                      |

**Recommendation**: Keep ALL selectors. For SQS version, SQS selectors first. For generic version, generic selectors first.

### Navigation Selectors

**File**: `domain-analysis-manager.js` lines 223-253

```javascript
// CURRENT ORDER: SQS-specific first
'nav[data-content-field="navigation"]',  // SQS
'.header-nav',                            // SQS
'.header-nav-wrapper',                    // SQS
'header nav',                             // Generic
'nav[role="navigation"]',                 // Generic
// ...
```

**Recommendation**:

- **SQS version**: Keep current order (SQS selectors first)
- **Generic version**: Move generic selectors first, but KEEP SQS selectors at end

### Folder/Dropdown Selectors

**File**: `domain-analysis-manager.js` lines 274-292

Same pattern - both SQS and generic selectors exist. Reorder based on version.

### Content Area Selectors

**File**: `content-script-analyzers.js` line 616

```javascript
// Contains both generic and SQS selectors
'main, article, section, .content, .page-content, [role="main"], .sqs-block-content';
```

**Recommendation**: Keep `.sqs-block-content` for when generic version analyzes SQS sites.

---

## 🟡 SPECIAL: Theme Capture

**File**: `content-script-theme-capture.js`

### Function Name

- Current: `captureSquarespaceThemeStyles()`
- Recommendation: Rename to `captureThemeStyles()` for generic version

### Paragraph Size Defaults

Lines 122-126:

```javascript
// These are SQS defaults but also reasonable generic defaults
var p1Size = 1.5 * 16; // 24px - reasonable for "large" text
var p2Size = 1.1 * 16; // 17.6px - reasonable for body
var p3Size = 1.0 * 16; // 16px - reasonable for small
```

**Recommendation**: KEEP these values - they're reasonable defaults for any website.

### CSS Variable `--sqs-misc-font`

Line 189:

```javascript
var miscFont =
  computedStyle.getPropertyValue('--misc-font') ||
  computedStyle.getPropertyValue('--miscellaneous-font') ||
  computedStyle.getPropertyValue('--font-misc') ||
  computedStyle.getPropertyValue('--sqs-misc-font'); // SQS specific
```

**Recommendation**: KEEP the SQS variable check at the end - helps when generic version analyzes SQS sites.

---

## Implementation Strategy

### Option A: Simple Config Flag (Recommended)

```javascript
// config.js
const CONFIG = {
  IS_SQS_VERSION: true, // false for generic

  PRODUCT_NAME: this.IS_SQS_VERSION
    ? 'Squarespace Style Analyzer Pro'
    : 'Website Style Analyzer Pro',

  // Selector ordering
  PRIORITIZE_SQS_SELECTORS: this.IS_SQS_VERSION,
};
```

### Option B: Build-Time Replacement

Use different build scripts to replace branding strings at build time.

---

## Summary of Changes

| Change Type             | Count        | Effort        |
| ----------------------- | ------------ | ------------- |
| Toggle branding strings | 12           | Low (1 hr)    |
| Toggle API URLs         | 6            | Low (30 min)  |
| Reorder selectors       | 4 locations  | Medium (1 hr) |
| Rename function         | 1            | Low (15 min)  |
| **Keep unchanged**      | 10+ patterns | None          |

---

## Additional Suggestions

1. **Platform Detection Feature**: Expand the Squarespace detection into a general "platform detector" that identifies WordPress, Wix, Webflow, etc. This could enable version-specific optimizations.

2. **Location Column**: Keep in both versions - useful for all websites.

3. **Theme Capture**: The logic works for any site; only naming is SQS-specific.

4. **Test on Non-SQS Sites**: Before finalizing, test the generic version on WordPress, Wix, and static HTML sites.
