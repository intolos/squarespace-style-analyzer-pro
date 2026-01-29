import * as SQS from './squarespace/selectors';
import * as WP from './wordpress/selectors';
import * as WIX from './wix/selectors';
import * as SHOPIFY from './shopify/selectors';
import * as WEBFLOW from './webflow/selectors';
import * as GENERIC from './generic/selectors';
import { Platform } from './index';

export interface PlatformSelectors {
  buttons: string[];
  nav: string[];
  headings: string[];
  paragraphs: string[];
  images: string[];
  links: string[];
  sections: string[];
  blocks: string[];
  dataAttributes?: string[];
  unstableIdPatterns?: RegExp[];
}

export class PlatformSelectorManager {
  static getSelectors(platform: Platform): PlatformSelectors {
    // Helper to merge generic fallback
    const withGeneric = (specific: string[], generic: string[]) => {
      // Create Set to remove duplicates
      return [...new Set([...specific, ...generic])];
    };

    switch (platform) {
      case 'squarespace':
        // Squarespace is highly specific, often doesn't need generic fallback
        // but we include them just in case for mixed content
        return {
          buttons: withGeneric(SQS.SQS_BUTTON_SELECTORS, GENERIC.GENERIC_BUTTON_SELECTORS),
          nav: withGeneric(SQS.SQS_NAV_SELECTORS, GENERIC.GENERIC_NAV_SELECTORS),
          headings: withGeneric(SQS.SQS_HEADING_SELECTORS, GENERIC.GENERIC_HEADING_SELECTORS),
          paragraphs: withGeneric(SQS.SQS_PARAGRAPH_SELECTORS, GENERIC.GENERIC_PARAGRAPH_SELECTORS),
          images: withGeneric(SQS.SQS_IMAGE_SELECTORS, GENERIC.GENERIC_IMAGE_SELECTORS),
          links: withGeneric(SQS.SQS_LINK_SELECTORS, GENERIC.GENERIC_LINK_SELECTORS),
          sections: SQS.SQS_SECTION_SELECTORS,
          blocks: SQS.SQS_BLOCK_SELECTORS,
          dataAttributes: SQS.SQS_DATA_ATTRIBUTES,
        };
      case 'wordpress':
        return {
          buttons: withGeneric(WP.WP_BUTTON_SELECTORS, GENERIC.GENERIC_BUTTON_SELECTORS),
          nav: withGeneric(WP.WP_NAV_SELECTORS, GENERIC.GENERIC_NAV_SELECTORS),
          headings: withGeneric(WP.WP_HEADING_SELECTORS, GENERIC.GENERIC_HEADING_SELECTORS),
          paragraphs: withGeneric(WP.WP_PARAGRAPH_SELECTORS, GENERIC.GENERIC_PARAGRAPH_SELECTORS),
          images: withGeneric(WP.WP_IMAGE_SELECTORS, GENERIC.GENERIC_IMAGE_SELECTORS),
          links: withGeneric(WP.WP_LINK_SELECTORS, GENERIC.GENERIC_LINK_SELECTORS),
          sections: WP.WP_SECTION_SELECTORS,
          blocks: WP.WP_BLOCK_SELECTORS,
          dataAttributes: WP.WP_DATA_ATTRIBUTES,
          unstableIdPatterns: WP.WP_UNSTABLE_ID_PATTERNS,
        };
      case 'wix':
        return {
          buttons: withGeneric(WIX.WIX_BUTTON_SELECTORS, GENERIC.GENERIC_BUTTON_SELECTORS),
          nav: withGeneric(WIX.WIX_NAV_SELECTORS, GENERIC.GENERIC_NAV_SELECTORS),
          headings: withGeneric(WIX.WIX_HEADING_SELECTORS, GENERIC.GENERIC_HEADING_SELECTORS),
          paragraphs: withGeneric(WIX.WIX_PARAGRAPH_SELECTORS, GENERIC.GENERIC_PARAGRAPH_SELECTORS),
          images: withGeneric(WIX.WIX_IMAGE_SELECTORS, GENERIC.GENERIC_IMAGE_SELECTORS),
          links: withGeneric(WIX.WIX_LINK_SELECTORS, GENERIC.GENERIC_LINK_SELECTORS),
          sections: WIX.WIX_SECTION_SELECTORS,
          blocks: WIX.WIX_BLOCK_SELECTORS,
          dataAttributes: WIX.WIX_DATA_ATTRIBUTES,
          unstableIdPatterns: WIX.WIX_UNSTABLE_ID_PATTERNS,
        };
      case 'shopify':
        return {
          buttons: withGeneric(SHOPIFY.SHOPIFY_BUTTON_SELECTORS, GENERIC.GENERIC_BUTTON_SELECTORS),
          nav: withGeneric(SHOPIFY.SHOPIFY_NAV_SELECTORS, GENERIC.GENERIC_NAV_SELECTORS),
          headings: withGeneric(
            SHOPIFY.SHOPIFY_HEADING_SELECTORS,
            GENERIC.GENERIC_HEADING_SELECTORS
          ),
          paragraphs: withGeneric(
            SHOPIFY.SHOPIFY_PARAGRAPH_SELECTORS,
            GENERIC.GENERIC_PARAGRAPH_SELECTORS
          ),
          images: withGeneric(SHOPIFY.SHOPIFY_IMAGE_SELECTORS, GENERIC.GENERIC_IMAGE_SELECTORS),
          links: withGeneric(SHOPIFY.SHOPIFY_LINK_SELECTORS, GENERIC.GENERIC_LINK_SELECTORS),
          sections: SHOPIFY.SHOPIFY_SECTION_SELECTORS,
          blocks: SHOPIFY.SHOPIFY_BLOCK_SELECTORS,
          dataAttributes: SHOPIFY.SHOPIFY_DATA_ATTRIBUTES,
          unstableIdPatterns: SHOPIFY.SHOPIFY_UNSTABLE_ID_PATTERNS,
        };
      case 'webflow':
        return {
          buttons: withGeneric(WEBFLOW.WEBFLOW_BUTTON_SELECTORS, GENERIC.GENERIC_BUTTON_SELECTORS),
          nav: withGeneric(WEBFLOW.WEBFLOW_NAV_SELECTORS, GENERIC.GENERIC_NAV_SELECTORS),
          headings: withGeneric(
            WEBFLOW.WEBFLOW_HEADING_SELECTORS,
            GENERIC.GENERIC_HEADING_SELECTORS
          ),
          paragraphs: withGeneric(
            WEBFLOW.WEBFLOW_PARAGRAPH_SELECTORS,
            GENERIC.GENERIC_PARAGRAPH_SELECTORS
          ),
          images: withGeneric(WEBFLOW.WEBFLOW_IMAGE_SELECTORS, GENERIC.GENERIC_IMAGE_SELECTORS),
          links: withGeneric(WEBFLOW.WEBFLOW_LINK_SELECTORS, GENERIC.GENERIC_LINK_SELECTORS),
          sections: WEBFLOW.WEBFLOW_SECTION_SELECTORS,
          blocks: WEBFLOW.WEBFLOW_BLOCK_SELECTORS,
          dataAttributes: WEBFLOW.WEBFLOW_DATA_ATTRIBUTES,
          unstableIdPatterns: WEBFLOW.WEBFLOW_UNSTABLE_ID_PATTERNS,
        };
      default:
        // Generic fallback
        return {
          buttons: GENERIC.GENERIC_BUTTON_SELECTORS,
          nav: GENERIC.GENERIC_NAV_SELECTORS,
          headings: GENERIC.GENERIC_HEADING_SELECTORS,
          paragraphs: GENERIC.GENERIC_PARAGRAPH_SELECTORS,
          images: GENERIC.GENERIC_IMAGE_SELECTORS,
          links: GENERIC.GENERIC_LINK_SELECTORS,
          sections: [],
          blocks: [],
          dataAttributes: [],
        };
    }
  }
}
