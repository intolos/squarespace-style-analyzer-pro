# Theme & Style Capture Documentation (`content-script-theme-capture.js`)

## Overview

Squarespace (and many modern CMSs) hides style definitions in complex, minified CSS files. This module **reverses-engineers** the "Theme" by analyzing the actual rendered page.

## Core Logic: "Majority Vote" Sampling

### 1. Heading Style Inference (`getMostCommonHeadingStyle`)

**Problem:** A user might have one `H1` that is styled differently (e.g., a special hero banner), but we want to know the "Global H1 Style".
**Solution:**

1.  Query **all** `H1` elements on the page.
2.  Group them by `font-family`.
3.  The group with the highest count is declared the **"Theme H1"**.
4.  We capture its full computed style (Font, weight, size, line-height, etc.).
    _Repeated for H1-H6._

### 2. Paragraph Size Classification

**Problem:** `<p>` tags don't usually carry classes like `paragraph-1` in the DOM.
**Solution:**

1.  We define standard Squarespace sizes:
    - **P1:** ~24px (1.5rem)
    - **P2:** ~17.6px (1.1rem)
    - **P3:** ~16px (1rem)
2.  We scan all paragraphs (filtering out Nav/Footer).
3.  We classify each paragraph based on **distance** to these standards.
    - `abs(current - P1)` vs `abs(current - P2)`...
4.  The most common style in each "bucket" becomes the Global Theme Style for P1/P2/P3.

### 3. Miscellaneous Font Detection

**Feature:** Squarespace 7.1 supports a "Misc" font style.
**Logic:**

- We check CSS Variables on `:root` (e.g., `--misc-font`, `--sqs-misc-font`).
- If found, we search the DOM for _any_ element actually using that font family.
- If found, we capture its style as the "Misc Font Style".

## Reconstruction Guide (Code Structure)

```javascript
var ContentScriptThemeCapture = {
  // 1. Voting Mechanism
  getMostCommonHeadingStyle(elements) {
    // Map <FontFamily, Count>
    // Return style of most frequent
  },

  // 2. Main Capture
  captureSquarespaceThemeStyles() {
    // A. Headings (H1-H6)
    //    -> Run Voting -> Save Style
    // B. Paragraphs
    //    -> Filter Nav/Footer
    //    -> Bucket into P1/P2/P3 based on size
    //    -> Run Voting per bucket -> Save Style
    // C. Misc Font
    //    -> Check CSS Variable -> Find Usage -> Save
  },
};
```
