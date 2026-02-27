# Accessibility False Positive Analysis: launchhappy.co

**Date**: 2026-02-27
**Issue**: Colors report shows false positive contrast failures — "red text on black background" for elements that are actually dark text on a light lavender background.

---

## The Bug (Summary)

The report claims `Text: #120835 on Background: #000000` (ratio 1.11:1) for the H2 heading "Whatever you need. Solved." on launchhappy.co. In reality, the text is dark navy (`#120835`) on a **light lavender** (`~#F8F5FF`) section background — a perfectly readable combination.

**The background color is being detected as `#000000` (black) instead of `~#F8F5FF` (lavender).**

---

## Root Cause: Two-Bug Chain

The false positive is caused by **two bugs working together** in the detection pipeline.

### Bug 1: Squarespace Detector Short-Circuits on `rgba(0, 0, 0, 0)`

In [squarespaceDetector.ts](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/src/analyzers/backgroundDetectors/squarespaceDetector.ts#L39-L45):

```typescript
// Line 39-45
if (initialBackgroundColor && initialBackgroundColor !== "transparent") {
  return {
    color: initialBackgroundColor,
    details: `Initial background: ${initialBackgroundColor}`,
    method: "computed-style",
  };
}
```

This guard checks `!== 'transparent'` as a **literal string comparison**. But `computed.backgroundColor` on text elements typically returns `rgba(0, 0, 0, 0)`, NOT the string `'transparent'`. The condition passes, and the detector **immediately returns the transparent black value** without ever reaching the CSS variable detection (`--siteBackgroundColor`) that would find the actual lavender section background.

> [!CAUTION]
> The `isTransparentColor()` utility in `colorUtils.ts` correctly handles both `'transparent'` and `'rgba(0, 0, 0, 0)'`, but the Squarespace detector **does not use it** — it uses a raw string comparison instead.

### Bug 2: `rgbToHex()` Silently Drops Alpha Channel

In [colorUtils.ts](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/src/utils/colorUtils.ts#L54-L65):

```typescript
// Line 59 — regex captures R, G, B but discards alpha
const rgbMatch = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
```

`rgba(0, 0, 0, 0)` → `#000000`. The fully-transparent color is converted to opaque black.

### The Chain

```
H2 element "Whatever you need. Solved."
    ↓
computed.backgroundColor = "rgba(0, 0, 0, 0)"  ← transparent (no bg set)
    ↓
trackContrastPair() passes this as initialBackgroundColor
    ↓
SquarespaceDetector.detect():
  "rgba(0, 0, 0, 0)" !== 'transparent' → TRUE → returns immediately
  NEVER checks: DOM parents, --siteBackgroundColor, CSS rules
    ↓
rgbToHex("rgba(0, 0, 0, 0)") → "#000000"  ← alpha silently dropped
    ↓
calculateContrastRatio("#120835", "#000000") → 1.11:1 → FAIL
    ↓
FALSE POSITIVE: "red text on black background"
```

---

## Why This Wasn't Caught Before

The architecture doc [platform-background-detection-squarespace-specific.md](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/documentation-md/architecture/platform-background-detection-squarespace-specific.md) documents testing on **this exact site** (launchhappy.co) — but those tests validated the **click-to-inspect background picker**, which uses `clickCoordinates` to find the section. The contrast pair detection path (`trackContrastPair`) takes a different code path — it passes the element's own `computed.backgroundColor` as `initialBackgroundColor`, which short-circuits the detector before it reaches the section CSS variable logic.

---

## Affected Scope

This bug affects **any Squarespace element where:**

1. The element itself has `background-color: transparent` (returned as `rgba(0, 0, 0, 0)`)
2. The visible background comes from a parent/section CSS variable (`--siteBackgroundColor`)

This is **extremely common** — headings, paragraphs, links, and buttons on Squarespace sites almost never have their own background color set.

---

## Proposed Fix

### Fix Location

[squarespaceDetector.ts](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/src/analyzers/backgroundDetectors/squarespaceDetector.ts) — `detect()` method, lines 39-45.

### Change

Replace the raw string comparison with the proper `isTransparentColor()` utility:

```diff
- if (initialBackgroundColor && initialBackgroundColor !== 'transparent') {
+ if (initialBackgroundColor && !isTransparentColor(initialBackgroundColor)) {
```

This is a **one-line fix** that makes the detector correctly identify `rgba(0, 0, 0, 0)` as transparent, allowing it to fall through to the DOM-walk and CSS variable detection methods that will find the actual section background (`--siteBackgroundColor`).

### Secondary Hardening (Optional)

Additionally, `rgbToHex()` in `colorUtils.ts` could be hardened to return `null` for fully-transparent colors (alpha = 0) instead of converting them to opaque hex. This would prevent any future code from accidentally treating transparent colors as black:

```diff
  const rgbMatch = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (rgbMatch) {
+   // If alpha is 0, the color is fully transparent — do not convert to hex
+   const alpha = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
+   if (alpha === 0) return null;
    const r = parseInt(rgbMatch[1], 10);
```

### Other Detectors

The same bug pattern should be checked in [genericDetector.ts](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/src/analyzers/backgroundDetectors/genericDetector.ts) and [wordpressDetector.ts](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/src/analyzers/backgroundDetectors/wordpressDetector.ts) for the same raw string comparison.

---

## Verification Plan

### Manual Testing

1. Build the extension with `npm run build` (Squarespace Chrome target)
2. Load the extension and analyze `launchhappy.co`
3. Check the Colors Report → Accessibility section
4. The "Whatever you need. Solved." H2 should **no longer** appear as a contrast failure
5. Verify no _new_ regressions are introduced for legitimately low-contrast elements

---

**Files to Modify**:
| File | Change |
|------|--------|
| `squarespaceDetector.ts` | Use `isTransparentColor()` instead of string comparison |
| `colorUtils.ts` (optional) | Harden `rgbToHex()` to return null for alpha=0 |
| `genericDetector.ts` | Audit for same pattern |
| `wordpressDetector.ts` | Audit for same pattern |
