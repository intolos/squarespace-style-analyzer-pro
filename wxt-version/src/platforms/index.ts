export type Platform = 'squarespace' | 'wordpress' | 'wix' | 'shopify' | 'webflow' | 'generic';

export interface PlatformInfo {
  platform: Platform;
  detected: boolean;
  factorCount: number;
  message: string;
}

/**
 * Detects the website platform and returns platform-specific information.
 * This function is executed in the context of the web page.
 *
 * IMPORTANT: Factor counts are based on documented research:
 * - Squarespace: 40 factors (squarespace-specific-elements.md)
 * - WordPress: 50 factors (wordpress-specific-elements.md)
 * - Wix: 45 factors (wix-specific-elements.md)
 * - Shopify: 47 factors (shopify-specific-elements.md)
 * - Webflow: 52 factors (webflow-specific-elements.md)
 */
export function detectPlatform(): PlatformInfo {
  // Squarespace detection - most specific, check first
  const isSqs = !!(
    document.querySelector('meta[name="generator"][content*="Squarespace"]') ||
    document.querySelector('.sqs-block') ||
    document.querySelector('[data-section-id]') ||
    document.querySelector('[data-block-id]')
  );

  if (isSqs) {
    return {
      platform: 'squarespace',
      detected: true,
      factorCount: 40,
      message: 'Squarespace detected. Using 40 platform-specific analysis factors.',
    };
  }

  // Shopify detection - check before generic WordPress
  const isShopify = !!(
    document.querySelector('meta[name="shopify-checkout-api-token"]') ||
    document.querySelector('link[href*="/cdn/shop/"]') ||
    document.querySelector('link[href*="cdn.shopify.com"]') ||
    document.querySelector('script[src*="cdn.shopify.com"]') ||
    document.querySelector('.shopify-section') ||
    document.querySelector('.shopify-payment-button') ||
    document.querySelector('[data-shopify]') ||
    window.location.hostname.includes('myshopify.com') ||
    (window as any).Shopify !== undefined
  );

  if (isShopify) {
    return {
      platform: 'shopify',
      detected: true,
      factorCount: 47,
      message: 'Shopify detected. Using 47 platform-specific analysis factors.',
    };
  }

  // Webflow detection - unique data-wf attributes
  const isWebflow = !!(
    document.querySelector('meta[name="generator"][content*="Webflow"]') ||
    document.querySelector('html[data-wf-domain]') ||
    document.querySelector('html[data-wf-site]') ||
    document.querySelector('.w-nav')
  );

  if (isWebflow) {
    return {
      platform: 'webflow',
      detected: true,
      factorCount: 52,
      message: 'Webflow detected. Using 52 platform-specific analysis factors.',
    };
  }

  // WordPress detection
  const isWP = !!(
    document.querySelector('meta[name="generator"][content*="WordPress"]') ||
    document.querySelector('.wp-block') ||
    document.querySelector('#wpadminbar') ||
    document.querySelector('link[href*="wp-content"]')
  );

  if (isWP) {
    return {
      platform: 'wordpress',
      detected: true,
      factorCount: 50,
      message: 'WordPress detected. Using 50 platform-specific analysis factors.',
    };
  }

  // Wix detection
  const isWix = !!(
    document.querySelector('meta[name="generator"][content*="Wix"]') ||
    document.querySelector('[id^="comp-"]') ||
    document.querySelector('[data-mesh-id]')
  );

  if (isWix) {
    return {
      platform: 'wix',
      detected: true,
      factorCount: 45,
      message: 'Wix detected. Using 45 platform-specific analysis factors.',
    };
  }

  // Generic fallback - no platform-specific factors
  return {
    platform: 'generic',
    detected: false,
    factorCount: 0,
    message: '',
  };
}
