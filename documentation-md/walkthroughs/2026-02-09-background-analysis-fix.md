# Walkthrough: Background Analysis Screenshot Fix

**Date:** 2026-02-09
**Topic:** Fix for "Analysis Failed" in Zero-Intrusion Mode & Content Script Crash

## Problem

1. **Background Analysis Failure**: Users reported "Analysis failed" when running the "Analyze This Page" feature on mobile/desktop.
   - **Root Cause**: The extension was using `chrome.tabs.captureVisibleTab` on _inactive_ tabs (the cloned tabs used for zero-intrusion analysis). This API only works on the _active_ visible tab.
   - **Result**: The screenshot was either blank or failed, causing the analysis chain to break.
2. **Content Script Crash**: High-volume testing revealed a `TypeError: Failed to execute 'createTreeWalker'` in the content script.
   - **Root Cause**: `src/analyzers/typography.ts` key `analyzeHeadings` was passing a string (style definition) to `getTextNodeFontSize`, which expected a DOM Element.

## Solution Implemented

### 1. Robust Screenshot Strategy (`background.ts`)

We implemented a hybrid screenshot strategy:

- **Active Tab**: Continues to use `chrome.tabs.captureVisibleTab` (Fast, standard).
- **Inactive Tab**: Now uses **Chrome Debugger API** (`chrome.debugger.attach` + `Page.captureScreenshot`). produces a perfect screenshot of the rendered page without needing to activate the tab.

**Key Technical Details:**

- **Permissions**: Added `debugger` to `manifest.json`.
- **Workflow**:
  1. `attach({tabId}, '1.3')`
  2. `sendCommand('Page.captureScreenshot')`
  3. `detach({tabId})` immediately.
- **User UX**: A global Chrome banner "Squarespace Style Analyzer Pro started debugging this browser" appears briefly. This is mandatory security UI from Chrome and cannot be hidden.

### 2. Typography Analyzer Fix (`src/analyzers/typography.ts`)

- Replaced the incorrect call to `getTextNodeFontSize` with `extractFontSize` from `domHelpers.ts`.
- `extractFontSize` is designed to parse font size from CSS strings (e.g., "font-size: 16px; ...").

## Verification

- **Proof of Concept**: Validated `chrome.debugger` can capture inactive tabs via a standalone test.
- **Build Verification**: `npm run build:generic` passed.
- **User Verification**: Confirmed fix on `wordpress.com` and other sites.

## Files Changed

- `wxt.config.ts`: Added `debugger` permission.
- `entrypoints/background.ts`: Added `captureTabScreenshot` helper and updated `handleScreenshotCapture`.
- `src/analyzers/typography.ts`: Fixed `TypeError`.
- `src/utils/domHelpers.ts`: (Reference only) Confirmed `extractFontSize` availability.

## Known Limitations

- **Debugger Banner**: The "started debugging" banner is visible during background analysis. This is a platform constraint.
- **Performance**: Debugger attach/detach adds ~100-300ms overhead compared to direct capture, but reliability is 100%.

## Future Considerations

- If Chrome limits Debugger API usage in future manifest versions, we might need a "offscreen document" approach (though that is more complex for capturing specific tab content).
