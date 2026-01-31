# Font Size Capture for Accessibility Analysis

**Date:** 2026-01-31  
**Status:** Active Investigation → Solution Design

---

## Overview

This document captures the analysis and discussion regarding how font sizes are captured during accessibility/contrast analysis. The core issue: the accessibility report sometimes shows "0px" or "Unknown" for font size, which is logically impossible for visible text.

---

## The Problem Statement

When the Brand Style Guide Colors Report displays a contrast accessibility issue, the "Text Size" field sometimes shows `0px` or `Unknown`. This is incorrect because:

1. If an issue is detected, the text must be visible.
2. If the text is visible, the browser must know its font size.
3. Therefore, the font size is inherently knowable at the moment of detection.

### Real-World Example

- **Page:** `https://wordpress.com/`
- **Element:** `<p class="color-gray-40">` containing "Reach your audience on your terms..."
- **Contrast Ratio:** 3.91:1 (correctly detected)
- **WCAG Results:** AA Normal: Fail, AAA Normal: Fail, AA Large: Pass, AAA Large: Fail (correct)
- **Font Size Displayed:** Unknown ✗

---

## Current Code Flow Analysis

The `trackContrastPair` function in `colors.ts` (lines 390-509) follows this sequence:

### Step 1: Element Received

The function receives a text-bearing element (heading, paragraph, button, link).

### Step 2: Text Detection (Lines 409-427)

Checks if the element has direct text content by looking for TEXT_NODE children.

```typescript
for (let i = 0; i < element.childNodes.length; i++) {
  const node = element.childNodes[i];
  if (node.nodeType === 3 && node.textContent?.trim()?.length! > 0) {
    hasDirectText = true;
    break;
  }
}
```

**Result:** "Yes, this element has text content." ✓

### Step 3: Color Extraction (Lines 429-438)

Reads text color and effective background color.
**Result:** Colors correctly extracted. ✓

### Step 4: Contrast Calculation (Line 455)

```typescript
const ratio = calculateContrastRatio(textHex, bgHex);
```

**Result:** Ratio correctly calculated. ✓

### Step 5: Font Size Read — **THE PROBLEM POINT** (Lines 458-470)

```typescript
const computed = window.getComputedStyle(element);
let fontSize = parseFloat(computed.fontSize) || 0;
let fontSizeString = computed.fontSize || '';
```

**Result:** For some elements, `computed.fontSize` returns `0px` or empty. ✗

### Step 6: WCAG Level Determination (Lines 472-474)

```typescript
const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
const wcagLevel = getWCAGLevel(ratio, isLargeText);
```

Uses the potentially incorrect font size to determine large/normal text thresholds.

### Step 7: Issue Storage (Lines 486-508)

The issue is stored with `fontSize: 0` and incorrect `fontSizeString`.

**Additional Bug:** Line 501 re-reads `computed.fontSize` instead of using the corrected local variable:

```typescript
fontSizeString: computed.fontSize || '',  // ← Re-reads original, ignores fallback
```

---

## Key Questions & Answers

### Q: Does the process first detect "text" but without a font size?

**A:** Yes. Step 2 detects text exists without touching font size.

### Q: Then it analyzes colors and computes WCAG but still doesn't know the font size?

**A:** Exactly correct. Steps 3-4 compute the contrast ratio before reading font size.

### Q: Then it tries to calculate the font size?

**A:** Yes. Step 5 reads font size after contrast is calculated.

### Q: Or does it actually detect the font size when it detects "text"?

**A:** No. Text detection and font size reading are separate, sequential steps.

---

## Root Cause Analysis

### Why Would `getComputedStyle(element).fontSize` Return 0px?

The browser **always** knows the font size of rendered text. The CSS cascade always produces a computed value. Therefore, getting 0px means we made a mistake.

#### Possible Causes:

1. **Asking the Wrong Element**

   ```html
   <div style="font-size: 0;">
     <!-- We query THIS -->
     <span style="font-size: 16px;">Visible text</span>
     <!-- Text is HERE -->
   </div>
   ```

2. **Timing Issues**
   Styles haven't fully applied (rare in content scripts after page load).

3. **Bug in Code**
   Line 501 re-reads `computed.fontSize` instead of using the corrected variable.

4. **CSS Quirks**
   Container has `font-size: 0` (old whitespace collapse technique) while children have explicit sizes.

---

## Fundamental Truths

| Statement                                        | Truth                                 |
| ------------------------------------------------ | ------------------------------------- |
| Every visible text has a font size               | **Yes** – required for rendering      |
| The browser always knows the font size           | **Yes** – via computed styles         |
| `getComputedStyle()` returns the rendering value | **Yes** – source of truth             |
| Font size can ever be truly unknown              | **No** – if text renders, size exists |

---

## The Solution Principle

**We should read the font size from the element that directly contains the text node**, not from the element we started our analysis with.

### Current (Flawed) Approach:

1. Receive element (e.g., `<p>`)
2. Read `getComputedStyle(element).fontSize`
3. Hope it's correct

### Correct Approach:

1. Receive element (e.g., `<p>`)
2. Find the first text node with content inside the element
3. Get the parent element of that text node
4. Read `getComputedStyle(textNodeParent).fontSize`
5. Guaranteed to be correct

### Why This Works:

- If there's a text node, there's a parent element.
- The browser rendered that text with a font size.
- `getComputedStyle` on that parent gives us exactly what the browser used.

---

## Platform Independence

This solution is platform-agnostic because it relies on DOM fundamentals:

- Works for Squarespace
- Works for WordPress
- Works for any HTML-based platform
- No platform-specific CSS pattern matching required

---

## Fallback Display Logic (Font Size Unknown)

When font size cannot be determined despite the robust text-node approach, the report displays an intelligent fallback that provides maximum clarity to the user.

### Display Format

```
Text Size: ⚠️ Could not be determined due to website coding.

AA Normal:  Fail (requires ≥4.5:1; your ratio: 3.91:1)
AAA Normal: Fail (requires ≥7.0:1; your ratio: 3.91:1)
AA Large:   Pass if text qualifies as "large" (≥18px or ≥14px bold) — verify manually
AAA Large:  Fail regardless of size (requires ≥4.5:1; your ratio: 3.91:1)
```

### Smart Logic

The fallback display applies intelligence to each line:

| Standard   | Threshold | Logic                                                                |
| ---------- | --------- | -------------------------------------------------------------------- |
| AA Normal  | ≥ 4.5:1   | Determinable from ratio alone (applies to all text)                  |
| AAA Normal | ≥ 7.0:1   | Determinable from ratio alone (applies to all text)                  |
| AA Large   | ≥ 3.0:1   | If ratio < 3.0 → "Fail regardless of size"; else → "verify manually" |
| AAA Large  | ≥ 4.5:1   | If ratio < 4.5 → "Fail regardless of size"; else → "verify manually" |

### Key Phrases

- **"Fail regardless of size"**: Used when the ratio fails even the lower "large text" threshold
- **"verify manually"**: Used only when the ratio passes the large-text threshold but we need to confirm the text qualifies as "large"

---

## Technical Implementation Details (v2 - Robust Fixes)

### 1. Robust Font Size Capture (`getTextNodeFontSize`)

To resolve the container query issue, a new utility function `getTextNodeFontSize(element)` was implemented in `domHelpers.ts`.

**Logic:**

1.  **TreeWalker:** Uses `document.createTreeWalker` to find the first _text node_ with actual content within the target element.
2.  **Parent Computed Style:** Gets `window.getComputedStyle` from the text node's _direct parent_.
3.  **Undetermined Flag:** If the size is still 0px (unlikely for visible text), it returns `fontSizeUndetermined: true`.

### 2. Centralized False Positive Filtering (Resolved 2026-01-31)

To eliminate persistent false positives (typing cursors, button wrappers, gradient backgrounds) and remove duplication, strict filters are now applied centrally via `src/utils/issueFilters.ts`.

**Filters Applied:**

- **Typing Cursors:** `/\|\s*$/` regex to catch "Hello |" animations.
- **Button Wrappers:** Ignoring `wp-block-button` containers.
- **Gradient Backgrounds:** Skipping contrast analysis if `linear-gradient` or `background-image` is detected on the element or ancestors.

> [!NOTE]
> **Update:** The previous "Bandaid Fix" (duplicated logic) has been replaced by the `issueFilters.ts` utility. See `documentation-md/architecture/issue-filters.md` for full details.

### 3. Metadata Enhancement

Updated `domHelpers.ts` to improve "Section" and "Block" labeling for generic sites:

- **Prioritization:** Checks for specific classes (`wp-block-group`, `hero`, etc.) BEFORE generic tags.
- **Fallback:** Appends the first meaningful class name to "Section" if no other label is found (e.g., "Section (content-wrapper)").

### 4. Fallback Display Logic

The accessibility report template (`accessibility.ts`) was updated to handle the `fontSizeUndetermined` flag:

- **Text Size:** Displays "⚠️ Could not be determined" in orange.
- **Status Lines:** Smart logic hides "Unknown" errors and instead shows "Fail (verify manually)" if the ratio is in a borderline range (3.0 - 4.5).

---

## Implementation Status

- [x] Design robust `getTextNodeFontSize()` function
- [x] Design fallback display logic
- [ ] Implement `getTextNodeFontSize()` in `domHelpers.ts`
- [ ] Update `trackContrastPair` in `colors.ts`
- [ ] Update accessibility report template
- [ ] Test across multiple platforms

---

## Related Files

| File                                                                                                                                                                                                               | Purpose                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| [colors.ts](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/src/analyzers/colors.ts)                                                      | Contrast analysis and font size capture |
| [domHelpers.ts](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/src/utils/domHelpers.ts)                                                  | New `getTextNodeFontSize()` function    |
| [accessibility.ts](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/src/export/styleGuideColorsReport/templates/sections/accessibility.ts) | Report template with fallback display   |

---

## Future Enhancement: Email Alerts

When font size cannot be determined, an email alert should be sent for debugging. This is documented separately in [to-do-email-sending.md](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/documentation-md/task-lists/to-do-email-sending.md).
