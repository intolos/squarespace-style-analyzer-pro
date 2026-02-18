# Squarespace Color Detection - Discussion & Analysis

**Date:** 2026-02-14  
**Status:** Implementation Complete - Testing Phase  
**Related Documents:**
- [platform-background-detection.md](../architecture/platform-background-detection.md)
- [2026-02-09-color-accuracy-analysis-discussion.md](../walkthroughs/2026-02-09-color-accuracy-analysis-discussion.md)
- [2026-02-09-color-accuracy-analysis-full-chat-discussion.md](../walkthroughs/2026-02-09-color-accuracy-analysis-full-chat-discussion.md)

---

## 1. The Problem

On launchhappy.co (Squarespace), specific text elements (particularly H2) are being detected with incorrect background colors:

- **Symptom:** Report shows dark text (#120835) on BLACK background (#000000) = 1.11:1 contrast (FAIL)
- **Reality:** Dark text on WHITE background = Good contrast (should PASS)
- **What's happening:** The H2 element has a transparent background. The detector walks up the DOM but finds a black background somewhere (overlay, modal, or pseudo-element) before reaching the actual white section background.

The issue is element-specific - it works in many situations on launchhappy.co but fails for specific elements.

---

## 2. Current Squarespace Detection Order

**File:** `wxt-version/src/analyzers/backgroundDetectors/squarespaceDetector.ts`

```
1. initialBackgroundColor check (line 34-40)
   └─ Returns if not transparent

2. computed-style (line 42-45)
   └─ Check element's own computed style

3. dom-walk (line 49-52) ← THE PROBLEM
   └─ Walks up DOM, returns FIRST non-transparent found
   └─ No filtering for suspicious colors
   └─ Uses baseDetector.walkDomForBackground() with maxDepth=15

4. pseudo-before (line 56-59)
   └─ Returns immediately if found

5. pseudo-after (line 61-64)
   └─ Returns immediately if found

6. canvas (line 68-90)
   └─ ONLY for button-like elements
   └─ Uses screenshot for verification

7. indeterminate (line 93)
   └─ Returns null (with link to Contrast Checker Tool)
```

### The Problem in DOM Walking

In `baseDetector.ts` (lines 70-86):

```typescript
protected walkDomForBackground(startElement: Element): DetectionResult | null {
  let el: Element | null = startElement;
  let depth = 0;
  const maxDepth = 15;  // Stops after 15 levels

  while (el && depth < maxDepth) {
    const result = this.checkComputedStyle(el);
    if (result) {
      // RETURNS FIRST FOUND - NO FILTERING
      return result;
    }
    el = el.parentElement;
    depth++;
  }
  return null;
}
```

It returns the **first** non-transparent background it finds - whether that's black, white, or anything else.

---

## 3. Previous Decision History

From documentation dated 2026-02-09:

| Platform | Strategy | Reason |
|----------|----------|--------|
| **Squarespace** | DOM-computed (keep) | Flat architecture, predictable styling |
| **WordPress** | Canvas sampling | Builder layering causes mismatches |
| **Wix** | DOM-computed (monitor) | Self-contained elements |
| **Webflow** | DOM-computed | Clean semantic DOM |
| **Shopify** | Canvas sampling | Some layering from apps |
| **Generic** | Canvas sampling | Safety for unknowns |

Key quote: "Squarespace's design system is intentionally flat. When you style a section background, the section element itself renders that color."

### WordPress Solution (for reference)

WordPress uses suspicious color filtering:

```typescript
const SUSPICIOUS_COLORS = new Set(['#000000', '#FFFFFF', '#000', '#FFF', '#00000000']);

// In detect():
const domResult = this.walkDomForBackground(element);
if (domResult) {
  const domHex = this.rgbToHex(domResult.color);
  if (domHex && !SUSPICIOUS_COLORS.has(domHex)) {  // FILTER
    return domResult;
  }
  // Otherwise continue searching...
}
```

---

## 4. The Challenge: Black/White Are Common Legitimate Backgrounds

Simply filtering #000000/#FFFFFF would break very common designs:
- White background + dark text
- Black background + white text
- Dark sections with light text
- Light sections with dark text

**This is why the problem is so difficult.**

---

## 5. Proposed Solution: Canvas Verification (Not Replacement)

The solution is NOT to skip black/white - instead, verify with canvas when suspicious:

### sqsProposed (Combined Approach)

```
1. CSS class rules
   └─ Check Squarespace background classes first
   └─ Uses baseDetector.checkCssRules()

2. computed-style
   └─ On element itself

3. DOM walk (no filtering)
   └─ Returns first non-transparent found

4. IF result is #000000 or #FFFFFF:
   └─ Run canvas sampling from EDGES/CORNERS (not center!)
   └─ 4x4 grid skips center, uses edges
   └─ Calculate % of pixels matching canvas dominant color
   └─ If canvas dominant differs significantly from DOM AND canvas has high consistency → use canvas
   └─ Otherwise keep DOM result

5. pseudo-before/after
   └─ Only for non-text elements

6. canvas (buttons)
   └─ Current behavior

7. indeterminate fallback
   └─ Returns null (with link to Contrast Checker Tool)
```

### Why Edge/Corner Sampling?

Center point sampling for text elements would sample the TEXT color, not the background. The existing canvas sampling in the test harness uses a grid pattern that:
- Samples 4x4 grid (16 points) or 8x8 grid (64 points)
- Skips center (i=0 and i=gridSize are skipped)
- Uses the **corners** and **edges** which are more likely to be background

This is already implemented in `colorDetectionTestHarness.ts` function `sampleCanvasColors()`.

---

## 6. Test Harness Implementation (COMPLETED)

Two new methods were added to the test harness (`colorDetectionTestHarness.ts`):

### Method 1: sqsCurrent
The **exact current** Squarespace detection (unchanged detection logic) PLUS canvas verification when suspicious:
1. computed-style (on element)
2. initialBackgroundColor check (via getStyleDefinition)
3. dom-walk (up 15 levels)
4. **IF result is #000000 or #FFFFFF → canvas verify (edges/corners)**
5. pseudo-before
6. pseudo-after
7. canvas (buttons only)
8. **indeterminate fallback** (not white - was changed)

### Method 2: sqsProposed
The **new approach** with CSS class priority and canvas verification:
1. **CSS class rules** (NEW - check first for background*, bg*, backdrop classes)
2. computed-style
3. DOM walk (no filtering)
4. **IF result is #000000 or #FFFFFF → canvas verify (edges/corners)** (NEW)
5. pseudo-before/after
6. canvas (buttons)
7. **indeterminate fallback**

### Edge/Corner Canvas Sampling Implementation

A new function `canvasVerifyWithEdges()` was implemented:
- Samples from all four edges (top, bottom, left, right) at 15% margin
- NOT from center (center would sample text, not background)
- Uses 12 sample points total (3 per edge)
- Calculates dominant color and consistency percentage
- Only overrides DOM if: canvas differs AND consistency >= 70%

```typescript
async function canvasVerifyWithEdges(
  element: Element,
  screenshot: string | null,
  domColor: string
): Promise<{ canvasColor: string | null; confidence: 'high' | 'medium' | 'low'; details: string }>
```

### Suspicious Color Set

```typescript
const SUSPICIOUS_COLORS = new Set(['#000000', '#FFFFFF', '#000', '#FFF']);
```

Only triggers canvas verification when DOM returns one of these colors.

---

## 7. Changes Implemented

### 7.1 Indeterminate Message Update

**File:** `wxt-version/src/analyzers/backgroundDetectors/baseDetector.ts`

Changed the indeterminate message to link to the Contrast Checker Tool:

```typescript
protected getIndeterminateResult(): DetectionResult {
  return {
    color: null,
    details: 'Indeterminate: Complex background layers. <a href="javascript:void(0)" onclick="showContrastChecker(); return false;">Open Contrast Checker Tool</a> to verify manually.',
    method: 'indeterminate',
  };
}
```

### 7.2 Squarespace Fallback Update

**File:** `wxt-version/src/analyzers/backgroundDetectors/squarespaceDetector.ts`

Changed from white fallback to indeterminate:

```typescript
// Before:
return {
  color: 'rgb(255, 255, 255)',
  details: 'No background found, using white fallback',
  method: 'computed-style',
};

// After:
return this.getIndeterminateResult();
```

All platforms now use indeterminate as fallback:
- Squarespace: Uses `getIndeterminateResult()` ✓
- WordPress: Already uses `getIndeterminateResult()` ✓
- Generic: Already uses `getIndeterminateResult()` ✓

### 7.3 Test Harness Updates

**File:** `wxt-version/src/analyzers/colorDetectionTestHarness.ts`

- Added `sqsCurrent` and `sqsProposed` to TestResult.methods interface
- Implemented `sqsCurrentMethod()` function (~100 lines)
- Implemented `sqsProposedMethod()` function (~120 lines)
- Implemented helper functions:
  - `checkCssRules()` - CSS class detection
  - `walkDomForBackground()` - DOM walking utility
  - `canvasVerifyWithEdges()` - Edge-based canvas sampling
- Updated `runTestOnElement()` to call both new methods
- Updated `createTestOverlay()` UI with green-highlighted rows for SQS methods
- Updated CSV export with new columns for both methods
- Updated `getTestStats()` with accuracy calculations for both methods

---

## 8. Next Steps

### Completed ✓
1. ✅ Add sqsCurrent and sqsProposed methods to test harness
2. ✅ Change Squarespace fallback to indeterminate
3. ✅ Update indeterminate message to link to Contrast Checker Tool → Color Checker Tool
4. ✅ Update architecture documentation
5. ✅ Integrate sqsProposedMethod into production squarespaceDetector.ts (2026-02-15)
6. ✅ Section CSS variable detection now works for both manual AND automated scanning

### Remaining
1. Test on additional Squarespace sites
2. Compare results with manual verification on production scans

---

## 9. Key Learnings from Previous Work

From 2026-02-09 analysis:

1. **Squarespace architecture is intentionally flat** - backgrounds are on actual elements, not pseudo-elements
2. **DOM-computed works for most cases** - canvas is overkill for Squarespace
3. **The problem is element-specific** - works in many situations, fails for specific elements
4. **Simple solutions don't work** - filtering black/white breaks legitimate designs
5. **Canvas should be verification, not replacement** - only override DOM when strong evidence differs
6. **Edge sampling is critical** - center point samples text, not background

---

## 10. How to Test

1. Load the extension in dev mode: `cd wxt-version && npm run dev:sqs`
2. Navigate to launchhappy.co
3. Open browser console
4. Run: `activateColorTestMode()`
5. Click on a problematic element (like an H2 with wrong contrast)
6. Compare sqsCurrent vs sqsProposed results with manual verification
7. Run `getTestStats()` to see accuracy metrics
8. Run `exportTestResults()` to get CSV with all method comparisons

---

**Document Status:** Implementation Complete - Ready for Testing
