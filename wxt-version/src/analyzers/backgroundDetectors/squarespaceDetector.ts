/**
 * Squarespace background detector
 * Detection order: clicked-element → dom-walk-parent → section-css-var → css-class-rules → pseudo → dom-walk-fallback → indeterminate
 * Squarespace 7.1 uses CSS custom properties (--siteBackgroundColor) on <section> elements
 */

import { rgbToHex, isTransparentColor } from '../../utils/colorUtils';
import { BaseBackgroundDetector } from './baseDetector';
import { DetectionContext, DetectionResult, DetectionMethod } from './types';

const WHITE_HSLA = 'hsla(0,0%,100%,1)';
const WHITE_RGBA = 'rgba(255, 255, 255, 1)';
const WHITE_HEX = '#ffffff';

export class SquarespaceBackgroundDetector extends BaseBackgroundDetector {
  constructor() {
    super({
      name: 'Squarespace Background Detector',
      platform: 'squarespace',
    });
  }

  getDetectionOrder(): DetectionMethod[] {
    return [
      'clicked-element',
      'dom-walk-parent',
      'section-css-var',
      'css-class-rules',
      'pseudo-before',
      'pseudo-after',
      'dom-walk',
      'indeterminate',
    ];
  }

  async detect(context: DetectionContext): Promise<DetectionResult> {
    const { element, screenshot, initialBackgroundColor, clickCoordinates } = context;

    if (initialBackgroundColor && initialBackgroundColor !== 'transparent') {
      return {
        color: initialBackgroundColor,
        details: `Initial background: ${initialBackgroundColor}`,
        method: 'computed-style',
      };
    }

    const clickedElementResult = this.checkClickedElement(element);
    if (clickedElementResult) {
      return clickedElementResult;
    }

    const domWalkParentResult = this.walkDomFromParent(element);
    if (domWalkParentResult) {
      return domWalkParentResult;
    }

    const sectionResult = await this.detectFromSectionCssVariable(element, clickCoordinates);
    if (sectionResult) {
      return sectionResult;
    }

    const cssRulesResult = this.checkCssRules(element);
    if (cssRulesResult) {
      return {
        ...cssRulesResult,
        method: 'css-class-rules',
      };
    }

    const pseudoBeforeResult = this.checkPseudoElement(element, '::before');
    if (pseudoBeforeResult) {
      return pseudoBeforeResult;
    }

    const pseudoAfterResult = this.checkPseudoElement(element, '::after');
    if (pseudoAfterResult) {
      return pseudoAfterResult;
    }

    const domWalkFallbackResult = this.walkDomForBackground(element);
    if (domWalkFallbackResult) {
      return {
        ...domWalkFallbackResult,
        method: 'dom-walk',
      };
    }

    if (this.isButtonLike(element) && screenshot) {
      try {
        const canvasResult = await this.sampleCanvas(element, screenshot);
        if (canvasResult) {
          return canvasResult;
        }
      } catch (e) {
        // Canvas failed, continue to indeterminate
      }
    }

    return this.getIndeterminateResult();
  }

  private checkClickedElement(element: Element): DetectionResult | null {
    try {
      const style = window.getComputedStyle(element);
      const bgColor = style.backgroundColor;

      if (bgColor && !isTransparentColor(bgColor)) {
        const hex = rgbToHex(bgColor);

        if (element.tagName === 'BODY' && hex === '#FFFFFF') {
          return null;
        }

        if (hex) {
          return {
            color: bgColor,
            details: `Clicked element (${element.tagName}): ${bgColor}`,
            method: 'clicked-element',
          };
        }
      }
    } catch (e) {
      console.warn('[SSA] Error checking clicked element:', e);
    }
    return null;
  }

  private walkDomFromParent(startElement: Element): DetectionResult | null {
    let currentEl: Element | null = startElement.parentElement;

    while (currentEl && currentEl !== document.body) {
      try {
        const style = window.getComputedStyle(currentEl);
        const bg = style.backgroundColor;

        if (bg && !isTransparentColor(bg)) {
          const hex = rgbToHex(bg);
          if (hex) {
            return {
              color: bg,
              details: `DOM walk parent: ${currentEl.tagName} - ${bg}`,
              method: 'dom-walk-parent',
            };
          }
        }
      } catch (e) {
        // Skip elements that throw
      }
      currentEl = currentEl.parentElement;
    }

    return null;
  }

  private async detectFromSectionCssVariable(
    element: Element,
    clickCoordinates: { x: number; y: number } | null | undefined
  ): Promise<DetectionResult | null> {
    let section: Element | null = null;

    if (clickCoordinates) {
      try {
        const elementAtPoint = document.elementFromPoint(clickCoordinates.x, clickCoordinates.y);
        if (elementAtPoint) {
          section = elementAtPoint.closest('section');
        }
      } catch (e) {
        console.warn('[SSA] Error with elementFromPoint:', e);
      }
    }

    if (!section) {
      const allSections = document.querySelectorAll('section');
      if (allSections.length === 0) return null;

      const elementRect = element.getBoundingClientRect();
      const elementCenterX = elementRect.left + elementRect.width / 2;
      const elementCenterY = elementRect.top + elementRect.height / 2;

      for (let i = 0; i < allSections.length; i++) {
        const sec = allSections[i];
        const rect = sec.getBoundingClientRect();
        const isInRect =
          elementCenterY >= rect.top && elementCenterY <= rect.bottom &&
          elementCenterX >= rect.left && elementCenterX <= rect.right;

        if (isInRect) {
          section = sec;
          break;
        }
      }
    }

    if (!section) return null;

    try {
      const style = window.getComputedStyle(section);
      const cssVarValue = style.getPropertyValue('--siteBackgroundColor').trim();

      if (
        cssVarValue &&
        cssVarValue !== WHITE_HSLA &&
        cssVarValue !== WHITE_RGBA &&
        cssVarValue !== WHITE_HEX &&
        !isTransparentColor(cssVarValue)
      ) {
        const hex = rgbToHex(cssVarValue);
        if (hex) {
          return {
            color: cssVarValue,
            details: `Section CSS Variable: ${cssVarValue}`,
            method: 'section-css-var',
          };
        }
      }
    } catch (e) {
      console.warn('[SSA] Error detecting section CSS variable:', e);
    }

    return null;
  }
}
