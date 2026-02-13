/**
 * Base background detector with shared utilities
 * DRY: All platform-specific detectors extend this
 */

import { rgbToHex, isTransparentColor } from '../../utils/colorUtils';
import {
  DetectionContext,
  DetectionResult,
  DetectionMethod,
  BackgroundDetector,
  DetectorConfig,
} from './types';

export abstract class BaseBackgroundDetector extends BackgroundDetector {
  constructor(config: DetectorConfig) {
    super(config);
  }

  /**
   * Check pseudo-element for background color
   * Shared across all platforms
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
      // Pseudo-element access can fail, ignore
    }
    return null;
  }

  /**
   * Check computed style on element
   * Shared across all platforms
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

  /**
   * Walk up DOM tree to find background
   * Shared across all platforms
   */
  protected walkDomForBackground(startElement: Element): DetectionResult | null {
    let el: Element | null = startElement;
    let depth = 0;
    const maxDepth = 15;

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

  /**
   * Check CSS rules for background classes
   * Shared across all platforms
   */
  protected checkCssRules(element: Element): DetectionResult | null {
    const classList = Array.from(element.classList);
    const backgroundPatterns = ['background', 'bg', 'backdrop'];

    // Find matching background classes (excluding .is-style-*)
    const matchingClasses = classList.filter(cls => {
      if (cls.startsWith('is-style-')) return false;
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

  /**
   * Sample canvas for background color
   * Used for button verification and complex backgrounds
   * 
   * IMPORTANT: Includes validation to prevent "identity crisis" where overlapping
   * elements or borders cause incorrect color sampling. Uses elementFromPoint
   * to verify the sampled area belongs to the target element.
   */
  protected async sampleCanvas(
    element: Element,
    screenshot: string | null
  ): Promise<DetectionResult | null> {
    if (!screenshot) return null;

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    try {
      // CRITICAL: Validate that the center point actually belongs to this element
      // This prevents sampling errors when elements overlap or have borders
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Check what's actually at the center point
      const elementAtPoint = document.elementFromPoint(centerX, centerY);
      
      // If something else is on top, canvas sampling may be unreliable
      if (elementAtPoint && !element.contains(elementAtPoint) && elementAtPoint !== element) {
        console.warn('[SSA] Canvas sampling skipped: Element overlap detected at center point', {
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

      // Sample 5x5 grid with outlier rejection for border handling
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

      // IMPORTANT: Use median instead of mean to reduce impact of borders/edges
      // Sort each channel and take the middle value for more robust sampling
      const sortedR = colors.map(c => c.r).sort((a, b) => a - b);
      const sortedG = colors.map(c => c.g).sort((a, b) => a - b);
      const sortedB = colors.map(c => c.b).sort((a, b) => a - b);
      const sortedA = colors.map(c => c.a).sort((a, b) => a - b);
      
      const mid = Math.floor(colors.length / 2);
      const medianR = sortedR[mid];
      const medianG = sortedG[mid];
      const medianB = sortedB[mid];
      const medianA = sortedA[mid];

      const rgba = `rgba(${medianR}, ${medianG}, ${medianB}, ${medianA})`;

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

  /**
   * Return indeterminate result
   */
  protected getIndeterminateResult(): DetectionResult {
    return {
      color: null,
      details: 'Indeterminate: Complex background layers. Verify manually with color check tool.',
      method: 'indeterminate',
    };
  }

  /**
   * Check if element is button-like
   */
  protected isButtonLike(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    const isButton = tagName === 'button' || tagName === 'a' || tagName === 'input';
    const hasButtonRole = element.getAttribute('role') === 'button';
    const hasButtonClass = (element.className || '').toLowerCase().includes('button');
    return isButton || hasButtonRole || hasButtonClass;
  }

  /**
   * Main detection method - to be implemented by subclasses
   */
  abstract detect(context: DetectionContext): Promise<DetectionResult>;
}
