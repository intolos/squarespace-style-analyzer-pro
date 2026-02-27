# Accessibility False Positive Resolution: launchhappy.co

**Date**: 2026-02-27
**Issue**: Colors report showed false positive contrast failures — "red text on black background" for elements that were actually dark text on a light lavender background.

---

## 1. The Problem (Root Cause)

The report claimed `Text: #120835 on Background: #000000` for headings on Squarespace sites.
The background color was being detected as `#000000` (black) instead of the actual theme color (lavender) because the detector was getting "stuck" on transparent or invisible structural elements.

---

## 2. Failed Attempt (The "Surface" Fix)

### What was tried:

Modified `squarespaceDetector.ts` to use `isTransparentColor()` instead of a literal string comparison `!== 'transparent'`. This was intended to let `rgba(0,0,0,0)` values fall through to the section-level CSS variable detection.

### Why it failed:

While it correctly handled the text element's transparency, it forced the detector to fall back to the **DOM Walker** (`walkDomFromParent`). Squarespace uses structural overlays (like `.sqs-video-overlay`) that have:

- `background-color: rgb(0, 0, 0)`
- `opacity: 0`

The DOM walker saw `rgb(0, 0, 0)`, didn't check the `opacity`, and incorrectly concluded that the background was solid black.

---

## 3. The Winning Fix (Three-Layer Safeguard)

To fix this 100% and prevent similar traps on other platforms, a comprehensive set of guards was applied to the core detection logic.

### Safeguard 1: Visibility Guard (`baseDetector.ts`)

Updated `checkComputedStyle` (the core check for all platform detectors) to ignore invisible elements:

```typescript
if (
  style.display === 'none' ||
  style.visibility === 'hidden' ||
  (style.opacity !== '' && parseFloat(style.opacity) < 0.01)
) {
  return null; // Skip this element; it's effectively transparent
}
```

### Safeguard 2: Regex Alpha Parsing (`colorUtils.ts`)

Hardened `isTransparentColor` to use Regex to parse any `rgba` string. Any color with alpha `<= 0.05` (virtually invisible) is now treated as fully transparent. This forces the detector to continue searching upwards for the true background.

### Safeguard 3: Alpha-to-Hex Hardening (`colorUtils.ts`)

Modified `rgbToHex` to return `null` if the alpha channel is `<= 0.05`. This prevents the "Alpha Stripping Trap" where `rgba(0,0,0,0.01)` was previously being converted to a solid opaque `#000000`.

---

## 4. Final Verification Results

- **Platform**: Squarespace (launchhappy.co)
- **Result**: The "Whatever you need. Solved." H2 now correctly detects the lavender section background instead of the black video overlay.
- **Cross-Platform Impact**: These fixes are in the **Base Detector** and **Shared Utilities**, meaning WordPress and Generic extensions are now also protected against invisible black overlays.

---

**Implementation Checkpoints**:

- [x] Initial state tagged: `pre-comprehensive-contrast-fix-2026-02-27`
- [x] Final state tagged: `post-comprehensive-contrast-fix-2026-02-27`
- [x] Build verified (Squarespace & Generic)
