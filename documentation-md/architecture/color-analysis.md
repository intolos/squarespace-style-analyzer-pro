# Color Analysis Documentation (`src/analyzers/colors.ts`)

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

The analyzer uses a "fall-through" priority system to determine background color:

1.  **Direct Solid Color:** If element has `background-color`, use it (Fastest).
2.  **Screenshot Sampling:** If element is a Button/Link (high risk of background images), check the screenshot.
3.  **DOM Traversal:** Walk up the parent tree to find the nearest solid background.
4.  **Fallback:** Default to White `rgb(255, 255, 255)`.

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
