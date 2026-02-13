# Color Analysis Documentation (`src/analyzers/colors.ts`)

**Related Documents**:
- [Redmean Fuzzy Color Matching](./redmean-fuzzy-color-matching.md) - Complete Redmean algorithm documentation
- [Platform Background Detection](./platform-background-detection.md) - Platform-specific background detection
- [Color System Integration](./color-system-integration.md) - How systems integrate

## Overview

This module handles all color-related logic. It is split into two parts:

- **Logic Orchestrator:** `src/analyzers/colors.ts`
- **Pixel Scanner:** `src/analyzers/colorScanner.ts`
- **Filter Utility:** `src/utils/issueFilters.ts` (Centralized exclusions & safety checks)

## Critical Logic & "The Why"

### 1. Pixel Sampling (`getBackgroundColorFromCanvas`)

**Problem:** DOM-based `getComputedStyle` fails to detect background colors when they come from:

- Background images.
- CSS Gradients.
- Semi-transparent overlays on top of other elements.
  **Solution:**
- We capture a visible tab screenshot (`chrome.tabs.captureVisibleTab`).
- We draw this screenshot onto an HTML `<canvas>`.
- We calculate the element's center coordinates (`getBoundingClientRect`).
- We sample a **5x5 pixel grid** around the center and average the RGB values.
  **Why:** This mimics the human eye (and tools like WAVE), capturing the _rendered_ pixel color rather than the _declared_ CSS color.

### 2. Effective Background Strategy (`getEffectiveBackgroundColor`)

> **See Also**: [Platform Background Detection](./platform-background-detection.md) for complete detector implementation details.

The analyzer uses a prioritized system to determine the background color. The primary strategy is determined by the platform to balance visual accuracy against processing speed.

| Platform        | Element Type        | Extraction Strategy | Rationale                                                     |
| :-------------- | :------------------ | :------------------ | :------------------------------------------------------------ |
| **WordPress**   | **Non-text** (div, button) | **Pseudo-Element**  | LaunchPad renders backgrounds on ::before pseudo-elements.    |
| **WordPress**   | **Text** (p, span, a)      | **DOM Walking**     | Find section/container background, skip decorative overlays.  |
| **Shopify**     | All                 | **Canvas Sampling** | Variable theme architectures and app-injected layers.         |
| **Generic**     | All                 | **Canvas Sampling** | Safety for unknown/custom DOM structures.                     |
| **Squarespace** | All                 | **DOM-Computed**    | Flat, predictable architecture with direct style application. |
| **Wix**         | All                 | **DOM-Computed**    | Self-contained elements with reliable computed styles.        |
| **Webflow**     | All                 | **DOM-Computed**    | High-quality semantic HTML/CSS output.                        |

#### Detection Method Priority by Platform:

**WordPress Non-Text**: `::before` (validated) → `::after` (validated) → CSS classes → computed style → DOM walk → canvas → indeterminate  
**WordPress Text**: CSS classes → DOM walk → computed style → canvas → indeterminate  
**Squarespace**: computed style → DOM walk → `::before` → `::after` → canvas → white fallback  
**Generic**: computed style → CSS classes → `::before` → `::after` → DOM walk → canvas → indeterminate

> **Important**: WordPress text elements skip pseudo-element checks to avoid decorative overlays (e.g., #000000 `::before` on paragraphs) being mistaken for readable backgrounds. See [Platform Background Detection](./platform-background-detection.md) for implementation details.

#### Fall-through Priority:

1.  **Platform Strategy**: Use the strategy defined in the table above.
2.  **Sampling Verification**: If Canvas Sampling is used, verify the pixel color against the DOM-computed color.
3.  **Screenshot Sampling**: For Buttons/Links on DOM-computed platforms, check the screenshot if high risk (e.g., hover states or background images).
4.  **DOM Traversal**: If no solid color is found, walk up the parent tree to the nearest solid background.
5.  **Fallback**: Default to White `rgb(255, 255, 255)`.

### 3. Visibility Check (`isElementActuallyVisible`)

To avoid false positives, we ignore elements that users can't see.
**Checks enforced:**

- Dimensions (`width/height > 0`).
- CSS Visibility (`display: none`, `visibility: hidden`, `opacity < 0.01`).
- Off-screen Position (`left < -1000`).
- **Occlusion:** Uses `document.elementFromPoint(centerX, centerY)` to verify if the element is covered by another layer (e.g., a modal or sticky header).

### 4. "Ghost Button" Detection

We explicitly ignore buttons/links that have:

- No text content.
- No `aria-label`.
  **Why:** These are often click-targets or layout hacks that shouldn't trigger "Low Contrast" errors.

## Reconstruction Guide (Code Structure)

```typescript
// Shared logic in src/analyzers/colors.ts
export const ColorAnalyzer = {
  // 1. Math Helpers
  rgbToHex(rgb: string) { ... },
  calculateLuminance(hex: string) { ... },
  calculateContrastRatio(c1: string, c2: string) { ... },

  // 2. Core Detection
  getEffectiveBackgroundColor(el: HTMLElement, ...): string {
     // Check solid color -> Check screenshot -> Check parents -> Default White
  },

  // 3. Tracking
  trackContrastPair(...): void {
     // Main entry point for Report generation
     // Deduplicates elements to avoid noise
  }
};

// Specialized logic in src/analyzers/colorScanner.ts
export const ColorScanner = {
  getBackgroundColorFromCanvas(el: HTMLElement, screenshot: string): string {
     // Canvas logic: drawImage -> getImageData -> average 5x5 grid
  }
};
```

### 5. Redmean Fuzzy Color Matching

> **See Also**: [Redmean Fuzzy Color Matching](./redmean-fuzzy-color-matching.md) for complete algorithm documentation with formulas and implementation details.

**Problem:** Browser rendering artifacts (anti-aliasing, sub-pixel rounding, canvas averaging) can produce slightly different hex values for visually identical colors (e.g., `#2C3337` vs `#2C3338`).

**Solution:** The `trackColor` function uses **Weighted Euclidean (Redmean)** perceptual distance to merge visually indistinguishable colors at scan time.

#### Algorithm: Redmean

- Weights R/G/B channels based on how much red is present.
- More perceptually accurate than standard Euclidean distance.
- Computationally inexpensive (no CIEDE2000/Delta E needed).
- Implemented in `src/utils/colorUtils.ts` as `calculateRedmeanDistance()`.

#### Merge Threshold: 2.3

- Intentionally tight to avoid merging intentional design choices.
- Only merges colors caused by rendering artifacts.

#### Selection Logic (Majority Rule & Tie-Breakers)

1.  **Majority Rule**: The color with the highest instance count becomes the "Master" key.
2.  **Tie-Breaker**: If counts are equal, priority is determined by semantic importance:
    - **Headings (H1-H6)** > **Buttons** > **Paragraphs** > **Links** > **Others**
    - _Rationale_: A color used in a Heading is more likely to be the intended brand color than one used in a border or div.

- All subsequent visually similar colors are merged into that master's entry.
- Each instance preserves its `originalHex` for transparency.
- A `mergedColors` set on each color entry tracks which hex codes were folded in.

#### Report UI Interaction

- **Visual "Master" Color**: The swatch displays the color with the highest usage count (the "winner" of the majority rule).
- **`[+N similar]` Badge**:
  - Appears only when fuzzy merging has occurred.
  - **Hover**: Shows a tooltip listing the specific hex codes that were merged (e.g., "Visually similar colors merged: #2C3337, #2C3338").
- **Audit Trail (Click to Expand)**:
  - Each swatch has a clickable "View X instances" text (using `<details>`/`<summary>`).
  - **Expanded View**: Lists up to 10 specific locations where this color (or its merged variants) was found.
  - **Data Shown**:
    - **Context**: Element type and content (e.g., "Button: 'Contact Us'").
    - **Original Hex**: If the instance's color differed from the master, it shows `(detected as #XYZ)`.
    - **Selector**: The full CSS selector for easy debugging.

#### Key Files

- `src/utils/colorUtils.ts`: `calculateRedmeanDistance()`, `isVisuallySimilar()`
- `src/analyzers/colors.ts`: `trackColor()` (fuzzy matching logic)
- `src/export/styleGuideColorsReport/templates/components.ts`: Report HTML template
- `src/export/styleGuideColorsReport/templates/styles.ts`: CSS for badges/audit trail
- `src/export/styleGuideColorsReport/types.ts`: `ColorInstance.originalHex`, `ColorData.mergedColors`
- `src/export/styleGuideColorsReport/analysis.ts`: `groupSimilarColors()` uses Redmean

---

**Document Version**: 1.1  
**Last Updated**: 2026-02-13  
**Changes**: Updated platform detection table to reflect WordPress text element handling (paragraphs skip pseudo-element checks)
