/**
 * Squarespace background detector
 * Detection order: computed style → DOM walking → ::before → ::after → canvas (buttons) → indeterminate
 * Uses standard CSS approach optimized for Squarespace's architecture
 */

import { BaseBackgroundDetector } from './baseDetector';
import { DetectionContext, DetectionResult, DetectionMethod } from './types';

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

    // IMPORTANT: Squarespace uses standard CSS with backgrounds on actual elements
    // Check computed style first - this is the reliable approach for Squarespace
    if (initialBackgroundColor && initialBackgroundColor !== 'transparent') {
      return {
        color: initialBackgroundColor,
        details: `Initial background: ${initialBackgroundColor}`,
        method: 'computed-style',
      };
    }

    const computedResult = this.checkComputedStyle(element);
    if (computedResult) {
      return computedResult;
    }

    // Walk up DOM tree if element has transparent background
    // This handles nested containers where background is on ancestor
    const domResult = this.walkDomForBackground(element);
    if (domResult) {
      return domResult;
    }

    // Check pseudo-elements - these are typically decorative in Squarespace
    // (icons, underlines, etc.) but check them as fallback
    const beforeResult = this.checkPseudoElement(element, '::before');
    if (beforeResult) {
      return beforeResult;
    }

    const afterResult = this.checkPseudoElement(element, '::after');
    if (afterResult) {
      return afterResult;
    }

    // For button-like elements, use canvas to verify actual rendered background
    // This catches cases where DOM says one thing but screen shows another
    if (this.isButtonLike(element) && screenshot) {
      try {
        const canvasResult = await this.sampleCanvas(element, screenshot);
        if (canvasResult) {
          // Compare with DOM result if we had one
          const domBg = await this.getDomBackground(element);
          if (domBg) {
            const domHex = this.rgbToHex(domBg);
            const canvasHex = this.rgbToHex(canvasResult.color);
            if (domHex && canvasHex && domHex !== canvasHex) {
              return {
                color: canvasResult.color,
                details: `Canvas shows different color than DOM. Using canvas: ${canvasResult.color} (DOM had: ${domBg})`,
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

    // Fallback to white if nothing found
    return {
      color: 'rgb(255, 255, 255)',
      details: 'No background found, using white fallback',
      method: 'computed-style',
    };
  }

  /**
   * Get background from DOM walking only
   */
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

  /**
   * Convert RGB to Hex (local copy to avoid import issues)
   */
  private rgbToHex(rgb: string | null): string | null {
    if (!rgb) return null;
    if (rgb.startsWith('#')) return rgb.toUpperCase();

    const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
    if (!match) return null;

    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);

    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
  }
}
