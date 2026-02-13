/**
 * Generic background detector
 * Detection order: computed style → CSS classes → ::before → ::after → DOM walking → canvas → indeterminate
 * Conservative approach for unknown platforms
 */

import { BaseBackgroundDetector } from './baseDetector';
import { DetectionContext, DetectionResult, DetectionMethod } from './types';

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
    if (computedResult) {
      return computedResult;
    }

    // Check CSS classes for background patterns
    const cssResult = this.checkCssRules(element);
    if (cssResult) {
      return cssResult;
    }

    // Check pseudo-elements as fallback
    const beforeResult = this.checkPseudoElement(element, '::before');
    if (beforeResult) {
      return beforeResult;
    }

    const afterResult = this.checkPseudoElement(element, '::after');
    if (afterResult) {
      return afterResult;
    }

    // Walk DOM tree if all else fails
    const domResult = this.walkDomForBackground(element);
    if (domResult) {
      return domResult;
    }

    // Canvas sampling as last resort
    if (screenshot) {
      const canvasResult = await this.sampleCanvas(element, screenshot);
      if (canvasResult) {
        return canvasResult;
      }
    }

    // Return indeterminate - don't assume white for unknown platforms
    return this.getIndeterminateResult();
  }
}
