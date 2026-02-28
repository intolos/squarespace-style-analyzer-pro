# Gradients Reporting Feature Implementation Plan

## Goal Description

Add a new "Gradients" section to the colors report. The section will display gradients using a split swatch (half start color, half end color). Clicking the swatch will reveal gradient details along with standard location/usage details.

## User Review Required

> [!IMPORTANT]
> **Root Cause Identified**: The scanner currently skips elements where the `background-image` property contains a CSS variable (e.g., `var(--siteBackgroundColor)`) because it only checks for the literal string "gradient" _before_ attempting to resolve variables. In Squarespace 7.1, gradients are almost always stored in these variables.

Proposed Improvements:

1. **Aggressive Variable Resolution**: Update the scanner to trigger gradient analysis if a style contains `var(`, ensuring hidden gradients are resolved and scanned.
2. **Whitelist Background Layers**: Bypassing the visibility filter for elements that are likely background layers (e.g., `.section-background`).
3. **Serialization Hardening**: Ensuring the `gradients` object is explicitly preserved during cross-page merges in `resultsManager.ts`.

### 1. Data Structures (`src/export/types.ts` & `src/analyzers/colors.ts`)

- Add `gradients: Record<string, GradientData>` to `ColorData`.
- Define `GradientInstance` (similar to `ColorInstance` but optimized for gradient tracking).
- Define `GradientData` to store:
  - `count`
  - `rawString` (e.g., `linear-gradient(...)`)
  - `startColor` (extracted)
  - `endColor` (extracted)
  - `instances`

### 2. Gradient Extraction (`src/analyzers/colorScanner.ts` or related)

- During DOM traversal, explicitly check `computed.backgroundImage` and `computed.background` for the string `gradient`.
- Create a `trackGradient(rawGradient, element, ...)` function similar to `trackColor`.
- Implement a regex or parsing utility to reliably extract the _first_ and _last_ color stops from the computed gradient string. Computed styles typically normalize colors to `rgb/rgba`.

### 3. Merging Logic (`src/managers/resultsManager.ts`)

- Update `mergeResults` to properly propagate and deduplicate gradient data across page boundaries.

### 4. UI Rendering (`src/export/styleGuideColorsReport/templates/components.ts` & `index.ts`)

- Create a new template builder `buildGradientsSection`.
- Create `generateGradientSwatchTable` which renders split swatches. Using `background: linear-gradient(135deg, startColor 50%, endColor 50%)` creates a hard split for the swatch.
- The drawer inside the swatch will show instances just like solid colors, but will display `rawString` along with start/end details.

## Next Steps

- Review `colorScanner.ts` to see exactly where to inject the `trackGradient` call.
- Provide this plan to the user for approval.
