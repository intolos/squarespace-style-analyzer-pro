# Color System Integration Architecture

**Date**: 2026-02-13  
**Last Updated**: 2026-02-13  
**Purpose**: Integration patterns between Redmean fuzzy matching, platform detection, and color analysis  
**Status**: Implemented and Production-Ready  
**Related Documents**:
- [Redmean Fuzzy Color Matching](./redmean-fuzzy-color-matching.md) - Color merging system
- [Platform Background Detection](./platform-background-detection.md) - Platform detection system
- [Color Analysis](./color-analysis.md) - Main color analysis module
- [Multi-Platform Architecture](./multi-platform-architecture.md) - Platform detection overview

**Recent Changes**:
- ✅ 2026-02-13: WordPress text element handling (paragraphs skip pseudo-elements)
- ✅ 2026-02-13: DEBUG flag for detector logging

---

## 1. System Overview

The color analysis system is a multi-layered architecture combining three major subsystems:

```
┌─────────────────────────────────────────────────────────────────┐
│                    COLOR ANALYSIS PIPELINE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: PLATFORM DETECTION                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ detectPlatform│→│    Router    │→│   Detector   │         │
│  │   (index.ts)  │  │  (index.ts)  │  │  (specific)  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│          │                                                    │
│          ▼                                                    │
│  Layer 2: BACKGROUND DETECTION                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Element    │→│ getEffective │→│   Platform   │         │
│  │   Analyzed   │  │ Background   │  │   Detector   │         │
│  │              │  │   Color      │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│          │                                                    │
│          ▼                                                    │
│  Layer 3: COLOR TRACKING & FUZZY MATCHING                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  trackColor  │→│   Redmean    │→│    Merge     │         │
│  │              │  │  Distance    │  │    Colors    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│          │                                                    │
│          ▼                                                    │
│  Layer 4: CONTRAST ANALYSIS                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │trackContrast │→│  Calculate   │→│    Issue     │         │
│  │    Pair      │  │    Ratio     │  │   Created    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│          │                                                    │
│          ▼                                                    │
│  Layer 5: REPORT GENERATION                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │refineColor   │→│  Generate    │→│    Badge     │         │
│  │    Keys      │  │    Report    │  │     UI       │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Integration Points

### 2.1 Content Script Initialization

**File**: `wxt-version/entrypoints/content.ts`

The content script orchestrates the entire pipeline:

```typescript
async function analyzeSquarespaceStyles(): Promise<AnalysisResult> {
  // STEP 1: Platform Detection (Layer 1)
  // MUST happen before any color analysis
  const platformInfo = detectPlatform();
  console.log('Detected platform:', platformInfo.platform);
  
  // STEP 2: Load platform-specific selectors
  const selectors = PlatformSelectorManager.getSelectors(platformInfo.platform);
  
  // STEP 3: Capture screenshot for canvas sampling
  let fullPageScreenshot: string | null = null;
  try {
    const response = await chrome.runtime.sendMessage({ action: 'captureScreenshot' });
    if (response && response.success) {
      fullPageScreenshot = response.screenshot;
    }
  } catch (error) {
    console.warn('Screenshot capture failed:', error);
  }
  
  // STEP 4: Initialize color data structure
  const results: AnalysisResult = {
    // ... other fields ...
    colorData: initializeColorData(),
    // ... other fields ...
  };
  
  // STEP 5: Run Analyzers (Layers 2-4)
  // Each analyzer receives platform for background detection
  await analyzeButtons(
    results, 
    navigationName, 
    colorTracker, 
    results.colorData, 
    selectors.buttons,
    platformInfo.platform  // ← Passed through
  );
  
  await analyzeHeadings(
    results, 
    navigationName, 
    colorTracker, 
    results.colorData, 
    selectors.headings,
    platformInfo.platform  // ← Passed through
  );
  
  await analyzeParagraphs(
    results, 
    navigationName, 
    themeStyles, 
    colorTracker, 
    results.colorData, 
    selectors.paragraphs,
    platformInfo.platform  // ← Passed through
  );
  
  // STEP 6: Finalize (Layer 5)
  results.colorData = finalizeColorData(results.colorData);
  
  return results;
}
```

### 2.2 Parameter Passing Chain

The `platform` parameter flows through the entire system:

```
content.ts
  ↓ platform: Platform
themeCapture.ts
  ↓ platform: Platform
themeCaptureHelper() 
  ↓ platform: Platform
getStyleDefinition()
  ↓ platform: Platform
trackColor() / trackContrastPair()
  ↓ platform: Platform
getEffectiveBackgroundColor()
  ↓ platform: Platform
detectBackground()
  ↓ platform: Platform
getBackgroundDetector() → WordPress/Squarespace/Generic Detector
```

**Key Insight**: The platform flows downward through 7+ function calls. This ensures every background detection decision is platform-appropriate.

### 2.3 Color Tracking Integration

**File**: `wxt-version/src/analyzers/colors.ts`

```typescript
/**
 * Track a color occurrence with fuzzy matching.
 * 
 * INTEGRATION:
 * - Uses platform parameter for accurate background detection
 * - Uses Redmean for merging similar colors
 * - Creates audit trail with originalHex
 * 
 * @param colorValue - Detected color
 * @param element - Source element
 * @param property - CSS property (color, background-color, etc.)
 * @param pairedColor - Paired foreground/background
 * @param colorData - Shared color data structure
 * @param getSectionInfo - Section metadata function
 * @param getBlockInfo - Block metadata function
 * @param screenshot - Screenshot for canvas verification
 * @param platform - Platform type for background detection
 */
export async function trackColor(
  colorValue: string | null,
  element: Element,
  property: string,
  pairedColor: string | null,
  colorData: ColorData,
  getSectionInfo: (el: Element) => string,
  getBlockInfo: (el: Element) => string,
  screenshot: string | null = null,
  platform: Platform = 'generic'
): Promise<void> {
  // ... validation ...
  
  // STEP 1: Platform-specific background detection (Layer 2)
  let effectivePaired = pairedColor;
  if (property === 'color') {
    // For text colors, detect background using platform strategy
    effectivePaired = await getEffectiveBackgroundColor(
      element, 
      pairedColor, 
      screenshot, 
      platform  // ← Platform routing
    );
  }
  
  // ... convert to hex ...
  
  // STEP 2: Redmean fuzzy matching (Layer 3)
  let targetHex = hex;
  let isMerged = false;
  
  if (!colorData.colors[hex]) {
    // Check for visually similar colors
    const existingColors = Object.keys(colorData.colors);
    for (let i = 0; i < existingColors.length; i++) {
      if (isVisuallySimilar(hex, existingColors[i])) {  // ← Redmean check
        targetHex = existingColors[i];
        isMerged = true;
        break;
      }
    }
  }
  
  // STEP 3: Update color data
  if (!colorData.colors[targetHex]) {
    colorData.colors[targetHex] = {
      count: 0,
      usedAs: [],
      instances: [],
      mergedColors: new Set<string>(),
    };
  }
  
  colorData.colors[targetHex].count++;
  
  if (isMerged) {
    colorData.colors[targetHex].mergedColors.add(hex);
  }
  
  // STEP 4: Add instance with audit trail
  colorData.colors[targetHex].instances.push({
    // ... metadata ...
    originalHex: hex.toLowerCase(),  // ← Audit trail
    mergedColors: Array.from(colorData.colors[targetHex].mergedColors),
    // ... other fields ...
  });
}
```

### 2.4 Contrast Pair Integration

**File**: `wxt-version/src/analyzers/colors.ts`

Contrast pairs also use platform detection:

```typescript
export async function trackContrastPair(
  element: Element,
  textColor: string,
  backgroundColor: string,
  colorData: ColorData,
  getSectionInfo: (el: Element) => string,
  getBlockInfo: (el: Element) => string,
  screenshot: string | null,
  platform: Platform = 'generic'
): Promise<ContrastIssue | undefined> {
  // ... validation ...
  
  // Use platform-specific background detection
  const effectiveBg = await getEffectiveBackgroundColor(
    element, 
    backgroundColor, 
    screenshot, 
    platform  // ← Platform routing
  );
  
  const textHex = rgbToHex(textColor);
  const bgHex = rgbToHex(effectiveBg);
  
  // Calculate contrast ratio
  const ratio = calculateContrastRatio(textHex, bgHex);
  
  // ... create issue ...
}
```

---

## 3. Data Flow Examples

### 3.1 Example 1: WordPress Button Analysis

**Scenario**: Analyzing a button on a WordPress site using LaunchPad theme

```
┌────────────────────────────────────────────────────────────────┐
│ INPUT                                                          │
│ Element: <a class="wp-block-button__link">Click Me</a>        │
│ Computed style: background-color: transparent                  │
│ Platform: wordpress                                            │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ STEP 1: Platform Detection                                     │
│ Platform: wordpress                                            │
│ Detector: WordPressBackgroundDetector                          │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ STEP 2: Background Detection                                   │
│ Check ::before: background-color: rgb(0, 123, 255) ✓           │
│ Return: rgb(0, 123, 255)                                       │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ STEP 3: Color Tracking                                         │
│ Text color: #FFFFFF (white)                                    │
│ Background: rgb(0, 123, 255) → #007BFF                         │
│ Check existing colors: None match #007BFF                      │
│ Action: Create new entry                                       │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ STEP 4: Contrast Analysis                                      │
│ Text: #FFFFFF, Background: #007BFF                             │
│ Ratio: 4.51:1                                                  │
│ WCAG Level: AA (passes)                                        │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ OUTPUT                                                         │
│ Color entry: #007bff                                           │
│ Count: 1                                                       │
│ Contrast: Passes AA                                            │
│ Method: pseudo-before                                          │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 Example 2: Squarespace with Fuzzy Matching

**Scenario**: Squarespace site with anti-aliasing creating color variations

```
┌────────────────────────────────────────────────────────────────┐
│ INPUT                                                          │
│ Element 1: <h1>Title</h1> with color #2C3337                  │
│ Element 2: <p>Text</p> with color #2C3338 (anti-aliased)      │
│ Element 3: <a>Link</a> with color #2C3339 (anti-aliased)      │
│ Platform: squarespace                                          │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ STEP 1: Track Element 1                                        │
│ Color: #2C3337                                                 │
│ Existing colors: None                                          │
│ Action: Create entry for #2c3337                               │
│ Result: colorData.colors["#2c3337"].count = 1                  │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ STEP 2: Track Element 2                                        │
│ Color: #2C3338                                                 │
│ Check existing: #2c3337 exists                                 │
│ Redmean(#2c3338, #2c3337) = 1.8 < 2.3 ✓ MERGE                │
│ Action: Add to #2c3337 entry                                   │
│ Result:                                                        │
│   colorData.colors["#2c3337"].count = 2                        │
│   colorData.colors["#2c3337"].mergedColors = {"#2c3338"}      │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ STEP 3: Track Element 3                                        │
│ Color: #2C3339                                                 │
│ Check existing: #2c3337 exists                                 │
│ Redmean(#2c3339, #2c3337) = 3.6 > 2.3 ✗ NO MERGE             │
│ Action: Create new entry for #2c3339                           │
│ Result:                                                        │
│   colorData.colors["#2c3337"].count = 2                        │
│   colorData.colors["#2c3339"].count = 1                        │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ STEP 4: Report Generation                                      │
│ refineColorKeys() runs...                                      │
│ #2c3337: 2 uses (master)                                       │
│ #2c3339: 1 use (separate)                                      │
│ Badge generated: "+1 similar" on #2c3337 swatch               │
└────────────────────────────────────────────────────────────────┘
```

### 3.3 Example 3: WordPress Paragraph Text Element (FIXED 2026-02-13)

**Scenario**: WordPress paragraph with decorative `::before` pseudo-element

```
┌────────────────────────────────────────────────────────────────┐
│ DOM STRUCTURE                                                  │
│ <section style="background: #E9F0F5">                         │
│   <div class="lp-section__content">                           │
│     <p class="wp-block-paragraph"> ← Analyzing this          │
│       ::before { background: #000000 } ← Decorative overlay   │
│       Text content here...                                    │
│     </p>                                                      │
│   </div>                                                      │
│ </section>                                                    │
│ Platform: wordpress                                           │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ STEP 1: Platform Detection                                     │
│ Platform: wordpress                                            │
│ Element Type: <p> (text element)                               │
│ Detector: WordPressBackgroundDetector                          │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ STEP 2: Background Detection (Text Element Logic)              │
│ Skip ::before check (would return #000000 - WRONG)            │
│ Skip ::after check                                            │
│ Check CSS classes: None found                                 │
│ Walk DOM tree:                                                 │
│   Check <p>: transparent                                      │
│   Check <div>: transparent                                    │
│   Check <section>: #E9F0F5 ✓                                  │
│ Return: #E9F0F5 (found at SECTION)                             │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ STEP 3: Color Tracking                                         │
│ Text color: #3C434A                                            │
│ Background: #E9F0F5                                            │
│ Paired correctly! (NOT #000000 from ::before)                 │
│ Ratio: 7.2:1                                                   │
│ Result: Passes AAA                                             │
└────────────────────────────────────────────────────────────────┘
```

**Why This Fix Matters:**
- **Before Fix**: Paragraph would pair text (#3C434A) with #000000 (pseudo-element)
- **Result**: False contrast failure reported
- **After Fix**: Paragraph correctly pairs with section background (#E9F0F5)
- **Result**: Accurate contrast analysis

---

### 3.4 Example 4: Complex Nesting

**Scenario**: Deeply nested element with inheritance

```
┌────────────────────────────────────────────────────────────────┐
│ DOM STRUCTURE                                                  │
│ <body style="background: #FFFFFF">                            │
│   <main>                                                       │
│     <section style="background: transparent">                 │
│       <div style="background: transparent">                   │
│         <p>Text here</p> ← Analyzing this                    │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ STEP 1: Platform Detection                                     │
│ Platform: generic (custom site)                                │
│ Detector: GenericBackgroundDetector                            │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ STEP 2: Background Detection                                   │
│ Check <p>: background: transparent                             │
│ Check <div>: background: transparent                           │
│ Check <section>: background: transparent                       │
│ Check <main>: background: transparent                          │
│ Check <body>: background: #FFFFFF ✓                            │
│ Return: #FFFFFF (found at BODY after walking 4 levels)         │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ STEP 3: Color Tracking                                         │
│ Text color: #333333                                            │
│ Background: #FFFFFF                                            │
│ Ratio: 12.6:1 (excellent)                                      │
│ Result: Passes AAA                                             │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Error Handling & Edge Cases

### 4.1 Detection Failures

**Scenario**: Canvas sampling fails (cross-origin, missing screenshot)

```typescript
try {
  const canvasResult = await this.sampleCanvas(element, screenshot);
  if (canvasResult) return canvasResult;
} catch (error) {
  // Canvas failed - log warning and continue to next method
  console.warn('Canvas sampling failed:', error);
  // Fall through to next detection method
}

// If all methods fail...
return {
  color: null,
  details: 'Indeterminate: Complex background layers. Verify manually.',
  method: 'indeterminate',
};
```

### 4.2 Platform Detection Uncertainty

**Scenario**: Platform detection returns 'generic'

```typescript
const platformInfo = detectPlatform();

if (platformInfo.platform === 'generic') {
  // Use conservative approach
  // - Don't assume white
  // - Show indeterminate when uncertain
  // - Allow manual override
}
```

### 4.3 Color Normalization Edge Cases

**Scenario**: Invalid or null colors

```typescript
export function rgbToHex(rgb: string | null): string | null {
  if (!rgb) return null;
  if (rgb.startsWith('#')) return rgb.toUpperCase();
  
  const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;  // Invalid format
  
  // ... convert ...
}
```

---

## 5. Performance Optimization

### 5.1 Caching Strategy

```typescript
// Singleton detector cache
const detectors: Map<string, BackgroundDetector> = new Map();

export function getBackgroundDetector(platform: Platform): BackgroundDetector {
  if (detectors.has(platform)) {
    return detectors.get(platform)!;  // Reuse instance
  }
  
  const detector = createDetector(platform);
  detectors.set(platform, detector);  // Cache for reuse
  return detector;
}
```

### 5.2 Early Exit Patterns

```typescript
// In trackColor()

// Early exit 1: Transparent colors
if (!colorValue || isTransparentColor(colorValue)) return;

// Early exit 2: Ghost buttons
if (isGhostButtonForColorAnalysis(element)) return;

// Early exit 3: Already processed this element-property combo
const uniqueKey = `${elementId}-${property}-${colorValue}`;
if (processed.has(uniqueKey)) return;

// ... continue with expensive operations ...
```

### 5.3 Lazy Screenshot Capture

```typescript
// Screenshot only captured once, reused across analyzers
let fullPageScreenshot: string | null = null;

// Only capture if needed for canvas sampling
if (needsCanvasVerification(platform)) {
  fullPageScreenshot = await captureScreenshot();
}
```

---

## 6. Testing Integration

### 6.1 Unit Test Integration

```typescript
// Test platform-specific behavior
describe('Platform Background Detection Integration', () => {
  it('WordPress uses pseudo-element detection for buttons', async () => {
    const result = await getEffectiveBackgroundColor(
      mockWordPressButton,
      'transparent',
      null,
      'wordpress'
    );
    
    expect(result).toBe('rgb(0, 123, 255)');
  });

  it('WordPress skips pseudo-elements for text elements (p, span)', async () => {
    // Paragraph with ::before overlay
    const mockParagraph = document.createElement('p');
    mockParagraph.innerHTML = 'Text content';
    
    // Mock section parent with actual background
    const mockSection = document.createElement('section');
    mockSection.style.backgroundColor = '#E9F0F5';
    mockSection.appendChild(mockParagraph);
    document.body.appendChild(mockSection);
    
    const result = await getEffectiveBackgroundColor(
      mockParagraph,
      'transparent',  // p has no background
      null,
      'wordpress'
    );
    
    // Should return section background, not any pseudo-element
    expect(result).toBe('#E9F0F5');
  });
  
  it('Squarespace uses computed style', async () => {
    const result = await getEffectiveBackgroundColor(
      mockSquarespaceButton,
      'rgb(255, 0, 0)',
      null,
      'squarespace'
    );
    
    expect(result).toBe('rgb(255, 0, 0)');
  });
});

// Test fuzzy matching integration
describe('Redmean Integration', () => {
  it('merges similar colors during tracking', async () => {
    const colorData = initializeColorData();
    
    // Track two similar colors
    await trackColor('#2C3337', mockElement, 'color', null, colorData, ...);
    await trackColor('#2C3338', mockElement2, 'color', null, colorData, ...);
    
    // Should create only one entry
    expect(Object.keys(colorData.colors)).toHaveLength(1);
    expect(colorData.colors['#2c3337'].count).toBe(2);
    expect(colorData.colors['#2c3337'].mergedColors).toContain('#2c3338');
  });
});
```

### 6.2 Integration Test Scenario

```typescript
// Full pipeline test
describe('Full Color Analysis Pipeline', () => {
  it('analyzes WordPress site correctly', async () => {
    // Setup mock WordPress DOM
    document.body.innerHTML = `
      <div class="wp-block-button">
        <a class="wp-block-button__link">Click</a>
      </div>
    `;
    
    // Mock pseudo-element styles
    mockComputedStyle('.wp-block-button__link::before', {
      backgroundColor: 'rgb(0, 123, 255)'
    });
    
    // Run analysis
    const results = await analyzeSquarespaceStyles();
    
    // Verify platform detection
    expect(results.detectedPlatform.platform).toBe('wordpress');
    
    // Verify background detection worked
    const buttonColors = results.colorData.colors;
    const blueColor = Object.keys(buttonColors).find(
      c => buttonColors[c].instances.some(i => i.element === 'A')
    );
    expect(blueColor).toBe('#007bff');
  });
});
```

---

## 7. Debugging & Monitoring

### 7.1 Console Logging

```typescript
// Debug platform detection
console.log('[SSA] Detected platform:', platformInfo.platform);

// Debug background detection
console.log('[SSA] Background detected:', {
  platform,
  method: result.method,
  color: result.color,
  details: result.details
});

// Debug fuzzy matching
console.log('[SSA] Color merged:', {
  original: hex,
  target: targetHex,
  distance: calculateRedmeanDistance(hex, targetHex)
});
```

### 7.2 DevTools Integration

The test harness provides runtime debugging:

```typescript
// Exposed globally for debugging
window.SSA_DEBUG = {
  platform: detectPlatform(),
  getEffectiveBackgroundColor,
  calculateRedmeanDistance,
  colorData: results.colorData
};
```

---

## 8. Future Extensions

### 8.1 Planned Enhancements

1. **Additional Platform Detectors**
   - WixBackgroundDetector
   - ShopifyBackgroundDetector  
   - WebflowBackgroundDetector

2. **Adaptive Thresholds**
   - Adjust Redmean threshold based on color luminance
   - Dark colors: lower threshold
   - Light colors: higher threshold

3. **Machine Learning**
   - Train model to predict correct background
   - Use as fallback when heuristics fail

4. **Real-time Analysis**
   - MutationObserver for dynamic content
   - Update colors as page changes

### 8.2 Extension Points

```typescript
// Add new platform detector
export class WixBackgroundDetector extends BaseBackgroundDetector {
  getDetectionOrder(): DetectionMethod[] {
    return [
      'computed-style',
      'css-classes',  // Wix uses specific class patterns
      'pseudo-before',
      'canvas',
      'indeterminate'
    ];
  }
}

// Register in factory
export function getBackgroundDetector(platform: Platform): BackgroundDetector {
  switch (platform) {
    case 'wix':
      return new WixBackgroundDetector();
    // ... other cases ...
  }
}
```

---

## 9. Change Log

### 2026-02-13 - WordPress Text Element Fix
- **Issue**: Paragraph elements returning #000000 from decorative `::before` pseudo-elements
- **Fix**: Text elements (p, span, a, etc.) now skip pseudo-element checks
- **Impact**: DOM walking finds actual section/container background
- **Example**: wordpress.com/free page paragraphs now correctly pair with #E9F0F5

### 2026-02-13 - Initial Documentation
- Created integration documentation
- Documented all three examples (button, fuzzy matching, nesting)
- Added testing strategies and debugging guide

---

## 10. Recreation Checklist

To recreate the entire integrated system:

### Core Components
1. ✅ Implement `detectPlatform()` in `platforms/index.ts`
2. ✅ Create detector system in `backgroundDetectors/`
   - WordPress: Text element handling with pseudo-element skipping
   - WordPress: Suspicious color filtering (reject black/white)
   - WordPress: DEBUG flag for logging
3. ✅ Implement Redmean algorithm in `colorUtils.ts`
4. ✅ Update `trackColor()` with fuzzy matching
5. ✅ Update `trackContrastPair()` with platform detection
6. ✅ Update all analyzers to pass platform parameter
7. ✅ Update content.ts to orchestrate pipeline
8. ✅ Implement report generation with badges
9. ✅ Add CSS styles for merged badges
10. ✅ Write integration tests

### Data Flow Verification
1. ✅ Platform detected at start of analysis
2. ✅ Platform passed to all analyzer functions
3. ✅ Background detection uses platform-specific strategy
   - WordPress buttons: Pseudo-element detection
   - WordPress paragraphs: DOM walking
4. ✅ Colors tracked with fuzzy matching
5. ✅ Audit trail preserved with originalHex
6. ✅ Report shows merged badges correctly

---

## 10. Key Design Principles

### 10.1 Single Responsibility
- **Platform Detection**: Only detects platform
- **Background Detector**: Only detects background color
- **Color Tracker**: Only tracks and merges colors
- **Report Generator**: Only generates reports

### 10.2 Don't Repeat Yourself
- **BaseBackgroundDetector**: Shared detection methods
- **Singleton Pattern**: Reuse detector instances
- **Utility Functions**: Shared color conversion

### 10.3 Separation of Concerns
- **Detection vs Tracking**: Platform logic separate from color logic
- **Analysis vs Reporting**: Data collection separate from presentation
- **Core vs Platform**: Generic logic separate from platform-specific

### 10.4 Extensibility
- **Strategy Pattern**: New platforms = new detector class
- **Parameter Passing**: Platform flows through entire system
- **Type Safety**: TypeScript ensures correct usage

---

**Document Version**: 1.1  
**Last Updated**: 2026-02-13  
**Integration Coverage**: Platform Detection ↔ Background Detection ↔ Fuzzy Matching ↔ Report Generation

**Key Integration Points**:
- Platform flows through 7+ function calls to reach detector
- WordPress detector routes by element type (text vs non-text)
- Text elements skip pseudo-elements to avoid decorative overlays
- DEBUG flag provides visibility without production overhead
