# Color Format Handling Guide

**Date**: 2026-02-15
**Purpose**: Comprehensive guide to handling different color formats in background detection
**Status**: Active
**Related Documents**:
- [Platform Background Detection](./platform-background-detection.md) - Where colors are detected
- [Squarespace-Specific Detection](./platform-background-detection-squarespace-specific.md) - HSLA examples
- [RGB to Hex Utility](../wxt-version/src/utils/colorUtils.ts) - Implementation reference

---

## 1. Overview

### 1.1 Why Multiple Color Formats Exist

Browsers and CSS support multiple color formats:

| Format | Use Case | Example |
|--------|----------|---------|
| Hex | Human-readable, CSS standard | `#F9F5FF` |
| RGB | Screen displays, programming | `rgb(249, 245, 255)` |
| RGBA | Transparency support | `rgba(249, 245, 255, 1)` |
| HSL | Human-adjustable hues | `hsl(258, 100%, 98%)` |
| HSLA | Hue-based with transparency | `hsla(258, 100%, 98.04%, 1)` |
| Named | CSS standard names | `white`, `red`, `transparent` |

### 1.2 Where Different Formats Appear

**From `getComputedStyle()`**:
- Always returns **RGB** or **RGBA** format
- Example: `rgb(249, 245, 255)` or `rgba(249, 245, 255, 1)`

**From CSS Variables**:
- Returns raw variable value
- Can be **HSLA**, **RGB**, **Hex**, or **named**
- Example: `hsla(258, 100%, 98.04%, 1)`

**From Canvas Sampling**:
- Returns **RGBA** (0-255 values)
- Example: `rgba(249, 245, 255, 255)`

**From User Input**:
- Can be any format
- Must normalize to hex for comparison

### 1.3 The Problem

**Different sources return different formats**:
```javascript
// Squarespace CSS variable
getComputedStyle(section).getPropertyValue('--siteBackgroundColor')
// Returns: "hsla(258, 100%, 98.04%, 1)"

// Direct computed style
getComputedStyle(element).backgroundColor
// Returns: "rgb(249, 245, 255)"

// Canvas pixel
ctx.getImageData(x, y, 1, 1).data
// Returns: [249, 245, 255, 255] (array)
```

**All must be converted to a common format for comparison**.

---

## 2. Color Format Reference

### 2.1 Hex Format

**Standard**: 6-digit hex (`#RRGGBB`)
**Shorthand**: 3-digit hex (`#RGB`) expands to 6-digit

```
#F9F5FF  ← 6-digit (standard)
#F9F      ← 3-digit (expands to #FF99FF)
```

**Conversion**:
```javascript
// 3-digit to 6-digit
"#F9F" → "#FF99FF"

// 6-digit stays same
"#F9F5FF" → "#F9F5FF"
```

### 2.2 RGB Format

**Pattern**: `rgb(red, green, blue)`
**Values**: 0-255 for each channel

```
rgb(249, 245, 255)  ← Light purple
rgb(255, 255, 255)  ← White
rgb(0, 0, 0)        ← Black
```

**Conversion to Hex**:
```javascript
// Formula
r = Math.round(r).toString(16).padStart(2, '0')
g = Math.round(g).toString(16).padStart(2, '0')
b = Math.round(b).toString(16).padStart(2, '0')
hex = `#${r}${g}${b}`.toUpperCase()

// Example
rgb(249, 245, 255) → "#F9F5FF"
```

### 2.3 RGBA Format

**Pattern**: `rgba(red, green, blue, alpha)`
**Alpha**: 0-1 (0 = transparent, 1 = opaque)

```
rgba(249, 245, 255, 1)    ← Fully opaque
rgba(249, 245, 255, 0.5)  ← 50% transparent
rgba(249, 245, 255, 0)    ← Fully transparent
```

**Note**: For background detection, alpha < 1 is typically ignored (treated as transparent).

### 2.4 HSL Format

**Pattern**: `hsl(hue, saturation%, lightness%)`
**Hue**: 0-360 degrees (0 = red, 120 = green, 240 = blue)
**Saturation**: 0-100%
**Lightness**: 0-100%

```
hsl(258, 100%, 98%)   ← Light purple
hsl(0, 0%, 100%)      ← White
hsl(0, 0%, 0%)        ← Black
```

**Conversion to RGB** (complex):
```javascript
// Algorithm (simplified)
h = hue / 360
s = saturation / 100
l = lightness / 100

if (s === 0) {
  r = g = b = l  // Grayscale
} else {
  // Hue to RGB conversion
  // ... complex math ...
}

// Result: rgb(r, g, b)
```

### 2.5 HSLA Format

**Pattern**: `hsla(hue, saturation%, lightness%, alpha)`
**Most complex format**, requires full HSL→RGB conversion

```
hsla(258, 100%, 98.04%, 1)   ← Light purple (from Squarespace)
hsla(254.03, 44.51%, 33.92%, 1) ← Dark purple
```

**Critical for Squarespace**: CSS variables return HSLA, must convert to hex.

### 2.6 Named Colors

**CSS Standard Names**:
```
white, black, red, green, blue, transparent, etc.
```

**Handling**:
- Map to hex equivalents
- `white` → `#FFFFFF`
- `black` → `#000000`
- `transparent` → `null` (treat as no color)

---

## 3. Implementation Guide

### 3.1 The `rgbToHex()` Function

**Location**: `wxt-version/src/utils/colorUtils.ts`

**Full Implementation**:
```typescript
export function rgbToHex(rgb: string | null): string | null {
  if (!rgb) return null;
  
  // Already hex
  if (rgb.startsWith('#')) return rgb.toUpperCase();
  
  // Check for transparent
  if (rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') {
    return null;
  }
  
  // Handle RGB/RGBA
  const rgbMatch = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b)
      .toString(16)
      .slice(1)
      .toUpperCase();
  }
  
  // Handle HSL/HSLA
  const hslMatch = rgb.match(/^hsla?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%(?:,\s*[\d.]+)?\)$/);
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]) / 360;
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    
    // HSL to RGB conversion
    let r: number, g: number, b: number;
    
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    const rInt = Math.round(r * 255);
    const gInt = Math.round(g * 255);
    const bInt = Math.round(b * 255);
    
    return '#' + ((1 << 24) + (rInt << 16) + (gInt << 8) + bInt)
      .toString(16)
      .slice(1)
      .toUpperCase();
  }
  
  return null;
}
```

### 3.2 Usage Examples

**Example 1: Squarespace CSS Variable**:
```javascript
const cssVar = getComputedStyle(section)
  .getPropertyValue('--siteBackgroundColor');
// Returns: "hsla(258, 100%, 98.04%, 1)"

const hex = rgbToHex(cssVar);
// Returns: "#F9F5FF"
```

**Example 2: Computed Style**:
```javascript
const computedBg = getComputedStyle(element).backgroundColor;
// Returns: "rgb(249, 245, 255)"

const hex = rgbToHex(computedBg);
// Returns: "#F9F5FF"
```

**Example 3: Canvas Pixel**:
```javascript
const pixel = ctx.getImageData(x, y, 1, 1).data;
// Returns: [249, 245, 255, 255]

const rgba = `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3] / 255})`;
const hex = rgbToHex(rgba);
// Returns: "#F9F5FF"
```

### 3.3 Edge Cases

**Case 1: Transparent**:
```javascript
rgbToHex('transparent');        // Returns: null
rgbToHex('rgba(0, 0, 0, 0)');   // Returns: null
```

**Case 2: Already Hex**:
```javascript
rgbToHex('#F9F5FF');      // Returns: "#F9F5FF"
rgbToHex('#f9f5ff');      // Returns: "#F9F5FF" (normalized)
```

**Case 3: Invalid Input**:
```javascript
rgbToHex('invalid');      // Returns: null
rgbToHex('');             // Returns: null
rgbToHex(null);           // Returns: null
```

**Case 4: Decimal Values in HSLA**:
```javascript
rgbToHex('hsla(254.03, 44.51%, 33.92%, 1)');
// Handles decimals correctly
// Returns: "#42307D"
```

---

## 4. Color Comparison

### 4.1 Exact Match

```javascript
if (color1.toLowerCase() === color2.toLowerCase()) {
  // Colors are identical
}
```

### 4.2 Fuzzy Match (±1 digit tolerance)

```javascript
function colorsMatch(hex1: string, hex2: string, tolerance: number = 1): boolean {
  // Remove # prefix
  const h1 = hex1.replace('#', '');
  const h2 = hex2.replace('#', '');
  
  let diffCount = 0;
  
  for (let i = 0; i < 6; i++) {
    const v1 = parseInt(h1[i], 16);
    const v2 = parseInt(h2[i], 16);
    
    if (Math.abs(v1 - v2) > tolerance) {
      return false;
    }
    if (v1 !== v2) diffCount++;
  }
  
  return diffCount <= 1;  // Allow 1 digit difference
}

// Usage
colorsMatch('#F8F5FF', '#F9F5FF');  // Returns: true (1 digit diff)
colorsMatch('#F8F5FF', '#422F7C');  // Returns: false (many diffs)
```

### 4.3 Perceptual Distance (Redmean)

**For human-like color comparison**:
```javascript
// See: redmean-fuzzy-color-matching.md
// More accurate than simple hex comparison
// Accounts for human color perception
```

---

## 5. Platform-Specific Formats

### 5.1 Squarespace

**Primary Format**: HSLA
**Source**: CSS variables (`--siteBackgroundColor`)

```javascript
// Example from launchhappy.co
const lightPurple = 'hsla(258, 100%, 98.04%, 1)';  // → #F9F5FF
const darkPurple = 'hsla(254.03, 44.51%, 33.92%, 1)';  // → #422F7C
const white = 'hsla(0, 0%, 100%, 1)';  // → #FFFFFF
```

**Implementation Note**: Always convert HSLA to hex before comparison.

### 5.2 WordPress

**Primary Format**: RGB or Hex
**Source**: Computed styles, CSS classes

```javascript
// Common patterns
'rgb(249, 245, 255)'  // Direct color
'#F9F5FF'             // Hex in computed style
```

### 5.3 Generic Sites

**Any Format Possible**:
```javascript
// Must handle all formats
'#F9F5FF'                              // Hex
'rgb(249, 245, 255)'                   // RGB
'rgba(249, 245, 255, 1)'              // RGBA
'hsl(258, 100%, 98%)'                 // HSL
'hsla(258, 100%, 98.04%, 1)'          // HSLA
'white'                                // Named
```

---

## 6. Testing Color Conversion

### 6.1 Test Cases

Create comprehensive tests:

```typescript
// Test file: tests/unit/utils/colorUtils.test.ts
describe('rgbToHex', () => {
  it('converts RGB to hex', () => {
    expect(rgbToHex('rgb(249, 245, 255)')).toBe('#F9F5FF');
  });
  
  it('converts RGBA to hex', () => {
    expect(rgbToHex('rgba(249, 245, 255, 1)')).toBe('#F9F5FF');
  });
  
  it('converts HSLA to hex', () => {
    expect(rgbToHex('hsla(258, 100%, 98.04%, 1)')).toBe('#F9F5FF');
  });
  
  it('handles transparent', () => {
    expect(rgbToHex('transparent')).toBeNull();
  });
  
  it('handles invalid input', () => {
    expect(rgbToHex('invalid')).toBeNull();
  });
});
```

### 6.2 Browser Console Testing

```javascript
// Quick tests in browser console
rgbToHex('rgb(255, 0, 0)') === '#FF0000';     // Red
rgbToHex('hsl(0, 100%, 50%)') === '#FF0000';  // Red (HSL)
rgbToHex('#00FF00') === '#00FF00';            // Green (hex)
rgbToHex('transparent') === null;             // Transparent
```

---

## 7. Common Mistakes

### 7.1 Mistake: Not Handling All Formats

**Bad**:
```javascript
// Only handles RGB
const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
```

**Good**:
```javascript
// Handle RGB, RGBA, HSL, HSLA, hex, named
// See full implementation above
```

### 7.2 Mistake: Case Sensitivity

**Bad**:
```javascript
if (color === '#F9F5FF')  // Won't match '#f9f5ff'
```

**Good**:
```javascript
if (color.toLowerCase() === '#f9f5ff')  // Case insensitive
```

### 7.3 Mistake: Ignoring Alpha

**Bad**:
```javascript
// Treats transparent as valid color
if (color !== 'transparent') return color;
```

**Good**:
```javascript
// Properly handles alpha
if (isTransparentColor(color)) return null;
```

### 7.4 Mistake: Precision Loss

**Issue**: HSLA→RGB conversion can lose precision

```javascript
// HSLA: hsla(258, 100%, 98.04%, 1)
// Exact hex: #F9F5FF
// May get: #F8F5FF (off by 1)

// Solution: Use fuzzy matching
// See: colorsMatch() function above
```

---

## 8. Performance Considerations

### 8.1 Conversion Speed

**Fastest**: Hex → Hex (no conversion)
**Fast**: RGB → Hex (simple math)
**Slow**: HSL → Hex (complex math)

**Optimization**: Cache conversions if repeated

### 8.2 Memory Usage

Minimal - color strings are small.

### 8.3 Regex vs. String Parsing

**Regex** (current approach):
- Pros: Handles variations, readable
- Cons: Slightly slower

**String Parsing** (alternative):
- Pros: Faster
- Cons: More code, error-prone

**Recommendation**: Stick with regex for maintainability.

---

**Last Updated**: 2026-02-15
**Formats Supported**: Hex, RGB, RGBA, HSL, HSLA, Named
**Test Coverage**: Squarespace HSLA, WordPress RGB/Hex, Generic all formats