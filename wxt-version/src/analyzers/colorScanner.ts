// analyzers/colorScanner.ts
// Comprehensive color scanner for the entire page

import { type ColorData, trackColor, shouldTrackBorder } from './colors';
import { isTransparentColor } from '../utils/colorUtils';
import { isIconOrSocialElement, getSectionInfo, getBlockInfo } from '../utils/domHelpers';

/**
 * Scans ALL visible elements on the page to capture colors that might be missed
 * by element-specific analyzers (buttons, headings, paragraphs, links).
 */
export async function scanAllPageColors(colorData: ColorData): Promise<void> {
  if (!colorData) return;

  // Get ALL elements on the page
  const allElements = document.querySelectorAll('*');

  for (let i = 0; i < allElements.length; i++) {
    const element = allElements[i] as HTMLElement; // Cast to HTMLElement

    // Skip script, style, noscript, and other non-visual elements
    const tagName = element.tagName.toLowerCase();
    if (
      tagName === 'script' ||
      tagName === 'style' ||
      tagName === 'noscript' ||
      tagName === 'meta' ||
      tagName === 'link' ||
      tagName === 'head'
    ) {
      continue;
    }

    try {
      const computed = window.getComputedStyle(element);
      if (!computed) continue;

      // Get bounding rect to check visibility
      const rect = element.getBoundingClientRect();
      const hasVisibleDimensions = rect.width > 0 && rect.height > 0;

      // Check basic computed style visibility
      const isDisplayed = computed.display !== 'none';
      const isVisible = computed.visibility !== 'hidden';
      const hasOpacity = parseFloat(computed.opacity) > 0;

      // Element is considered visible if it has dimensions and basic visibility
      let isElementVisible = hasVisibleDimensions && isDisplayed && isVisible && hasOpacity;

      // Special handling for footer elements - be more lenient with visibility checks
      let isInFooter = false;
      let parent: Element | null = element;
      let depth = 0;
      while (parent && depth < 10) {
        const parentTag = parent.tagName ? parent.tagName.toLowerCase() : '';
        const parentClass = parent.className || '';
        const parentId = parent.id || '';
        if (
          parentTag === 'footer' ||
          parentClass.toLowerCase().includes('footer') ||
          parentId.toLowerCase().includes('footer')
        ) {
          isInFooter = true;
          break;
        }
        parent = parent.parentElement;
        depth++;
      }

      // For footer elements, check if they're on the page even if off-screen (e.g. scrolled away)
      if (isInFooter && hasVisibleDimensions && isDisplayed && isVisible) {
        isElementVisible = true;
      }

      if (!isElementVisible) {
        continue;
      }

      // Skip elements already processed by specific analyzers to avoid duplicate tracking
      if (colorData._processedElements && colorData._processedElements.has(element)) {
        continue;
      }

      // Skip icons and social media elements
      if (isIconOrSocialElement(element)) {
        continue;
      }

      // Helper function to check if a color is explicitly set (not inherited)
      const isColorExplicitlySet = (el: HTMLElement, property: any): boolean => {
        // Get inline style (using any to access property by name)
        const inlineStyle = (el.style as any)[property];
        if (inlineStyle && inlineStyle !== '') return true;

        // Check if element has any class or ID that might set this color
        // If element has no class and no ID, color is likely inherited
        if (!el.className && !el.id) return false;

        return true; // Assume explicitly set if element has styling hooks
      };

      const bgColor = computed.backgroundColor;
      const textColor = computed.color;

      // Track background color
      if (bgColor && !isTransparentColor(bgColor)) {
        // Only track if background is likely explicitly set or is a significant container
        const hasSignificantSize = rect.width > 100 || rect.height > 100;
        if (
          isColorExplicitlySet(element, 'backgroundColor') ||
          hasSignificantSize ||
          element.style.backgroundColor
        ) {
          await trackColor(
            bgColor,
            element,
            'background-color',
            textColor,
            colorData,
            getSectionInfo,
            getBlockInfo
          );
        }
      }

      // Track text color (only for leaf elements with direct text, not containers)
      let hasDirectTextNode = false;
      for (let j = 0; j < element.childNodes.length; j++) {
        const node = element.childNodes[j];
        if (node.nodeType === 3 && node.textContent?.trim().length! > 0) {
          // 3 = TEXT_NODE
          hasDirectTextNode = true;
          break;
        }
      }

      if (hasDirectTextNode && textColor && !isTransparentColor(textColor)) {
        await trackColor(
          textColor,
          element,
          'color',
          bgColor,
          colorData,
          getSectionInfo,
          getBlockInfo
        );
      }

      // Track border colors
      const borderSides = [
        {
          color: computed.borderTopColor,
          width: parseFloat(computed.borderTopWidth) || 0,
          style: computed.borderTopStyle,
        },
        {
          color: computed.borderRightColor,
          width: parseFloat(computed.borderRightWidth) || 0,
          style: computed.borderRightStyle,
        },
        {
          color: computed.borderBottomColor,
          width: parseFloat(computed.borderBottomWidth) || 0,
          style: computed.borderBottomStyle,
        },
        {
          color: computed.borderLeftColor,
          width: parseFloat(computed.borderLeftWidth) || 0,
          style: computed.borderLeftStyle,
        },
      ];

      const trackedBorderColors = new Set<string>();
      const currentBgColor = computed.backgroundColor;

      for (const side of borderSides) {
        if (
          shouldTrackBorder(side.color, side.width, side.style, currentBgColor) &&
          !trackedBorderColors.has(side.color)
        ) {
          trackedBorderColors.add(side.color);
          trackColor(
            side.color,
            element,
            'border-color',
            null,
            colorData,
            getSectionInfo,
            getBlockInfo
          );
        }
      }

      // Track SVG fill and stroke colors
      if (
        element.tagName === 'svg' ||
        element.tagName === 'SVG' ||
        (element as unknown as SVGElement).ownerSVGElement ||
        element.closest('svg')
      ) {
        const fillColor = computed.fill;
        const strokeColor = computed.stroke;

        if (fillColor && !isTransparentColor(fillColor) && fillColor !== 'none') {
          trackColor(fillColor, element, 'fill', null, colorData, getSectionInfo, getBlockInfo);
        }

        if (strokeColor && !isTransparentColor(strokeColor) && strokeColor !== 'none') {
          trackColor(strokeColor, element, 'stroke', null, colorData, getSectionInfo, getBlockInfo);
        }
      }
    } catch (e) {
      // Ignore errors for individual elements
    }
  }
}
