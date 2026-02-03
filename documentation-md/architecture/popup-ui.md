# Popup UI Architecture

## Overview

The extension popup provides the primary interface for initiating analyses and viewing results. It is designed to be lean, with a "Results-First" philosophy after an analysis is completed.

## Key Components

- `index.html`: Defines the structural layout using CSS Flexbox.
- `style.css`: Manages visual styling, including dark mode themes and component ordering.
- `main.ts`: Orchestrates UI state changes based on premium status and analysis results.
- `DomainAnalysisUI.ts`: Handles the multi-page analysis flow and file selection modal.
- `SinglePageAnalysisUI.ts`: Handles the active tab analysis flow.

## Performance Architecture (Optimized 2026-01-31)

To ensure a "Premium" feel, the popup is architected to be instantly visible and interactive, even before heavy features are loaded.

### 1. Eliminating the "White Flash" (FCP)

- **What**: Critical styles (background gradient, font-family, and locked dimensions) are inlined directly in the `<head>` of `index.html`.
- **Why**: Standard CSS files take time to download and parse. Inlined styles ensure the browser paints the correct background colors _immediately_ upon opening, killing the jarring white square that users often see in Chromium extensions.

### 2. Instant Interaction (Lazy Loading / Chunks)

- **What**: The heavy "Report Generation" logic (CSV, HTML, Images, Mobile reports) is decoupled from the main analysis logic using **Dynamic Imports** (`await import()`).
- **Why**:
  - **Reduced Bundle Size**: The initial `popup.js` size was reduced by **62%** (from ~201KB to ~78KB).
  - **Faster TTI (Time to Interactive)**: A smaller JS bundle is parsed almost instantly. This ensures the "Analyze This Page" buttons are functional within milliseconds of the popup opening.
  - **On-Demand Loading**: Users only download the reporting code if and when they click "Export."

### 3. Shared Standardization

- **What**: All exported reports now use a shared `generateReportHeader` component from `reportComponents.ts`.
- **Why**: This ensures a consistent brand identity across all 6+ report types and allows for centralized updates (e.g., doubling the platform message font size) without modifying every report file individually.

## Critical Implementation Details

- **Async Exports**: Because of lazy loading, all `ExportManager` methods are now `async`. Calls in `main.ts` must use `await` to ensure proper feedback (like success messages) is shown only after the chunk is loaded and the export finishes.

## 🛡️ Safety & Security (Added 2026-01-31)

### 1. Restricted URL Handling

- **The Problem**: Browser extensions are strictly forbidden from injecting scripts into internal browser pages (e.g., `chrome://`, `about:`, `edge://`). Attempting to do so triggers a `Cannot access a chrome:// URL` error.
- **The Solution**: The `checkCurrentSite` method in `main.ts` now identifies restricted schemes before any detection logic runs.
- **Implementation**:
  ```typescript
  const restrictedSchemes = ['chrome:', 'about:', 'edge:', 'chrome-extension:', 'moz-extension:'];
  const isRestricted = restrictedSchemes.some(scheme => tab.url?.startsWith(scheme));
  ```
- **Result**: On restricted pages, the extension gracefully skips script-based platform detection, avoiding console errors and potential crashes.

## 🛠️ Dynamic UI Logic (Added 2026-01-31)

### 1. Version-Specific Premium Benefits

To maintain high conversion and relevance, the "Premium Benefits" list is now generated dynamically in `main.ts` via `setPremiumBenefits()`:

- **Priority Reordering**: "80 aspects of design" is hardcoded to the 2nd position for max visibility.
- **Platform-Specific "Hook"**:
  - **SQS Version**: Mentions exactly 40 SQS factors.
  - **Generic Version**: Lists counts for WP (50), Wix (45), Shopify (47), and Webflow (52).
- **Fallback Avoidance**: By using JS-driven injection, we ensure that if a version-specific count is updated (e.g., from 40 to 45), it only needs to be changed in one logic block rather than multiple HTML files.

### 2. Questions, Suggestions, Reviews Section

This section at the bottom of the popup remains visible to encourage user engagement.

- **Dynamic Content**:
  - **Benefits Link**: The word "Benefits" is wrapped in an anchor (`#uiBenefitsLinkInText`) which is dynamically assigned the same URL as the main "Click to See" button (`platformStrings.benefitsUrl`).
  - **Review Link**: The "Add Your “Success Story” Review" link (`#uiReviewLink`) is dynamically assigned a URL based on the browser (Chrome Store vs Firefox Add-ons) and product version via `platformStrings.reviewUrl`.
- **Styling**: Uses specific font-size (`0.8rem` for footer, `0.9rem` for body) and `display: block` structure to ensure clean rendering.

## Report Consistency

- See [shared-report-components.md](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/documentation-md/architecture/shared-report-components.md) for details on how we unified the UI across all exports.

## Regression Traps (DO NOT CHANGE)

- **Main Bundle Size**: Avoid adding heavy dependencies (like larger string templates or mapping objects) directly to `main.ts` or `popup/index.html`. Keep the main entry point under 100KB to preserve instant interactivity.
- **Manual Visibility Calls**: Do not add `siteInfo.style.display = 'block'` to success or error callbacks in analysis modules. This logic is centralized in `main.ts` (reset only) to prevent UI clutter.
- **Flex Order**: Ensure any new top-level UI components in `index.html` account for the `order: -1` on `#pageSelectionModal`.

---

## 🟢 Premium Status Button Logic (Fixed 2026-01-23)

The extension uses a dedicated area for checking and displaying premium status.

### Button Location

Labels and styles are managed synchronously in `main.ts` within two functions:

1. `updateUI()`: Handles the initial state when the popup opens.
2. `checkPremiumStatus()`: Manually triggered when the user clicks to verify their email.

### Activation Triggers

The text suffix and background color are determined by standard flags returned by the Worker:

- **Lifetime**: Triggered by `is_lifetime: true`.
  - **Text**: `✅ Premium Activated - Lifetime`
  - **Color**: `#44337a` (Deep Purple)
- **Yearly**: Triggered by `is_yearly: true` (and `is_lifetime: false`).
  - **Text**: `✅ Premium Activated - Yearly`
  - **Color**: `#14532d` (Deep Emerald)

### Critical Logic

The system **Always Checks Lifetime FIRST**. If a record has both flags (rare) or if the manual check returns a lifetime record, the system stops immediately to ensure the user receives their superior status benefits.
