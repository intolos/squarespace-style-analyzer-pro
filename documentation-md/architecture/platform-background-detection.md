# Platform-Specific Background Color Detection Architecture

**Date**: 2026-02-13  
**Purpose**: Platform-aware background color detection for accurate contrast analysis  
**Status**: Implemented and Production-Ready  
**Related Documents**:
- [Redmean Fuzzy Color Matching](./redmean-fuzzy-color-matching.md) - Color merging system
- [Color System Integration](./color-system-integration.md) - How systems work together
- [Multi-Platform Architecture](./multi-platform-architecture.md) - Platform detection overview
- [Squarespace-Specific Background Detection](./platform-background-detection-squarespace-specific.md) - CSS variable detection for Squarespace 7.1
- [Squarespace Troubleshooting Walkthrough](../walkthroughs/platform-background-detection-squarespace-specific-details.md) - Detailed problem-solving history

---

## 1. Overview

### The Problem

Different Content Management Systems (CMS) render backgrounds using fundamentally different approaches:

**WordPress (LaunchPad theme)**:
- Backgrounds rendered on `::before` pseudo-elements
- CSS classes control appearance
- Computed style often returns "transparent"

**Squarespace**:
- Backgrounds on actual elements
- Standard CSS properties
- Computed style is reliable

**Generic Sites**:
- Mix of approaches
- Unpredictable DOM structures

### The Solution

**Platform-Specific Detection Strategies**: Each platform has a custom detection order that prioritizes the most reliable detection method for that CMS.

---

## 2. System Architecture

### 2.1 File Structure

```
wxt-version/src/analyzers/backgroundDetectors/
├── types.ts                    # Core interfaces and types
├── baseDetector.ts             # Abstract base class with shared utilities
├── index.ts                    # Factory and router
├── wordpressDetector.ts        # WordPress-specific strategy
├── squarespaceDetector.ts      # Squarespace-specific strategy
├── genericDetector.ts          # Fallback strategy
```

### 2.2 Class Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│ BackgroundDetector (abstract)                               │
│ - config: DetectorConfig                                    │
│ + getDetectionOrder(): DetectionMethod[]                    │
│ + detect(context): Promise<DetectionResult>                │
└──────────────────┬──────────────────────────────────────────┘
                   │ extends
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ BaseBackgroundDetector                                      │
│ - checkPseudoElement(pseudo): DetectionResult | null       │
│ - checkComputedStyle(): DetectionResult | null             │
│ - checkCssRules(): DetectionResult | null                  │
│ - walkDomForBackground(): DetectionResult | null           │
│ - sampleCanvas(): Promise<DetectionResult | null>          │
│ - isButtonLike(): boolean                                  │
└──────────┬──────────────────────────────────────────────────┘
           │ extends
           ▼
    ┌───────────────────┬───────────────────┐
    │                   │                   │
    ▼                   ▼                   ▼
┌──────────┐    ┌──────────┐    ┌──────────┐
│ WordPress│    │Squarespace│    │ Generic  │
│ Detector │    │ Detector │    │ Detector │
└──────────┘    └──────────┘    └──────────┘
```

---

## 3. Type Definitions

**File**: `wxt-version/src/analyzers/backgroundDetectors/types.ts`

```typescript
/**
 * Detection context passed to all detectors.
 * Contains everything needed to determine background color.
 */
export interface DetectionContext {
  element: Element;                    // Target element to analyze
  screenshot: string | null;          // Base64 screenshot for canvas sampling
  initialBackgroundColor: string | null;  // Pre-computed background-color value
}

/**
 * Detection result returned by all detectors.
 */
export interface DetectionResult {
  color: string | null;               // RGB/RGBA color string, or null if failed
  details: string;                    // Human-readable explanation
  method: string;                     // Which detection method succeeded
}

/**
 * Detector configuration.
 */
export interface DetectorConfig {
  name: string;                       // Human-readable detector name
  platform: string;                   // Platform identifier
}

/**
 * Detection method types.
 * Ordered from least to most computationally expensive.
 */
export type DetectionMethod = 
  | 'pseudo-before'      // Check ::before pseudo-element
  | 'pseudo-after'       // Check ::after pseudo-element
  | 'css-classes'        // Analyze CSS class rules
  | 'computed-style'     // Read computed CSS style
  | 'dom-walk'          // Walk up DOM tree
  | 'canvas'            // Sample screenshot canvas
  | 'indeterminate';    // Could not determine

/**
 * Abstract base class for all background detectors.
 * Implements the Template Method pattern.
 */
export abstract class BackgroundDetector {
  protected config: DetectorConfig;

  constructor(config: DetectorConfig) {
    this.config = config;
  }

  /**
   * Get the ordered list of detection methods for this platform.
   * Order matters: faster/more reliable methods first.
   */
  abstract getDetectionOrder(): DetectionMethod[];
  
  /**
   * Main detection entry point.
   * Implementations should try methods in order until one succeeds.
   */
  abstract detect(context: DetectionContext): Promise<DetectionResult>;

  getName(): string {
    return this.config.name;
  }

  getPlatform(): string {
    return this.config.platform;
  }
}
```

---

## 4. Base Detector Utilities

**File**: `wxt-version/src/analyzers/backgroundDetectors/baseDetector.ts`

The base class provides shared detection methods following DRY principles.

### 4.1 Pseudo-Element Detection

```typescript
/**
 * Check pseudo-element for background color.
 * 
 * WORDPRESS CONTEXT:
 * LaunchPad theme renders many backgrounds on ::before elements.
 * This catches the actual visible background even when computed
 * style reports "transparent".
 * 
 * @param element - Element to check
 * @param pseudo - '::before' or '::after'
 * @returns Detection result or null if no background found
 */
protected checkPseudoElement(
  element: Element,
  pseudo: '::before' | '::after'
): DetectionResult | null {
  try {
    const style = window.getComputedStyle(element, pseudo);
    if (style.backgroundColor && !isTransparentColor(style.backgroundColor)) {
      const hex = rgbToHex(style.backgroundColor);
      if (hex) {
        return {
          color: style.backgroundColor,
          details: `${pseudo} background: ${style.backgroundColor}`,
          method: pseudo === '::before' ? 'pseudo-before' : 'pseudo-after',
        };
      }
    }
  } catch (e) {
    // Pseudo-element access can fail on some browsers, ignore
  }
  return null;
}
```

### 4.2 Computed Style Detection

```typescript
/**
 * Check computed style on element.
 * 
 * SQUARESPACE CONTEXT:
 * This is the primary method for Squarespace sites.
* Backgrounds are applied directly to elements, so computed
* style is reliable.
 * 
 * @param element - Element to check
 * @returns Detection result or null if transparent
 */
protected checkComputedStyle(element: Element): DetectionResult | null {
  try {
    const style = window.getComputedStyle(element);
    if (style.backgroundColor && !isTransparentColor(style.backgroundColor)) {
      return {
        color: style.backgroundColor,
        details: `Computed background: ${style.backgroundColor}`,
        method: 'computed-style',
      };
    }
  } catch (e) {
    console.warn('Error checking computed style:', e);
  }
  return null;
}
```

### 4.3 CSS Class Rule Analysis

```typescript
/**
 * Check CSS rules for background classes.
 * 
 * RATIONALE:
 * Some themes use classes like .bg-primary, .background-dark to
 * control backgrounds. We search stylesheets for these patterns
 * to find the "intended" background before falling back to
* computed values.
 * 
 * @param element - Element with background classes
 * @returns Detection result or null if no matching rules
 */
protected checkCssRules(element: Element): DetectionResult | null {
  const classList = Array.from(element.classList);
  const backgroundPatterns = ['background', 'bg', 'backdrop'];

  // Find matching background classes (excluding state classes)
  const matchingClasses = classList.filter(cls => {
    if (cls.startsWith('is-style-')) return false; // WordPress state classes
    return backgroundPatterns.some(pattern =>
      cls.toLowerCase().includes(pattern.toLowerCase())
    );
  });

  if (matchingClasses.length === 0) return null;

  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule) {
            for (const className of matchingClasses) {
              if (rule.selectorText.includes(className)) {
                const bgColor = rule.style.backgroundColor;
                if (bgColor && !isTransparentColor(bgColor)) {
                  const hex = rgbToHex(bgColor);
                  if (hex) {
                    return {
                      color: bgColor,
                      details: `CSS rule background (${className}): ${bgColor}`,
                      method: 'css-classes',
                    };
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        // Cross-origin stylesheets may throw, skip them
        continue;
      }
    }
  } catch (e) {
    console.warn('Error searching CSS rules:', e);
  }

  return null;
}
```

### 4.4 DOM Tree Walking

```typescript
/**
 * Walk up DOM tree to find background.
 * 
 * USE CASE:
 * Child elements often inherit transparent backgrounds.
 * We walk up to find the nearest ancestor with a solid background.
 * 
 * @param startElement - Element to start from
 * @param maxDepth - Maximum levels to walk (default: 15)
 * @returns Detection result or null if no background found
 */
protected walkDomForBackground(
  startElement: Element, 
  maxDepth = 15
): DetectionResult | null {
  let el: Element | null = startElement;
  let depth = 0;

  while (el && depth < maxDepth) {
    const result = this.checkComputedStyle(el);
    if (result) {
      result.details += ` (found at ${el.tagName} after walking ${depth} levels)`;
      return result;
    }
    el = el.parentElement;
    depth++;
  }

  return null;
}
```

### 4.5 Canvas Sampling

```typescript
/**
 * Sample canvas for background color.
 * 
 * CRITICAL VALIDATION:
 * Includes element overlap detection to prevent "identity crisis"
 * where overlapping elements cause incorrect color sampling.
 * 
 * IMPROVEMENTS:
 * 1. Checks document.elementFromPoint() to verify target element is visible
 * 2. Uses median instead of mean to reduce border/edge impact
 * 3. Returns null if another element is blocking the sample point
 * 
 * @param element - Element to sample
 * @param screenshot - Base64 screenshot
 * @returns Detection result or null
 */
protected async sampleCanvas(
  element: Element,
  screenshot: string | null
): Promise<DetectionResult | null> {
  if (!screenshot) return null;

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  try {
    // VALIDATION: Check if target element is actually visible at center point
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const elementAtPoint = document.elementFromPoint(centerX, centerY);
    
    // If something else is on top, canvas sampling may be unreliable
    if (elementAtPoint && !element.contains(elementAtPoint) && elementAtPoint !== element) {
      console.warn('[SSA] Canvas sampling skipped: Element overlap detected', {
        target: element.tagName,
        blocking: elementAtPoint.tagName
      });
      return null;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = screenshot;
    });

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const devicePixelRatio = window.devicePixelRatio || 1;
    const sampleCenterX = Math.floor(centerX * devicePixelRatio);
    const sampleCenterY = Math.floor(centerY * devicePixelRatio);

    // Sample 5x5 grid around center
    const sampleSize = 5;
    const halfSize = Math.floor(sampleSize / 2);
    const colors: { r: number; g: number; b: number; a: number }[] = [];

    for (let dx = -halfSize; dx <= halfSize; dx++) {
      for (let dy = -halfSize; dy <= halfSize; dy++) {
        const x = sampleCenterX + dx;
        const y = sampleCenterY + dy;

        if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          colors.push({
            r: pixel[0],
            g: pixel[1],
            b: pixel[2],
            a: pixel[3] / 255,
          });
        }
      }
    }

    if (colors.length === 0) return null;

    // Use MEDIAN instead of MEAN to reduce border/edge impact
    const sortedR = colors.map(c => c.r).sort((a, b) => a - b);
    const sortedG = colors.map(c => c.g).sort((a, b) => a - b);
    const sortedB = colors.map(c => c.b).sort((a, b) => a - b);
    const sortedA = colors.map(c => c.a).sort((a, b) => a - b);
    
    const mid = Math.floor(colors.length / 2);
    const rgba = `rgba(${sortedR[mid]}, ${sortedG[mid]}, ${sortedB[mid]}, ${sortedA[mid]})`;

    return {
      color: rgba,
      details: `Canvas sampling (${colors.length} points, median): ${rgba}`,
      method: 'canvas',
    };
  } catch (error) {
    console.warn('Canvas sampling failed:', error);
    return null;
  }
}
```

### 4.6 Button Detection Helper

```typescript
/**
 * Check if element is button-like.
 * Used to decide whether to use canvas verification.
 * 
 * @param element - Element to check
 * @returns true if element is a button, link with button class, or has button role
 */
protected isButtonLike(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  const isButton = tagName === 'button' || tagName === 'a' || tagName === 'input';
  const hasButtonRole = element.getAttribute('role') === 'button';
  const hasButtonClass = (element.className || '').toLowerCase().includes('button');
  return isButton || hasButtonRole || hasButtonClass;
}
```

---

## 5. Platform-Specific Detectors

### 5.1 WordPress Detector

**File**: `wxt-version/src/analyzers/backgroundDetectors/wordpressDetector.ts`

**Detection Order**:

**For Text Elements** (`<p>`, `<span>`, `<a>`, etc.):
1. CSS class rules
2. DOM walking ← **PRIORITY**
3. Computed style
4. Canvas (buttons only)
5. Indeterminate

**For Non-Text Elements** (buttons, sections, divs):
1. `::before` pseudo-element (validated)
2. `::after` pseudo-element (validated)
3. CSS class rules
4. Computed style
5. DOM walking
6. Canvas (buttons only)
7. Indeterminate

```typescript
/**
 * WordPress background detector
 * 
 * PLATFORM CHARACTERISTICS:
 * - LaunchPad theme renders backgrounds on pseudo-elements
 * - CSS classes control appearance (.bg-*, .background-*)
 * - Computed style often returns "transparent" even with visible background
 * 
 * DETECTION STRATEGY:
 * 
 * IMPORTANT FIX (2026-02-13): Text elements (p, span, etc.) skip pseudo-element 
 * checks to avoid decorative overlays being mistaken for readable backgrounds.
 * 
 * 1. Text elements: DOM walking prioritized to find section/container background
 * 2. Non-text elements: Pseudo-elements checked first with suspicious color validation
 * 3. Black (#000000) and white (#FFFFFF) pseudo-element results are rejected
 */

// DEBUG flag - set to false to disable logging in production
const DEBUG = true;

// Text elements that should skip pseudo-element detection
const TEXT_ELEMENTS = new Set([
  'p', 'span', 'a', 'strong', 'em', 'b', 'i', 'label', 'small'
]);

// Suspicious colors that are likely decorative overlays
const SUSPICIOUS_COLORS = new Set([
  '#000000', '#FFFFFF', '#000', '#FFF', '#00000000'
]);

export class WordPressBackgroundDetector extends BaseBackgroundDetector {
  constructor() {
    super({
      name: 'WordPress Background Detector',
      platform: 'wordpress',
    });
  }

  getDetectionOrder(): DetectionMethod[] {
    return [
      'pseudo-before',
      'pseudo-after',
      'css-classes',
      'computed-style',
      'dom-walk',
      'canvas',
      'indeterminate',
    ];
  }

  async detect(context: DetectionContext): Promise<DetectionResult> {
    const { element, screenshot, initialBackgroundColor } = context;
    const tagName = element.tagName.toLowerCase();
    const isTextElement = TEXT_ELEMENTS.has(tagName);

    // DEBUG logging (disable by setting DEBUG = false)
    if (DEBUG) {
      console.log(`[WP-Detector] Analyzing <${tagName}>`, {
        isTextElement,
        initialBackgroundColor
      });
    }

    // For non-text elements, check pseudo-elements first (but validate results)
    if (!isTextElement) {
      // Check ::before with suspicious color validation
      const beforeResult = this.checkPseudoElement(element, '::before');
      if (beforeResult) {
        const beforeHex = this.rgbToHex(beforeResult.color);
        // Only accept if not a suspicious decorative color
        if (beforeHex && !SUSPICIOUS_COLORS.has(beforeHex)) {
          return beforeResult;
        }
      }

      // Check ::after with same validation
      const afterResult = this.checkPseudoElement(element, '::after');
      if (afterResult) {
        const afterHex = this.rgbToHex(afterResult.color);
        if (afterHex && !SUSPICIOUS_COLORS.has(afterHex)) {
          return afterResult;
        }
      }
    }

    // Check CSS class rules
    const cssResult = this.checkCssRules(element);
    if (cssResult) return cssResult;

    // For text elements, prioritize DOM walking
    if (isTextElement) {
      const domResult = this.walkDomForBackground(element);
      if (domResult) {
        const domHex = this.rgbToHex(domResult.color);
        // Accept unless it's a suspicious color
        if (domHex && !SUSPICIOUS_COLORS.has(domHex)) {
          return domResult;
        }
      }
    }

    // Computed style
    if (initialBackgroundColor && initialBackgroundColor !== 'transparent') {
      return {
        color: initialBackgroundColor,
        details: `Initial background: ${initialBackgroundColor}`,
        method: 'computed-style',
      };
    }

    const computedResult = this.checkComputedStyle(element);
    if (computedResult) return computedResult;

    // DOM walking for non-text elements
    if (!isTextElement) {
      const domResult = this.walkDomForBackground(element);
      if (domResult) return domResult;
    }

    // Canvas for buttons
    if (this.isButtonLike(element) && screenshot) {
      const canvasResult = await this.sampleCanvas(element, screenshot);
      if (canvasResult) return canvasResult;
    }

    return this.getIndeterminateResult();
  }

  private getIndeterminateResult(): DetectionResult {
    return {
      color: null,
      details: 'Indeterminate: Complex background layers. <a href="javascript:void(0)" onclick="showContrastChecker(); return false;">Open Color Checker Tool</a> to verify manually.',
      method: 'indeterminate',
    };
  }
}
```

#### Text Element Detection Rationale

**Why text elements skip pseudo-elements:**

1. **Paragraphs** often have `::before` or `::after` pseudo-elements for:
   - Decorative underlines
   - Drop caps
   - Quote marks (for `<blockquote>`)
   - These are typically black (#000000) or white (#FFFFFF)

2. **The actual readable background** is on an ancestor:
   - Section containers
   - Column wrappers
   - Page backgrounds

3. **Example from wordpress.com/free:**
   ```
   <section style="background: #E9F0F5">  ← Actual background
     <div class="lp-section__content">
       <p class="wp-block-paragraph">     ← Text element
         ::before { background: #000000 } ← Decorative (WRONG)
         Text content here...
       </p>
     </div>
   </section>
   ```

**Suspicious Color Filtering:**
- Black (#000000) and white (#FFFFFF) pseudo-elements are often decorative
- Real section backgrounds are typically colored
- This prevents false positives while preserving LaunchPad button detection
```

### 5.2 Squarespace Detector

**File**: `wxt-version/src/analyzers/backgroundDetectors/squarespaceDetector.ts`

**Related Documents**:
- [Squarespace-Specific Background Detection](./platform-background-detection-squarespace-specific.md) - Complete guide to CSS variable detection
- [Detailed Troubleshooting Walkthrough](../walkthroughs/platform-background-detection-squarespace-specific-details.md) - 15 failed approaches before success

**Detection Order** (Updated 2026-02-15):
1. Clicked element (skip if body has white)
2. DOM walk from parent (excludes body)
3. **Section CSS variable** (`--siteBackgroundColor`) ← KEY: Works for both manual and automated detection
4. CSS class rules
5. `::before` pseudo-element
6. `::after` pseudo-element
7. DOM walk fallback
8. Indeterminate (link to Color Checker Tool)

**IMPORTANT (2026-02-15)**: The Squarespace detector has been enhanced to handle dynamic theme colors via CSS variables. The `--siteBackgroundColor` CSS variable is now detected for both:
- Manual click detection (uses click coordinates + elementFromPoint)
- Automated scanning (uses element position to find containing section)

```typescript
/**
 * Squarespace background detector
 * 
 * PLATFORM CHARACTERISTICS:
 * - Standard CSS architecture
 * - Backgrounds on actual elements (not pseudo-elements)
 * - Computed style is reliable
 * - Flat, predictable DOM structure
 * 
 * DETECTION STRATEGY:
 * Use computed style FIRST, then DOM walking.
 * Pseudo-elements are decorative (icons, underlines) and checked last.
 */
export class SquarespaceBackgroundDetector extends BaseBackgroundDetector {
  constructor() {
    super({
      name: 'Squarespace Background Detector',
      platform: 'squarespace',
    });
  }

  getDetectionOrder(): DetectionMethod[] {
    return [
      'computed-style',
      'dom-walk',
      'pseudo-before',
      'pseudo-after',
      'canvas',
      'indeterminate',
    ];
  }

  async detect(context: DetectionContext): Promise<DetectionResult> {
    const { element, screenshot, initialBackgroundColor } = context;

    // 1. Computed style is reliable for Squarespace
    if (initialBackgroundColor && initialBackgroundColor !== 'transparent') {
      return {
        color: initialBackgroundColor,
        details: `Initial background: ${initialBackgroundColor}`,
        method: 'computed-style',
      };
    }

    const computedResult = this.checkComputedStyle(element);
    if (computedResult) return computedResult;

    // 2. Walk up DOM tree for nested containers
    const domResult = this.walkDomForBackground(element);
    if (domResult) return domResult;

    // 3-4. Check pseudo-elements (decorative only in Squarespace)
    const beforeResult = this.checkPseudoElement(element, '::before');
    if (beforeResult) return beforeResult;

    const afterResult = this.checkPseudoElement(element, '::after');
    if (afterResult) return afterResult;

    // 5. Canvas verification for buttons
    if (this.isButtonLike(element) && screenshot) {
      try {
        const canvasResult = await this.sampleCanvas(element, screenshot);
        if (canvasResult) {
          // Compare with DOM result for discrepancy detection
          const domBg = await this.getDomBackground(element);
          if (domBg) {
            const domHex = this.rgbToHex(domBg);
            const canvasHex = this.rgbToHex(canvasResult.color);
            if (domHex && canvasHex && domHex !== canvasHex) {
              return {
                color: canvasResult.color,
                details: `Canvas: ${canvasResult.color} (DOM: ${domBg})`,
                method: 'canvas',
              };
            }
          }
          return canvasResult;
        }
      } catch (e) {
        // Canvas failed, continue to fallback
      }
    }

    // 6. Squarespace-specific: fallback to indeterminate (don't make up a color)
    return this.getIndeterminateResult();
  }

  private async getDomBackground(element: Element): Promise<string | null> {
    let el: Element | null = element;
    while (el) {
      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor;
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
        return bg;
      }
      el = el.parentElement;
    }
    return null;
  }
}
```

### 5.3 Generic Detector

**File**: `wxt-version/src/analyzers/backgroundDetectors/genericDetector.ts`

**Detection Order**:
1. Computed style
2. CSS class rules
3. `::before` pseudo-element
4. `::after` pseudo-element
5. DOM tree walking
6. Canvas
7. Indeterminate

```typescript
/**
 * Generic background detector
 * 
 * USE CASE:
 * Fallback for unknown platforms or custom sites.
 * Conservative approach that doesn't make platform assumptions.
 * 
 * FALLBACK BEHAVIOR:
 * Returns "indeterminate" instead of assuming white,
 * prompting users to verify manually.
 */
export class GenericBackgroundDetector extends BaseBackgroundDetector {
  constructor() {
    super({
      name: 'Generic Background Detector',
      platform: 'generic',
    });
  }

  getDetectionOrder(): DetectionMethod[] {
    return [
      'computed-style',
      'css-classes',
      'pseudo-before',
      'pseudo-after',
      'dom-walk',
      'canvas',
      'indeterminate',
    ];
  }

  async detect(context: DetectionContext): Promise<DetectionResult> {
    const { element, screenshot, initialBackgroundColor } = context;

    // Standard approach: computed style first
    if (initialBackgroundColor && initialBackgroundColor !== 'transparent') {
      return {
        color: initialBackgroundColor,
        details: `Initial background: ${initialBackgroundColor}`,
        method: 'computed-style',
      };
    }

    const computedResult = this.checkComputedStyle(element);
    if (computedResult) return computedResult;

    // Check CSS classes
    const cssResult = this.checkCssRules(element);
    if (cssResult) return cssResult;

    // Check pseudo-elements
    const beforeResult = this.checkPseudoElement(element, '::before');
    if (beforeResult) return beforeResult;

    const afterResult = this.checkPseudoElement(element, '::after');
    if (afterResult) return afterResult;

    // Walk DOM tree
    const domResult = this.walkDomForBackground(element);
    if (domResult) return domResult;

    // Canvas as last resort
    if (screenshot) {
      const canvasResult = await this.sampleCanvas(element, screenshot);
      if (canvasResult) return canvasResult;
    }

    // Conservative: don't assume white for unknown platforms - use indeterminate
    return this.getIndeterminateResult();
  }
}
```

---

## 6. Factory and Router

**File**: `wxt-version/src/analyzers/backgroundDetectors/index.ts`

The factory pattern ensures single instance per platform (performance) and proper routing.

```typescript
/**
 * Background detector factory
 * SRP: Only responsible for routing to correct detector based on platform
 * DRY: Platform detection logic centralized here
 */

// Singleton instances for performance
const detectors: Map<string, BackgroundDetector> = new Map();

/**
 * Get the appropriate detector for a platform.
 * Uses singleton pattern to avoid creating new instances repeatedly.
 * 
 * PERFORMANCE:
 * Detectors are cached and reused across multiple calls.
 * This matters because detection may be called thousands of times
 * during a full-page analysis.
 * 
 * @param platform - Platform type
 * @returns BackgroundDetector instance for that platform
 */
export function getBackgroundDetector(platform: Platform): BackgroundDetector {
  // Check cache first
  if (detectors.has(platform)) {
    return detectors.get(platform)!;
  }

  // Create new detector based on platform
  let detector: BackgroundDetector;

  switch (platform) {
    case 'wordpress':
      detector = new WordPressBackgroundDetector();
      break;
    case 'squarespace':
      detector = new SquarespaceBackgroundDetector();
      break;
    case 'wix':
    case 'webflow':
    case 'shopify':
      // These platforms can use generic for now
      // Add specific detectors if platform-specific issues arise
      detector = new GenericBackgroundDetector();
      break;
    default:
      detector = new GenericBackgroundDetector();
      break;
  }

  // Cache for reuse
  detectors.set(platform, detector);
  return detector;
}

/**
 * Convenience function to detect background with platform routing.
 * This is the main entry point for background detection.
 * 
 * USAGE:
 * const result = await detectBackground(platform, element, bgColor, screenshot);
 * const effectiveBg = result.color;
 * 
 * @param platform - Platform type
 * @param element - Element to analyze
 * @param initialBackgroundColor - Pre-computed background color
 * @param screenshot - Screenshot for canvas verification
 * @returns Detection result with color, details, and method
 */
export async function detectBackground(
  platform: Platform,
  element: Element,
  initialBackgroundColor: string | null,
  screenshot: string | null
): Promise<{ color: string | null; details: string; method: string }> {
  const detector = getBackgroundDetector(platform);

  const result = await detector.detect({
    element,
    screenshot,
    initialBackgroundColor,
  });

  return {
    color: result.color,
    details: result.details,
    method: result.method,
  };
}

// Re-exports for consumers
export { BackgroundDetector } from './types';
export { BaseBackgroundDetector } from './baseDetector';
export type { DetectionContext, DetectionResult, DetectionMethod } from './types';
export { WordPressBackgroundDetector } from './wordpressDetector';
export { SquarespaceBackgroundDetector } from './squarespaceDetector';
export { GenericBackgroundDetector } from './genericDetector';
```

---

## 7. Integration with Color Analysis

**File**: `wxt-version/src/analyzers/colors.ts`

The color analysis module integrates platform detection via the `getEffectiveBackgroundColor` function.

```typescript
import { detectBackground } from './backgroundDetectors';

/**
 * Get effective background color using platform-specific detection.
 * 
 * IMPORTANT: This function uses platform-specific detection strategies to handle
 * different CMS platforms' rendering approaches:
 * - WordPress often renders backgrounds on pseudo-elements (::before)
 * - Squarespace uses standard CSS on actual elements
 * - Generic uses conservative multi-method approach
 * 
 * @param element - Element to check
 * @param initialBackgroundColor - Initial background color from computed style
 * @param screenshot - Screenshot for canvas verification
 * @param platform - Platform type (wordpress, squarespace, wix, webflow, shopify, generic)
 * @returns RGB/RGBA color string, or null if detection fails
 */
export async function getEffectiveBackgroundColor(
  element: Element,
  initialBackgroundColor: string | null,
  screenshot: string | null,
  platform: Platform = 'generic'
): Promise<string | null> {
  const result = await detectBackground(
    platform,
    element,
    initialBackgroundColor,
    screenshot
  );

  return result.color;
}
```

---

## 8. Detection Strategy Comparison

| Platform | Element Type | Primary Method | Why This Order | Fallback |
|----------|-------------|---------------|----------------|----------|
| **WordPress** | **Text** (p, span, a) | DOM Walking | Find section/container background | CSS → Computed → Canvas |
| **WordPress** | **Non-text** (div, button) | `::before` pseudo-element (validated) | LaunchPad renders backgrounds here | CSS → Computed → DOM → Canvas |
| **Squarespace** | All | Computed style | Standard CSS, reliable | DOM walk → Pseudo-elements → Canvas |
| **Generic** | All | Computed style | Works for most sites | CSS → Pseudo → DOM → Canvas → Indeterminate |

### Validation Rules

**Suspicious Color Filtering (WordPress):**
- Black (#000000) and white (#FFFFFF) pseudo-element results are rejected
- These are typically decorative overlays, not readable backgrounds
- Prevents false positives on paragraphs with decorative `::before` elements

**Text Element Special Handling:**
- Paragraphs, spans, and inline elements skip pseudo-element checks
- DOM walking finds the actual section background
- Example: `<p>` on light blue section won't return black `::before` overlay

---

## 9. Testing & Verification

### 9.1 Unit Test Example

```typescript
import { describe, it, expect, vi } from 'vitest';
import { WordPressBackgroundDetector } from '../src/analyzers/backgroundDetectors/wordpressDetector';

describe('WordPress Background Detector', () => {
  it('should detect ::before background', async () => {
    const detector = new WordPressBackgroundDetector();
    
    // Mock element with ::before background
    const mockElement = document.createElement('div');
    mockElement.className = 'wp-block-button';
    
    // Mock getComputedStyle to return background on ::before
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = vi.fn((el, pseudo) => {
      if (pseudo === '::before') {
        return { backgroundColor: 'rgb(0, 123, 255)' };
      }
      return { backgroundColor: 'transparent' };
    });
    
    const result = await detector.detect({
      element: mockElement,
      screenshot: null,
      initialBackgroundColor: 'transparent',
    });
    
    expect(result.color).toBe('rgb(0, 123, 255)');
    expect(result.method).toBe('pseudo-before');
    
    window.getComputedStyle = originalGetComputedStyle;
  });
});
```

### 9.2 Manual Verification Checklist

**WordPress Sites:**
- [ ] LaunchPad theme buttons show correct background color
- [ ] Elementor buttons detected correctly
- [ ] Backgrounds on ::before elements captured
- [ ] No false "transparent" backgrounds on visible elements

**Squarespace Sites:**
- [ ] Standard buttons use computed style
- [ ] Section backgrounds detected correctly
- [ ] No regression from previous implementation
- [ ] Gradient backgrounds handled properly

**Generic Sites:**
- [ ] Custom sites work without platform assumptions
- [ ] Indeterminate message shown when uncertain
- [ ] Canvas sampling used appropriately

---

## 10. Debugging

### 10.1 DEBUG Flag

**File**: `wxt-version/src/analyzers/backgroundDetectors/wordpressDetector.ts`

```typescript
// DEBUG flag - set to false to disable logging in production
const DEBUG = true;
```

**To enable/disable logging:**
1. Open `wordpressDetector.ts`
2. Change `const DEBUG = true;` to `const DEBUG = false;`
3. Rebuild the extension

**What gets logged:**
```
[WP-Detector] Analyzing <p> {isTextElement: true, initialBackgroundColor: "transparent"}
[WP-Detector] Skipping pseudo-elements for text element <p>
[WP-Detector] Walking DOM for text element background
[WP-Detector] DOM walk found: rgb(233, 240, 245) (#E9F0F5)
[WP-Detector] Using DOM walk result
```

**When to use:**
- ✅ Debugging background detection issues
- ✅ Verifying correct detection method is used
- ✅ Testing new WordPress themes
- ❌ Production builds (set to false to avoid console spam)

---

## 11. Performance Considerations

### 11.1 Complexity Analysis

| Method | Time | Notes |
|--------|------|-------|
| Computed Style | O(1) | Single API call |
| Pseudo-element | O(1) | Two API calls (::before, ::after) |
| CSS Rules | O(n) | n = number of stylesheets/rules |
| DOM Walking | O(d) | d = DOM depth (max 15) |
| Canvas | O(p) | p = pixels sampled (25 in 5x5 grid) |

### 11.2 Caching Strategy

- **Detector Instances**: Singleton pattern prevents recreation
- **Screenshot**: Reused across multiple elements in same analysis
- **Computed Styles**: Not cached (may change due to animations/hover)

### 11.3 Optimization Tips

1. **Early Exit**: Check cheapest methods first (computed vs pseudo)
2. **Button-only Canvas**: Expensive canvas sampling only for buttons
3. **Lazy Screenshot**: Only capture if canvas might be needed

---

## 12. Known Issues & Limitations

### 12.1 Current Limitations

1. **Cross-Origin Stylesheets**: Cannot access CSS rules from external domains
2. **Dynamic Backgrounds**: Animations and hover states may not be captured
3. **Complex Gradients**: Returns first solid color found, not gradient
4. **Overlapping Elements**: Canvas may sample wrong element (mitigated by elementFromPoint check)

### 12.2 Platform Gaps

- **Wix/Shopify/Webflow**: Using generic detector (no platform-specific issues reported yet)
- **Sub-platforms**: No Elementor/Divi-specific detectors yet

---

## 13. Change Log

### 2026-02-13 - Text Element Fix
- **Issue**: WordPress paragraphs returning #000000 instead of actual background (#E9F0F5)
- **Root Cause**: Decorative `::before` pseudo-elements being mistaken for backgrounds
- **Fix**: Text elements now skip pseudo-element checks and prioritize DOM walking
- **Added**: Suspicious color filtering (black/white rejection)
- **Added**: DEBUG flag for enhanced logging

---

## 14. Recreation Checklist

If this system needs to be recreated from scratch:

1. ✅ Create `types.ts` with interfaces and abstract class
2. ✅ Create `baseDetector.ts` with shared detection methods
3. ✅ Implement `wordpressDetector.ts` with:
   - Pseudo-element priority for non-text elements
   - DOM walking priority for text elements (p, span, a, etc.)
   - Suspicious color filtering (reject black/white pseudo-elements)
   - DEBUG flag for logging
4. ✅ Implement `squarespaceDetector.ts` with computed-style priority
5. ✅ Implement `genericDetector.ts` with conservative approach
6. ✅ Create `index.ts` factory with singleton caching
7. ✅ Update `colors.ts` to use `detectBackground()` function
8. ✅ Pass `platform` parameter through analyzer chain
9. ✅ Test on real WordPress and Squarespace sites
10. ✅ Test text elements specifically (paragraphs, spans)
11. ✅ Verify no regression on existing functionality
12. ✅ Set DEBUG = false for production builds

---

## 15. Related Code Locations

- **Entry Point**: `wxt-version/src/analyzers/backgroundDetectors/index.ts`
- **WordPress Detector**: `wxt-version/src/analyzers/backgroundDetectors/wordpressDetector.ts`
- **Integration**: `wxt-version/src/analyzers/colors.ts` (getEffectiveBackgroundColor)
- **Platform Detection**: `wxt-version/src/platforms/index.ts`
- **Usage in Analyzers**: `wxt-version/src/analyzers/buttons.ts`, `typography.ts`, etc.

---

**Document Version**: 1.1  
**Last Updated**: 2026-02-13  
**Author**: Engineering Team  
**Platform Coverage**: WordPress, Squarespace, Wix, Shopify, Webflow, Generic
