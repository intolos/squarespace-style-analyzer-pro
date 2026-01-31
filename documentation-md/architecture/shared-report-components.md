# Shared Report Components Architecture

## Overview

As of Jan 2026, the `aggregatedStylesReport` and `pageByPageReport` modules share a common rendering infrastructure to ensure consistent visual presentation of styled elements (Headings, Paragraphs, Buttons, Links).

## Core Component: `generateStyledElementSection`

Located in `src/export/reportComponents.ts`.

This function encapsulates the logic for:

1.  **Grouping Styles**: Uses `StyleComparisonUtils.groupByStyleDefinition` to group elements by their computed style.
2.  **Baseline Identification**: Identifies the most common style as the "Baseline".
3.  **Variation Analysis**: Identifies less common styles as "Variations" and calculates the CSS property differences compared to the Baseline.
4.  **Rendering**: Generates the HTML structure:
    - **Wrapper**: A colored/bordered box (Green for consistent, Red for inconsistent).
    - **Header**: Title + Count + Status (Consistent/Variations).
    - **Accordions**: An accordion for the Baseline and each Variation.
    - **Details**: Inside each accordion, lists instances with "Locate" links.

## Usage

### Aggregated Styles Report (`aggregatedStylesReport.ts`)

Calls `generateStyledElementSection` for every element category (H1-H6, P1-P3, Buttons, Links).

- **Context**: "All Pages"
- **Grouping**: Groups all instances across the entire site.
- **Verification**: Helps users seeing global inconsistencies.

### Page-by-Page Report (`pageByPageReport.ts`)

Calls `generateStyledElementSection` for every element category _within a specific page_.

- **Context**: "Single Page"
- **Grouping**: Groups instances found on that specific page.
- **Verification**: Helps users seeing if a specific page has inconsistent styling (e.g., two different H1 styles on the Contact page).

## Benefits

- **Single Source of Truth**: UI logic for "how to display style variations" is in one place.
- **Consistency**: The "Baseline vs. Variation" UI is identical in both reports.
- **Maintainability**: Improvements to diff highlighting or accordion behavior apply to both reports instantly.

## Shared Styling Infrastructure: `reportStyles.ts`

Located in `src/export/reportStyles.ts`.

This module provides shared CSS constants to ensure visual consistency across all HTML reports (Website Analysis, Mobile, Images, Brand Style Guide). It prevents duplication of common UI element styles.

### Exports

1.  **`ACCORDION_STYLES`**:
    - Unified styling for accordion containers, headers, titles, icons, and content.
    - Includes the standard "open/close" behavior styles.
    - **Usage**: Import and interpolate into the report's CSS string.

2.  **`ACCORDION_SCRIPT`**:
    - Minified vanilla JavaScript to handle accordion toggling interactivity.
    - **Usage**: Import and include in the report's HTML body.

3.  **`SECTION_HEADER_STYLES`**:
    - Consistent styling for major report sections (blue background, white text).

4.  **`TOC_STYLES`**:
    - Standardized Table of Contents styling (blue border, list format).

5.  **`ISSUE_ITEM_STYLES`**:
    - Base styles for issue cards (red border for errors, orange for warnings).
    - **Note regarding Contextual Hover**: Specific reports may implement custom hover colors (e.g., `brand-style-guide`) to match their specific background nuances. These specific overrides should reside in the report's template file, not the shared module.

### Integration Pattern

```typescript
import { ACCORDION_STYLES, ACCORDION_SCRIPT } from '../../reportStyles';

// In the report export function:
const css = `
  /* Report-specific styles */
  .my-custom-class { ... }
  
  /* Shared styles */
  ${ACCORDION_STYLES}
`;

const html = `
  <html>
    <style>${css}</style>
    <body>
      ...
      ${ACCORDION_SCRIPT}
    </body>
  </html>
`;
```
