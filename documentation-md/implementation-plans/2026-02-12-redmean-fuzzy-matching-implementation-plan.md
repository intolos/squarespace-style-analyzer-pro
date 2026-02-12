# Implementation Plan - Redmean Fuzzy Matching & Audit Trail

This plan addresses nearly-identical colors (e.g., `#2C3337` vs `#2C3338`) by implementing **Redmean** perceptual weighting and restores the "audit trail" (clickable instances) to the Colors Report.

## User Review Required

> [!IMPORTANT]
> **Selection Logic**: When merging similar colors:
>
> 1. **Majority Rule**: The color with the **highest usage count** wins.
> 2. **Tie-breaker**: If counts are equal, priority is given by element importance: **Headings > Buttons > Paragraphs > Links > Others**.
>    **Transparency**: Even when merged, the original hex code detected for each specific element will be preserved and visible in the "Audit Trail."

## Proposed Changes

### Core Utilities

#### [MODIFY] [colorUtils.ts](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/src/utils/colorUtils.ts)

- Add `calculateRedmeanDistance(hex1: string, hex2: string): number` function.
- Add `isVisuallySimilar(hex1: string, hex2: string, threshold = 2.3): boolean` helper.

---

### Core Analyzer

#### [MODIFY] [colors.ts](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/src/analyzers/colors.ts)

- Update `trackColor` to check for "near-matches" using Redmean.
- **Merge Logic**:
  1. Check if a visually similar color (threshold < 2.3) already exists.
  2. If found, add the new instance to that existing color's data.
  3. If the new color has a higher count (over time across pages), it can potentially become the new "Master" key for that group.

---

### UI / Report Generation

#### [MODIFY] [components.ts](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/src/export/styleGuideColorsReport/templates/components.ts)

- **Smart Grouping Indicator**: Add a `[+N similar]` badge to swatches that represent a merged group.
- **Audit Trail (Expandable)**: For each color swatch, add a `<details>`/`<summary>` section.
- **Instance Details**: Inside the audit trail, list:
  - **Context**: (e.g., "Button: 'Join Now'")
  - **Original Hex**: The exact color detected (useful if it differs from the Master swatch).
  - **Selector**: The CSS selector for easy location.

## Verification Plan

### Automated Tests

- Create a test suite to verify that `#2C3337` (40 uses) and `#2C3338` (2 uses) correctly merge into a single `#2C3337` entry.

### Manual Verification

- Verify the Colors Report on a site with complex shades.
- Confirm that clicking "View Instances" reveals the full audit trail with correct original hex codes.
- Ensure the `[+N similar]` badge appears only when actual merging has occurred.
