# Architecture: Accessibility Issue Filters

This document catalogs the existing filtering logic used across the application to reduce false positives in accessibility analysis. This serves as the reference for refactoring these into a centralized `issueFilters.ts` utility.

## 1. Text & Element Exclusion Patterns

**Current Location:**

- `analyzers/buttons.ts` (Lines 21-34)
- `analyzers/mobileScripts.ts` (Lines 124-137) **[DUPLICATE]**

**Logic:**
excludes elements containing specific text (case-insensitive):

- Navigation/Action keywords: `open menu`, `close menu`, `skip to content`, `skip to`
- Functional labels: `folder:`, `cookie`
- Background controls: `pause background`, `play background`, `background`
- Image metadata: `large images`, `all images`, `images (>100kb)`

## 2. Visibility Filters

**Current Location:**

- `analyzers/colorScanner.ts` (Lines 38-69)
- `analyzers/mobileScripts.ts` (Lines 110-116)
- `analyzers/styleExtractor.ts` (Lines 27-30)

**Logic:**
Elements are excluded if:

- Dimensions (width/height) are 0
- `display: none`
- `visibility: hidden`
- `opacity` < 0.01 (or 0)
- Note: Footers often have more lenient off-screen checks.

## 3. Color & Transparency Filters

**Current Location:** `utils/colorUtils.ts`

**Logic:**

- `isTransparentColor()`: Excludes `transparent`, `rgba(0,0,0,0)`, `inherit`, `initial`.

## 4. Element Type Specific Filters

### Ghost Buttons

**Location:** `analyzers/colors.ts`
**Logic:** `isGhostButtonForColorAnalysis()` filters buttons/anchors that have **no text** and **no aria-label**.

### Icons & Social Elements

**Location:** `utils/domHelpers.ts`
**Logic:** `isIconOrSocialElement()` filters:

- `role="img"`
- Classes matching `icon`, `social`, `share`, `badge`, `avatar`
- Social widgets (`sharethis`, `addthis`, etc.)
- Small SVGs or elements (≤64px)
- Small elements with background images

### Accordion & FAQ Toggles

**Location:** `analyzers/buttons.ts`
**Logic:** Filters elements that function as accordions to avoid clogging button inventory:

- Attributes: `aria-expanded`, `aria-controls`
- Classes: `accordion`, `collapse`, `toggle`, `dropdown`, `faq`
- Checks parent elements up to 3 levels deep.

### Typing Cursors (Contrast Only)

**Location:** `analyzers/colors.ts`
**Logic:** Inline RegExp `/\|\s*$/` filters text ending in a pipe character (simulated cursor).

## 5. Mobile-Specific Filters

**Location:** `analyzers/mobileScripts.ts`

**Logic:**

- `aria-hidden="true"`
- `role="presentation"` or `role="none"`
- Off-screen check (top/left < -5000px)

## 6. Platform-Specific Filters

### WordPress Button Wrappers

**Location:** `analyzers/colors.ts`
**Logic:** Inline check for class `.wp-block-button`. Wrappers are skipped; inner links are analyzed.

## 7. Missing / Known Issues

- **None**: Previously listed "Gradient Backgrounds" is now resolved (see Section 8).

## 8. Complex Background Filters

### Gradient Backgrounds

**Location:** `utils/issueFilters.ts` (function `hasGradientBackground`)
**Logic:**
To prevent false positives where contrast analysis fails on complex backgrounds (e.g., white text on dark gradient being read as white-on-white/transparent):

1.  Checks the element and ancestors (up to 10 levels).
2.  Inspects `background-image` and `background` shorthand styles.
3.  Returns `true` (skip analysis) if it contains keywords: `gradient`, `url(`.
4.  Ensures the background element itself is visible and not fully transparent before flagging.
