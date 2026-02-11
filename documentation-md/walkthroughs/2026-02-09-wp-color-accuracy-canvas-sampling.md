# Canvas Color Sampling Implementation Walkthrough

## Overview

Implemented visual color sampling (using canvas) for WordPress, Shopify, and Generic platforms to accurately capture rendered background colors, solving the issue where DOM-computed styles didn't match visual reality due to complex layering (e.g., in WordPress page builders).

Squarespace, Wix, and Webflow continue to use the faster DOM-computed method as their architecture is predictable.

## Changes Made

### 1. Platform Detection Logic

- Modified `src/analyzers/colors.ts` to add `shouldUseVisualSampling(platform)` helper.
- Returns `true` for `wordpress`, `shopify`, and `generic`.

### 2. Analyzer Updates

- Updated `scanAllPageColors` in `src/analyzers/colorScanner.ts`:
  - Now accepts `platform` and `screenshot` parameters.
  - If `shouldUseVisualSampling` is true, verifies background colors against the canvas screenshot.
- Updated `getStyleDefinition` in `src/analyzers/styleExtractor.ts`:
  - Similar logic added to verify background colors for individual elements.
- Updated `analyzeButtons`, `analyzeHeadings`, `analyzeParagraphs`, `analyzeLinks` to accept and pass through `platform` and `screenshot` parameters.

### 3. Orchestration

- Updated `entrypoints/content.ts` to pass the `fullPageScreenshot` and detected `platform` down to all analyzers.

## Verification Steps

### 1. WordPress Accuracy Test

1. Load the **WP build** (`.output/wp/chrome-mv3`) in Chrome.
2. Go to a WordPress site (e.g., `wordpress.com` or a site using Elementor).
3. Run the "Analyze This Page" report.
4. Check the **Outlier Colors** section.
5. **Verify**: The color swatches should match the visually rendered background colors, not hidden container colors.

### 2. Squarespace Regression Test

1. Load the **SQS build** (`.output/sqs/chrome-mv3`).
2. Analyze a Squarespace site.
3. **Verify**: The report should be identical to the previous version (no regressions in color detection).

### 3. Generic/Shopify Test

1. Load the **Generic build** (`.output/generic/chrome-mv3`).
2. Analyze a Shopify store.
3. **Verify**: Colors are accurately detected.
