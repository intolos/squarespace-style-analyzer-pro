# Popup UI Architecture

## Overview

The extension popup provides the primary interface for initiating analyses and viewing results. It is designed to be lean, with a "Results-First" philosophy after an analysis is completed.

## Key Components

- `index.html`: Defines the structural layout using CSS Flexbox.
- `style.css`: Manages visual styling, including dark mode themes and component ordering.
- `main.ts`: Orchestrates UI state changes based on premium status and analysis results.
- `DomainAnalysisUI.ts`: Handles the multi-page analysis flow and file selection modal.
- `SinglePageAnalysisUI.ts`: Handles the active tab analysis flow.

## Operational Logic

### Workflow: Analyze Entire Domain

1.  User clicks **Analyze Entire Domain**.
2.  `domainAnalysisUI.analyzeDomain()` is triggered.
3.  **File Selection Modal** (`#pageSelectionModal`) is prepended to the top of `#mainInterface` (via JS `insertBefore`) and visually prioritized (via `order: -1`).
4.  **Current Site Info** (`#siteInfo`) and **Usage Counter** (`#statusSection`) are physically removed from the DOM to focus on file selection.
5.  After selection, analysis begins.

### Workflow: Results View

1.  Once results are loaded (either from a fresh analysis or storage), `checkCurrentSite` in `main.ts` detects `accumulatedResults`.
2.  `#siteInfo` is hidden.
3.  `#resultsSection` is displayed.

## Critical Implementation Details

- **Site Info Visibility**: `#siteInfo` is hidden whenever analysis results exist or while an analysis is in progress. It is **only** restored when the user clicks **Reset Extension**.
- **Usage Counter Protection**: For premium users, `#statusSection` is hidden by default in HTML, removed from the DOM on popup load, and protected by a `MutationObserver` ("Nuclear Option") in `main.ts` to prevent accidental reappearance.
- **Modal Positioning**: The File Selection modal is forcibly prepended to the top of its parent container using `mainInterface.insertBefore(modal, mainInterface.firstChild)`.
- **Contrast**: All buttons use dark backgrounds specifically chosen to maintain high text contrast (`#44337a` for Lifetime Premium, `#22543d` for activation, etc.).
- **Modal Title Padding**: Custom prompts (alerts/confirms) use `#customModalTitle` with a large `padding-top` (45px) and `display: block` to ensure readability.

## Regression Traps (DO NOT CHANGE)

- **Manual Visibility Calls**: Do not add `siteInfo.style.display = 'block'` to success or error callbacks in analysis modules. This logic is centralized in `main.ts` (reset only) to prevent UI clutter.
- **Flex Order**: Ensure any new top-level UI components in `index.html` account for the `order: -1` on `#pageSelectionModal`.
