# Discussion & Analysis: Color Accuracy Improvements

**Date:** 2026-02-09  
**Session Focus:** Comparative analysis of color extraction strategies and the implementation of canvas-based sampling.

---

## 1. The Problem Statement

On complex platforms like **WordPress**, the extension's reliance on DOM-computed styles (`getComputedStyle`) frequently led to incorrect color designations. Professional page builders (Elementor, Divi, etc.) often use a "layered" approach where:

- A wrapper element (`.lp-block`) has a default background (often white or transparent).
- An inner element (`.lp-background`) renders the actual visual color.

The analyzer would incorrectly assign the container's color to the report, creating a mismatch between the report swatches and what the user visually sees.

---

## 2. Analysis of Extraction Strategies

We analyzed two primary ways to detect color:

| Strategy            | Pros                                                                 | Cons                                                           |
| :------------------ | :------------------------------------------------------------------- | :------------------------------------------------------------- |
| **DOM-Computed**    | Extremely fast, reliable for standard CSS, no external dependencies. | Fails with complex layering, background images, and gradients. |
| **Canvas Sampling** | 100% Visual accuracy (pixel-level), mimics human perception.         | Slower overhead (requires screenshot + canvas processing).     |

---

## 3. Platform-by-Platform Deep Dive

We conducted a deep analysis to determine the best strategy for each supported platform:

### ✅ Squarespace (Stay: DOM-Computed)

- **Architecture:** Predictable, flat DOM.
- **Reasoning:** SQS uses a consistent design system where styles are applied directly to the rendering elements. Reverting to canvas here would add unnecessary overhead without accuracy gains.

### ✅ WordPress (Change: Canvas Sampling)

- **Architecture:** Highly variable, legacy themes, third-party builders.
- **Reasoning:** The builder ecosystem creates unpredictable layering. Canvas sampling is the only way to guarantee the color reported is the color seen.

### ✅ Wix (Stay: DOM-Computed / Monitor)

- **Architecture:** Proprietary viewer, self-contained elements.
- **Reasoning:** Wix's issues are often related to `<canvas>` or WebGL rendering rather than DOM layering. DOM-computed remains the safest baseline for now.

### ✅ Webflow (Stay: DOM-Computed)

- **Architecture:** Semantic, class-based HTML.
- **Reasoning:** Webflow exports high-quality, flat HTML that works perfectly with standard computed styles.

### ✅ Shopify (Change: Canvas Sampling)

- **Architecture:** Section-based, app-injected elements.
- **Reasoning:** While themes are generally clean, app injections and section wrappers introduce enough variability to warrant the safer visual approach.

### ✅ Generic (Change: Canvas Sampling)

- **Architecture:** Unknown.
- **Reasoning:** Since we cannot predict the DOM structure of custom-built sites, visual sampling is the most robust universal solution.

---

## 4. The Solution: "Platform-Aware" Extraction

Instead of a "one-size-fits-all" approach, we implemented a system that detects the platform at runtime and selects the optimal sampling method:

1.  **Platform Detection**: Trigger logic only when `platform` is `wordpress`, `shopify`, or `generic`.
2.  **Screenshot Capture**: `content.ts` captures a the tab screenshot once at the start of analysis.
3.  **Visual Overrides**: `scanAllPageColors` and `getStyleDefinition` verify the background color against the screenshot pixels. If a visual color exists, it overrides the DOM color for the report.

---

## 5. Decision Log

- **Question:** Should we apply this to all sites (Option C)?
- **Answer:** No. While highly accurate, the performance cost is unnecessary for Squarespace and Webflow where DOM-computed is already 100% accurate. We chose **Option A (Targeted Runtime Implementation)** to fix the problem without the risk of regression or bloat on stable platforms.
