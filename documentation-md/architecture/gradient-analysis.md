# Gradient Analysis Architecture

## Overview

The Gradient Analysis system detects and reports CSS gradients used as backgrounds across the page. It is integrated into the `ColorScanner` but uses specialized extraction and rendering logic to handle the complexity of gradient strings.

## Key Components

- `src/analyzers/colorScanner.ts`: Main scanner that identifies potential gradients.
- `src/analyzers/colors.ts`: `trackGradient()` function that parses strings and extracts start/end colors.
- `src/export/styleGuideColorsReport/templates/components.ts`: Renders the "Split Swatch" UI.

## Operational Logic

1.  **Detection**: During DOM traversal in `scanAllPageColors`, the system checks `computed.backgroundImage` and `computed.background`.
2.  **Variable Resolution**: Before checking for the `gradient` keyword, the system resolves CSS variables (e.g., `var(--siteBackgroundColor)`). This is critical for Squarespace 7.1 sites where most gradients are stored in theme variables.
3.  **Whitelisting**: Background layers (e.g., `.section-background`) are whitelisted from standard visibility filters to ensure they are scanned even if他們 lack interactive markers.
4.  **Extraction**: The `trackGradient` function uses a regex to find all color values in the gradient string. It identifies the first and last colors to represent the gradient's range.
5.  **Grouping**: Gradients are grouped by their literal `rawString` value.

## Data Flow

`Scanner -> trackGradient -> ColorData.gradients -> ResultsManager (Merge) -> Report Generator`

## Critical Implementation Details

### Variable Detection Gap Fix

The scanner MUST resolve `var()` before checking for `gradient` strings. Failure to do so results in zero gradients detected on platforms like Squarespace 7.1.

### Report UI: Split Swatches

Gradients are displayed in the report using a hard-split swatch:
`background: linear-gradient(135deg, startColor 50%, endColor 50%)`
This provides a clean visual representation of the gradient's primary colors.

### Visibility Whitelisting

Elements with the following classes are scanned regardless of dimension/visibility metadata if they have a non-none background:

- `.section-background`
- `.section-border`
- `.banner-thumbnail-wrapper`

## Dependencies

- `colorUtils.ts`: Handles RGBA/HSLA to Hex conversion for extraction.
- `domHelpers.ts`: Provides metadata for section/block labeling.
