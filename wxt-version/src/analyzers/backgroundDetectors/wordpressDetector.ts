/**
 * WordPress background detector
 * Detection order: ::before → ::after → CSS classes → computed style → canvas (buttons) → indeterminate
 * Optimized for WordPress LaunchPad and themes that render backgrounds on pseudo-elements
 * 
 * IMPORTANT FIX (2026-02-13): Text elements (p, span, etc.) now skip pseudo-element checks
 * and prioritize DOM walking to find the actual container background, not decorative overlays.
 */

import { BaseBackgroundDetector } from './baseDetector';
import { DetectionContext, DetectionResult, DetectionMethod } from './types';

// DEBUG flag - set to false to disable logging in production
const DEBUG = true;

// Text elements that should skip pseudo-element detection
const TEXT_ELEMENTS = new Set(['p', 'span', 'a', 'strong', 'em', 'b', 'i', 'label', 'small']);

// Suspicious colors that are likely decorative overlays rather than actual backgrounds
const SUSPICIOUS_COLORS = new Set(['#000000', '#FFFFFF', '#000', '#FFF', '#00000000']);

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

    if (DEBUG) {
      console.log(`[WP-Detector] Analyzing <${tagName}>`, {
        isTextElement,
        initialBackgroundColor,
        hasScreenshot: !!screenshot
      });
    }

    // IMPORTANT FIX: For text elements (p, span, etc.), skip pseudo-element checks initially
    // and prioritize DOM walking to find the actual container background.
    // This prevents decorative ::before/::after elements (often black/white) from being
    // mistaken for the readable background.
    if (!isTextElement) {
      // Check ::before first for non-text elements - this is where LaunchPad frequently 
      // places the visible background for buttons and sections
      if (DEBUG) console.log(`[WP-Detector] Checking ::before pseudo-element`);
      
      const beforeResult = this.checkPseudoElement(element, '::before');
      if (beforeResult) {
        const beforeHex = this.rgbToHex(beforeResult.color);
        
        if (DEBUG) {
          console.log(`[WP-Detector] ::before found: ${beforeResult.color} (${beforeHex})`);
        }
        
        // Only accept pseudo-element result if it's not a suspicious color
        if (beforeHex && !SUSPICIOUS_COLORS.has(beforeHex)) {
          if (DEBUG) console.log(`[WP-Detector] Using ::before result`);
          return beforeResult;
        }
        
        if (DEBUG) {
          console.log(`[WP-Detector] ::before color ${beforeHex} is suspicious, continuing...`);
        }
      }

      // Check ::after second - alternative render location
      if (DEBUG) console.log(`[WP-Detector] Checking ::after pseudo-element`);
      
      const afterResult = this.checkPseudoElement(element, '::after');
      if (afterResult) {
        const afterHex = this.rgbToHex(afterResult.color);
        
        if (DEBUG) {
          console.log(`[WP-Detector] ::after found: ${afterResult.color} (${afterHex})`);
        }
        
        // Only accept pseudo-element result if it's not a suspicious color
        if (afterHex && !SUSPICIOUS_COLORS.has(afterHex)) {
          if (DEBUG) console.log(`[WP-Detector] Using ::after result`);
          return afterResult;
        }
        
        if (DEBUG) {
          console.log(`[WP-Detector] ::after color ${afterHex} is suspicious, continuing...`);
        }
      }
    } else {
      if (DEBUG) {
        console.log(`[WP-Detector] Skipping pseudo-elements for text element <${tagName}>`);
      }
    }

    // Check CSS class rules - finds "intended" background from CSS
    // This catches background-* and bg-* classes before falling back to computed style
    if (DEBUG) console.log(`[WP-Detector] Checking CSS class rules`);
    
    const cssResult = this.checkCssRules(element);
    if (cssResult) {
      if (DEBUG) console.log(`[WP-Detector] Using CSS rules result: ${cssResult.color}`);
      return cssResult;
    }

    // For text elements, DOM walking is prioritized to find the section/container background
    if (isTextElement) {
      if (DEBUG) console.log(`[WP-Detector] Walking DOM for text element background`);
      
      const domResult = this.walkDomForBackground(element);
      if (domResult) {
        const domHex = this.rgbToHex(domResult.color);
        
        if (DEBUG) {
          console.log(`[WP-Detector] DOM walk found: ${domResult.color} (${domHex})`);
        }
        
        // Accept DOM result unless it's suspicious
        if (domHex && !SUSPICIOUS_COLORS.has(domHex)) {
          if (DEBUG) console.log(`[WP-Detector] Using DOM walk result`);
          return domResult;
        }
        
        if (DEBUG) {
          console.log(`[WP-Detector] DOM walk color ${domHex} is suspicious, trying other methods...`);
        }
      }
    }

    // Check computed style - standard approach
    if (DEBUG) console.log(`[WP-Detector] Checking computed style`);
    
    if (initialBackgroundColor && initialBackgroundColor !== 'transparent') {
      const hex = this.rgbToHex(initialBackgroundColor);
      if (hex) {
        if (DEBUG) console.log(`[WP-Detector] Using initial background: ${initialBackgroundColor}`);
        return {
          color: initialBackgroundColor,
          details: `Initial background: ${initialBackgroundColor}`,
          method: 'computed-style',
        };
      }
    }

    const computedResult = this.checkComputedStyle(element);
    if (computedResult) {
      if (DEBUG) console.log(`[WP-Detector] Using computed style result: ${computedResult.color}`);
      return computedResult;
    }

    // For non-text elements, try DOM walking as fallback
    if (!isTextElement) {
      if (DEBUG) console.log(`[WP-Detector] Walking DOM as fallback`);
      
      const domResult = this.walkDomForBackground(element);
      if (domResult) {
        if (DEBUG) console.log(`[WP-Detector] Using DOM walk fallback: ${domResult.color}`);
        return domResult;
      }
    }

    // For button-like elements, use canvas verification as last resort
    if (this.isButtonLike(element) && screenshot) {
      if (DEBUG) console.log(`[WP-Detector] Trying canvas sampling for button`);
      
      const canvasResult = await this.sampleCanvas(element, screenshot);
      if (canvasResult) {
        if (DEBUG) console.log(`[WP-Detector] Using canvas result: ${canvasResult.color}`);
        return canvasResult;
      }
    }

    // All methods failed - return indeterminate
    if (DEBUG) {
      console.log(`[WP-Detector] All methods failed, returning indeterminate for <${tagName}>`);
    }
    
    return this.getIndeterminateResult();
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
