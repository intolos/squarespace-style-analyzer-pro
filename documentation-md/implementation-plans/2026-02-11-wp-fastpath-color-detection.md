# Implementation Plan: WordPress Fast Path Color Detection

## Objective
Implement Fast Path color detection for WordPress platform only to address Issue #18 (WP Color Accuracy & DOM Layering).

## Scope
**WordPress ONLY** - Squarespace and other platforms remain untouched with their existing accurate methods.

## Fast Path Detection Order (Optimized)

### 1. Pseudo-element `::before`
- **Why First**: WordPress LaunchPad often renders actual background here
- **Method**: `window.getComputedStyle(element, '::before').backgroundColor`
- **Check**: Not transparent
- **Return**: Hex color if found

### 2. Pseudo-element `::after`
- **Why Second**: Alternative render location for backgrounds
- **Method**: `window.getComputedStyle(element, '::after').backgroundColor`
- **Check**: Not transparent
- **Return**: Hex color if found

### 3. CSS Class Analysis (`*bg*`, `*background*`, `*backdrop*`)
- **Why Third**: Check CSS rules for background classes BEFORE computed style
- **Classes to Check** (in priority order):
  - `*background*` (highest priority)
  - `*bg*` (high priority)
  - `*backdrop*` (secondary)
- **Method**: 
  - Iterate through `document.styleSheets`
  - Find rules matching element's background classes
  - Extract `background-color` value from CSS rules
- **Return**: Hex color if found in CSS rules
- **Note**: This finds the "intended" background from CSS, not just computed styles
- **Exclude**: `.is-style-*` patterns (not always backgrounds)

### 4. Element Computed Style
- **Why Fourth**: Fallback when no pseudo-elements or background classes
- **Method**: `window.getComputedStyle(element).backgroundColor`
- **Check**: Not transparent
- **Return**: Hex color if found

### 5. Indeterminate State
- **When**: All methods return null/transparent
- **Return**: `"Indeterminate: Complex background layers. Verify manually with color check tool."`

## Key Implementation Details

- **No DOM Walking**: Addresses root cause of Issue #18
- **CSS Class Patterns**: Check `*background*`, `*bg*`, `*backdrop*`; exclude `.is-style-*`
- **WordPress Only**: Platform detection ensures Fast Path only runs on WordPress
- **Indeterminate Message**: Clear user guidance when detection fails

## Files to Modify

### Core Implementation:
1. `wxt-version/src/analyzers/colors.ts` - Add `getFastPathBackground()` function
2. `wxt-version/src/analyzers/colors.ts` - Modify `getEffectiveBackgroundColor()` to use platform parameter

### Files NOT to Touch:
- ALL accessibility/contrast reporting (`accessibility.ts`, `outliers.ts`)
- ALL export/report files
- Squarespace-specific analyzers (buttons, links, typography, colorScanner)
- Test harness (keep as-is)

## Integration

The Fast Path integrates with existing platform detection:
```typescript
if (platform === 'wordpress') {
  return getFastPathBackground(element);
}
// Squarespace and others use existing legacy methods
```

## Testing Strategy

1. Test on WordPress.com VIP section (original problem case)
2. Verify Fast Path detects correct background color
3. Verify Squarespace sites still work correctly (no regression)
4. Verify indeterminate message displays correctly when detection fails
5. Verify locate button still works with indeterminate messages

## Code Comments

Will add `// IMPORTANT:` comments explaining:
- Why pseudo-elements are checked first
- Why no DOM walking for WordPress
- Why CSS classes are checked before computed styles
- Why `.is-style-*` is excluded

## Accuracy Standards

Per `DEVELOPMENT_PRINCIPLES_CRITICAL.md`:
- Fast Path must match or exceed manual color picker accuracy
- Handle edge cases: pseudo-elements, CSS class backgrounds, transparent layers
- Fail loudly with indeterminate message when unsure
- Test against real WordPress sites before deployment

## Approval Status

✅ **APPROVED BY USER**

**Created**: 2026-02-11
**Author**: AI Implementation Agent
**Status**: Approved - Ready for Execution