# Content & Layout Analysis Documentation (`src/analyzers/`)

## Overview

This module analyzes the structural and semantic quality of the page content. It is split into several specialized analyzers:

- **Headings:** `src/analyzers/headings.ts`
- **Paragraphs:** `src/analyzers/paragraphs.ts`
- **Buttons & Links:** `src/analyzers/buttons.ts` & `src/analyzers/links.ts`
- **Assets:** `src/analyzers/images.ts`

## Critical Logic & heuristics

### 1. Button Analysis (`analyzeButtons`)

**Goal:** Identify all buttons and classify them (Primary/Secondary) while filtering out noise.

- **Selectors:** Broad matching including `<button>`, `input[type="submit"]`, and `a.button` / `a.sqs-block-button`.
- **Exclusions:** We explicitly ignore "utility" buttons to avoid report clutter:
  - Hamburger menus ("open menu", "close menu").
  - Accessibility aids ("skip to content").
  - Accordion/FAQ toggles (detected via `aria-expanded`, `aria-controls`, or parent class names).
- **Classification:**
  - **Primary:** Classes containing `primary`, `main-action`, `cta`.
  - **Secondary:** Classes containing `secondary`, `outline`.
  - **Tertiary:** Classes containing `tertiary`, `text-button`.

### 2. Heading Analysis (`analyzeHeadings`)

**Goal:** Ensure semantic hierarchy and visual consistency.

- **Hierarchy Validation:**
  - Flags missing `H1`.
  - Flags multiple `H1`s.
  - **Skipped Levels:** flags jumps like `H2` -> `H4` (skipping `H3`).
- **Visual Consistency:**
  - Groups headings by tag (e.g., all `H2`s).
  - Checks `computedStyle.fontSize`.
  - **Alerts** if the _same_ tag level appears in 3+ different visual sizes (indicates sloppy design).

### 3. Paragraph Analysis (`analyzeParagraphs`)

**Goal:** Map generic `<p>` tags to Squarespace's design system (P1, P2, P3).

- **Detection Strategy:**
  1.  **Class Name:** Checks for `sqs-html-content` classes (`p1`, `p2`, `p3`) or semantic classes (`lead`, `caption`, `hero-text`).
  2.  **Context:**
      - Inside `hero/banner` -> defaults to **P1**.
      - Inside `footer/sidebar` -> defaults to **P4**.
      - Inside `testimonial/quote` -> defaults to **P3**.
  3.  **Size Matching (Fallback):** Compares `fontSize` against the captured Theme Styles. Assigns the nearest match (P1/P2/P3).

### 4. Image Filename Analysis (`isGenericImageFilename`)

**Goal:** SEO check for lazy file naming.

- **Regex Patterns:** Massive regex library to detect unoptimized names:
  - **Cameras:** `DSC_...`, `IMG_...`, `DCIM...`
  - **Stock:** `shutterstock_...`, `istock_...`, `unsplash...`
  - **Screenshots:** `Screenshot 2024...`, `Screen Shot...`
  - **Placeholders:** `untitled`, `unknown`, `image1`.
  - **UUIDs:** Hash strings (32 chars) or UUIDs.

## Reconstruction Guide (Code Structure)

```typescript
// Example from src/analyzers/buttons.ts
export function analyzeButtons(results: AnalysisResults, ...): void {
   // Query selectors -> Filter exclusions -> Classify type (Pri/Sec)
   // Check contrast using colorTracker
}

// Example from src/analyzers/headings.ts
export function analyzeHeadings(results: AnalysisResults, ...): void {
   // Query H1-H6
   // Check H1 sanity (0 or >1)
   // Check sequence (H2 -> H4 broken?)
   // Check visual consistency (H2 size variance)
}

// Example from src/analyzers/images.ts
export function isGenericImageFilename(filename: string): string | null {
    // Extensive Regex checks for SEO
}
```
