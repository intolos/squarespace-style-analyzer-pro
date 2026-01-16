// analyzers/styleExtractor.ts
// Extracts style definitions and tracks colors for elements

import { type ColorData, trackColor, trackContrastPair } from './colors';
import { isTransparentColor } from '../utils/colorUtils';
import { isIconOrSocialElement, getSectionInfo, getBlockInfo } from '../utils/domHelpers';

/**
 * Gets the style definition string for an element and tracks its colors
 */
export async function getStyleDefinition(
  element: HTMLElement,
  elementType: string,
  colorTracker: any, // Legacy tracker, kept for compat if needed, or we can type it if simple
  colorData: ColorData
): Promise<string> {
  try {
    const computed = window.getComputedStyle(element);
    const styleDef: string[] = [];

    // Skip color tracking for icons and social media elements
    const isIcon = isIconOrSocialElement(element);

    // Skip color tracking for non-visible elements
    const rect = element.getBoundingClientRect();
    const hasVisibleDimensions = rect.width > 0 && rect.height > 0;
    const isDisplayed = computed.display !== 'none';
    const isVisible = computed.visibility !== 'hidden';
    const hasOpacity = parseFloat(computed.opacity) > 0;
    const isElementVisible = hasVisibleDimensions && isDisplayed && isVisible && hasOpacity;

    if (!isIcon && isElementVisible) {
      // Mark this element as processed
      if (colorData._processedElements) {
        colorData._processedElements.add(element);
      }

      const bgColor = computed.backgroundColor;
      const textColor = computed.color;

      trackColor(
        bgColor,
        element,
        'background-color',
        textColor,
        colorData,
        getSectionInfo,
        getBlockInfo
      );

      trackColor(textColor, element, 'color', bgColor, colorData, getSectionInfo, getBlockInfo);

      // Track border colors (check all four sides)
      const borderSides = [
        {
          color: computed.borderTopColor,
          width: parseFloat(computed.borderTopWidth) || 0,
        },
        {
          color: computed.borderRightColor,
          width: parseFloat(computed.borderRightWidth) || 0,
        },
        {
          color: computed.borderBottomColor,
          width: parseFloat(computed.borderBottomWidth) || 0,
        },
        {
          color: computed.borderLeftColor,
          width: parseFloat(computed.borderLeftWidth) || 0,
        },
      ];

      const trackedBorderColors = new Set<string>();
      borderSides.forEach(side => {
        if (
          side.color &&
          !isTransparentColor(side.color) &&
          side.width > 0 &&
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
      });

      // Track contrast for text elements
      if (
        elementType === 'heading' ||
        elementType === 'paragraph' ||
        elementType === 'text' ||
        elementType === 'button'
      ) {
        // Note: We might need to pass 'screenshot' logic here if we want high-fidelity background detection.
        // For now, we'll pass null for screenshot unless we have a way to access it available globally or passed in.
        // The original logic awaited this.
        await trackContrastPair(
          element,
          textColor,
          bgColor,
          colorData,
          getSectionInfo,
          getBlockInfo,
          null
        );
      }

      // Legacy color tracker support (if needed)
      if (colorTracker) {
        // Implement if strictly required, otherwise assume ColorData is the source of truth
      }
    }

    // Build style definition string based on element type
    if (elementType === 'button') {
      styleDef.push('background-color: ' + computed.backgroundColor);
      styleDef.push('color: ' + computed.color);
      styleDef.push('font-family: ' + computed.fontFamily);
      styleDef.push('font-size: ' + computed.fontSize);
      styleDef.push('font-weight: ' + computed.fontWeight);
      styleDef.push('border-radius: ' + computed.borderRadius);
      styleDef.push('padding: ' + computed.padding);
      styleDef.push('border: ' + computed.border);
      if (computed.textAlign !== 'start' && computed.textAlign !== 'left')
        styleDef.push('text-align: ' + computed.textAlign);
      if (computed.textTransform !== 'none')
        styleDef.push('text-transform: ' + computed.textTransform);
    } else if (elementType === 'heading' || elementType === 'paragraph' || elementType === 'text') {
      styleDef.push('font-family: ' + computed.fontFamily);
      styleDef.push('font-size: ' + computed.fontSize);
      styleDef.push('font-weight: ' + computed.fontWeight);
      styleDef.push('line-height: ' + computed.lineHeight);
      styleDef.push('color: ' + computed.color);
      if (computed.textTransform !== 'none')
        styleDef.push('text-transform: ' + computed.textTransform);
      if (computed.letterSpacing !== 'normal' && computed.letterSpacing !== '0px')
        styleDef.push('letter-spacing: ' + computed.letterSpacing);
    } else {
      const display = computed.display;
      if (display !== 'inline') styleDef.push('display: ' + display);
      if (computed.backgroundColor && !isTransparentColor(computed.backgroundColor)) {
        styleDef.push('background-color: ' + computed.backgroundColor);
      }
    }

    return styleDef.join('; ');
  } catch (e) {
    console.warn('Error extracting style definition:', e);
    return '';
  }
}
