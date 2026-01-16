export type Platform = 'squarespace' | 'wordpress' | 'wix' | 'webflow' | 'generic';

export interface PlatformInfo {
  platform: Platform;
  detected: boolean;
  elementCount: number;
  message: string;
}

export function detectPlatform(): PlatformInfo {
  // Squarespace detection
  const isSqs = !!(
    document.querySelector('meta[name="generator"][content*="Squarespace"]') ||
    document.querySelector('.sqs-block')
  );

  if (isSqs) {
    return {
      platform: 'squarespace',
      detected: true,
      elementCount: 15,
      message: `We have detected a Squarespace website. We have automatically included 15 Squarespace-specific elements into our analysis.`,
    };
  }

  // WordPress detection
  const isWP = !!(
    document.querySelector('meta[name="generator"][content*="WordPress"]') ||
    document.querySelector('.wp-block')
  );

  if (isWP) {
    return {
      platform: 'wordpress',
      detected: true,
      elementCount: 0, // TBD
      message: `We have detected a WordPress website.`,
    };
  }

  // Wix detection
  const isWix = !!(
    document.querySelector('meta[name="generator"][content*="Wix"]') ||
    document.querySelector('[id^="comp-"]')
  );

  if (isWix) {
    return {
      platform: 'wix',
      detected: true,
      elementCount: 0,
      message: `We have detected a Wix website.`,
    };
  }

  // Webflow detection
  const isWebflow = !!(
    document.querySelector('meta[name="generator"][content*="Webflow"]') ||
    document.querySelector('.w-container')
  );

  if (isWebflow) {
    return {
      platform: 'webflow',
      detected: true,
      elementCount: 0,
      message: `We have detected a Webflow website.`,
    };
  }

  // Generic fallback
  return {
    platform: 'generic',
    detected: false,
    elementCount: 0,
    message: '',
  };
}
