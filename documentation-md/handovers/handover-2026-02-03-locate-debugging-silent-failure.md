# Handover: Locate Stabilization & Fallout

**Date:** 2026-02-03
**Status:** WORKING (Standard) / FAILED (Hidden/Carousel)

## 1. What Works ("Nuclear Stabilization")

We successfully stabilized the "Standard" locate function by preventing the extension from "flashing and dying".

- **Hydration Bypass:** 2000ms delay prevents SPA wipes.
- **Safety Spinner:** Provides feedback during delay.
- **No Side-Effects:** Disabled URL cleanup and auto-removal listeners.
- **Result:** Red Box is stable on normal, visible elements.

## 2. What FAILED (Hidden/Carousel Items)

We attempted a **"Parent Fallback"** strategy to handle hidden items (like carousel images or lazy-loaded footer buttons) by highlighting their nearest visible container.

**This has FAILED in testing:**

1.  **Shopify Carousel:** The fallback logic did not find a visible parent, or the highlighting failed to appear.
2.  **WordPress.com (Static Footer Button):** The fallback logic traversed all the way up the DOM tree and **highlighted the ENTIRE web page** (likely the `<body>` or `<html>` tag).
    - _Diagnosis:_ This implies that every ancestor of the button (the `<a>`, the `<div>` wrapper, the `<footer>`) reported as either "hidden" or "too small" (<10px width) to our visibility checker, until it hit the root.

## 3. Files Modified

- `wxt-version/src/utils/inspector.ts` (Current Logic: Fallback enabled)
- `wxt-version/src/utils/domHelpers.ts`

## 4. Next Steps / Recommendations

The current "Parent Fallback" is too aggressive or our `isVisible` check is flawed for certain layouts (e.g., `inline-block` elements or specific CSS structures on WP).

**Immediate Action Required:**

- **Debug `isVisible`**: Why did the WP footer container report as hidden?
- **Cap the Fallback**: Do not allow traversal to `body` or `html`. Stop at 3 levels or a specific container type.

---

## 5. CRITICAL: Debugging Methodology

> [!CAUTION]
> **NO MORE "BOUNCING BALL" FIXES.**
> Over 10 hours have been wasted on surface-level fixes that loop back and forth without addressing root causes. This stops now.

### The Contract

1.  **Deep Analysis First**: Before ANY code change, we must understand HOW the target sites (wordpress.com, shopify.com) actually structure their DOM. No guessing. Real inspection.

2.  **Test Sites**:
    - `https://wordpress.com` (single homepage) — Footer button / body highlight issue
    - `https://shopify.com` (single homepage) — Carousel image locate failure

3.  **Incremental Steps ONLY**: Every fix must be:
    - **One small, isolated change** at a time.
    - **Testable immediately** after applying.
    - **Reversible** — if it breaks something that was working, we roll back instantly.

4.  **No Assumptions**: If a fix "should work" but doesn't, we pause and investigate _why_, not try another guess.

5.  **Document Every Step**: Each attempted fix and its result (PASS/FAIL/PARTIAL) will be logged here before moving to the next.

### Fix Log

| #   | Date | Change Description                 | Result | Rollback? |
| --- | ---- | ---------------------------------- | ------ | --------- |
| -   | -    | _(awaiting first incremental fix)_ | -      | -         |

---

## 6. Deep DOM Analysis (2026-02-04)

### WordPress.com Footer

**Element Analyzed:** "Terms of Service" link in footer

**Ancestor Chain:**

1. `<a>` (`.lp-footer-stack__content__item.lp-link-invisible`) — 153.6px × 36px, fully visible
2. `<li>` (`.lp-block.x-nav-footer--tos`)
3. `<ul>` (`.lp-footer-stack__content`)
4. `<details>` (`.lp-footer-stack`) — **Uses `open` attribute on desktop**
5. `<div>` (`.lp-grid__column-span-4`)
6. `<div>` (`.lp-grid.lp-grid--type-footer`) — **Uses `display: grid`**
7. `<div>` (`.lp-wrapper`)
8. `<div>` (`.lp-section__content`) — `z-index: 9`, `position: relative`
9. `<section>` (`.wpcom-global-nav-footer`) — `position: relative`
10. `<main>` (`.lp-root`)
11. `<body>` (`.antigravity-scroll-lock`) — **`overflow: hidden !important`**
12. `<html>`

**🔴 ROOT CAUSE IDENTIFIED:**

> When scrolled to bottom, the footer `<section>` has `rect.top = -44.6px` (partially above viewport).
> If `isVisible` uses a strict `rect.top >= 0` check, the entire footer section and all ancestors get flagged as "hidden," causing fallback to climb to `<body>`.

**Other Observations:**

- `.lp-link-invisible` does NOT hide elements — it just removes text decoration
- `.lp-hidden` class uses `clip: rect(0,0,0,0)` pattern for screen-reader-only elements (1×1px)
- `<details>` element is `open` on desktop but could confuse visibility logic

---

### Shopify.com Carousel

**Element Analyzed:** Glossier brand card image

**Image Attributes:**

- `alt`: "Image of Glossier website selling beauty products"
- `src`: Generic hashed filename (`c65bc0c2daf1df2c109d1f9c14444a57.webp`)
- `loading`: "eager" (not lazy-loaded)
- Dimensions: ~563px × 432px

**Ancestor Chain:**

1. `<img>` (The target image)
2. `<div>` (Card wrapper) — `overflow: hidden`, `rounded-lg`
3. `<div>` (`#ab-section-content-0`) — `overflow-x-scroll`
4. `<div>` (Carousel mover) — **`transform: translate3d(-6040px, 0, 0)`**, `role="tabpanel"`
5. `<div>` (Outer container) — `xl:overflow-hidden` (the clipping window)
6. `<section>` — `overflow: hidden`

**🔴 ROOT CAUSE IDENTIFIED:**

> Inactive carousel slides are NOT hidden via `display: none` or `visibility: hidden`.
> They are "hidden" by being **transformed off-screen** (`translate3d`) and **clipped** by parent `overflow: hidden`.
>
> When `isVisible` checks `getBoundingClientRect()`:
>
> - `rect.left` is negative (off-screen left) or > viewport width (off-screen right)
> - This triggers Parent Fallback, which climbs to `<section>` or `<body>`

**Why "Locate by Filename" Fails:**

- Generic hashed filenames mean the only way to match is by `src` URL
- The image exists in DOM but is positioned off-screen via CSS transform
- Our visibility check rejects it, fallback climbs too high

---

## 7. Conclusions

| Site              | Failure Mode   | Root Cause                                                                                                                  |
| ----------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **WordPress.com** | Body highlight | Footer section has negative `rect.top` when scrolled; strict viewport check rejects valid visible elements                  |
| **Shopify.com**   | No highlight   | Carousel images hidden via `transform: translate3d()` + `overflow: hidden`; viewport rect check fails for off-screen slides |

**Key Insight:** Both failures stem from our `isVisible` function being too strict about viewport boundaries.

**Next Step:** Review the current `isVisible` implementation in `inspector.ts` or `domHelpers.ts` to understand exactly what checks are causing these false negatives.

---

## 8. Code Analysis: `isVisible` and Parent Fallback (2026-02-04)

### Current `isVisible` Implementation (Lines 257-267)

```typescript
const isVisible = (element: Element): boolean => {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    parseFloat(style.opacity) > 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
};
```

**What it checks:**

1. `display !== 'none'` ✅ Good
2. `visibility !== 'hidden'` ✅ Good
3. `opacity > 0` ✅ Good
4. `rect.width > 0` ✅ Good
5. `rect.height > 0` ✅ Good

**What it does NOT check:**

- ❌ Does NOT check viewport position (`rect.top`, `rect.left`)
- ❌ Does NOT check `overflow: hidden` clipping
- ❌ Does NOT check CSS `transform` affecting position

**Conclusion:** The `isVisible` check itself is **NOT the problem** — it correctly ignores off-screen position.

---

### Parent Fallback Logic (Lines 451-488)

```typescript
// Case B: Element hidden - Attempt PARENT FALLBACK
let parent = el!.parentElement;
let visibleParent: Element | null = null;
const maxLevels = 10;
let level = 0;

while (parent && level < maxLevels) {
  // Check if parent is visible AND has actual dimensions
  if (isVisible(parent) && parent.getBoundingClientRect().width > 10) {
    visibleParent = parent;
    break;
  }
  parent = parent.parentElement;
  level++;
}
```

**What this does:**

1. If `isVisible(el)` returns `false`, start climbing the DOM tree
2. For each parent, check `isVisible(parent)` AND `width > 10`
3. Stop at first match or after 10 levels

---

### 🔴 Why WordPress.com Fails

**Test case:** Footer "Terms of Service" link

**Failure path:**

1. `isVisible(<a>)` → Returns `true` (153.6px × 36px, fully visible)
2. **Should NOT enter fallback at all!**

**Wait — this means the WP issue is NOT `isVisible` failing.** Let me re-check...

Actually, looking at the DOM analysis, the element IS visible by our `isVisible` check. So why does it highlight `<body>`?

**New hypothesis:** The issue may be in `getVisibleBoundingRect()` or the scroll logic, not `isVisible`.

But based on user's report ("highlighted the ENTIRE web page"), the fallback is being triggered. Let me trace backwards...

**Alternative hypothesis:** The element the user is trying to locate is NOT the "Terms of Service" link — it might be a **different, actually hidden element** (like a button that has `display: none` or zero dimensions in that viewport state).

---

### 🔴 Why Shopify.com Carousel Fails

**Test case:** Glossier brand card image (off-screen in carousel)

**Failure path:**

1. `isVisible(<img>)`:
   - `display: block` ✅
   - `visibility: visible` ✅
   - `opacity: 1` ✅
   - `rect.width > 0` ✅ (563px)
   - `rect.height > 0` ✅ (432px)
2. **Returns `true`!**

**So `isVisible` should succeed, and we should NOT enter fallback.**

But the image is **transformed off-screen** by `translate3d(-6040px, 0, 0)`. The `getBoundingClientRect()` returns:

- `rect.left = -6040px` (WAY off-screen to the left)

**The element is "visible" by CSS, but its bounding rect is off-screen.**

Our `isVisible` check does NOT fail on this — it will return `true` because it doesn't check viewport position.

**So the highlight SHOULD work**, but the highlight box would be positioned at `-6040px` left — completely invisible to the user!

---

## 9. REVISED Root Cause Analysis

| Site              | Actual Failure Mode  | Root Cause                                                                                                                                                             |
| ----------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WordPress.com** | Body highlight       | **UNKNOWN** — Need to identify WHICH element the user is trying to locate. The visible footer links pass `isVisible`.                                                  |
| **Shopify.com**   | No visible highlight | `isVisible` passes ✅, but `getBoundingClientRect()` returns off-screen coordinates. Highlight box is drawn at `left: -6040px`. **Highlight exists but is invisible!** |

---

## 10. Next Steps (Analysis Only)

1. **WordPress.com:** Reproduce the exact user action. What specific element are they clicking "Locate" on in the report? We need to test that exact selector.

2. **Shopify.com Carousel:** The fix is NOT to change `isVisible`. The fix is to **detect when an element has legitimate dimensions but is positioned off-screen**, and either:
   - (a) Scroll the carousel to bring it into view, OR
   - (b) Find the nearest visible parent that IS on-screen

3. **Fallback logic needs a new check:** Before accepting a parent, verify its bounding rect is actually within the viewport.

---

## 11. 2026-02-04 Debugging Session Summary

### Tested Elements

- **WordPress.com:** Apple App Store button and Google Play button in footer (both flagged for missing alt text)
- **Reference:** "English" button on same footer line — this DOES work

### Attempted Fixes

| #   | Change                                                                        | Result                                            | Rolled Back?       |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------- | ------------------ |
| 1   | Added 600ms delay after `scrollIntoView` before positioning highlight         | ❌ No effect                                      | ✅ Yes             |
| 2   | Removed `isVisible` gate entirely — always call `executeHighlight()` directly | ❌ No effect — page loads at top, nothing happens | No (current state) |

### Key Observation

The "English" button locate **WORKS**, but App Store/Google Play buttons **FAIL**.

- All three buttons are in the same footer row
- "English" is a `<button>` element
- App Store/Google Play are `<img>` elements inside `<a>` tags

### Current Hypothesis

The problem is **NOT** the `isVisible` check (we removed it and it still fails).

The problem is likely **earlier in the flow**:

1. The selector may not be finding the element at all
2. The element may have 0×0 dimensions causing `getVisibleBoundingRect()` to fail
3. The hash/query param with the selector may not be read correctly

### Symptoms

- Page opens at top
- Spinner shows briefly, then stops
- No highlight appears, no error toast appears
- Console logs would help identify where flow stops

### Next Steps When Resuming

1. Check browser console for SSA logs when locate fails
2. Verify the exact selector being used for App Store image
3. Compare selector/element structure between working ("English") and failing (App Store) cases
4. The `isVisible` check removal is still in place — may want to restore full logic later
