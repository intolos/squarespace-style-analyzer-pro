/**
 * Background detector factory
 * SRP: Only responsible for routing to correct detector based on platform
 * DRY: Platform detection logic centralized here
 */

import type { Platform } from '../../platforms';
import { BackgroundDetector } from './types';
import { WordPressBackgroundDetector } from './wordpressDetector';
import { SquarespaceBackgroundDetector } from './squarespaceDetector';
import { GenericBackgroundDetector } from './genericDetector';

// Singleton instances for performance
const detectors: Map<string, BackgroundDetector> = new Map();

/**
 * Get the appropriate detector for a platform
 * Uses singleton pattern to avoid creating new instances repeatedly
 */
export function getBackgroundDetector(platform: Platform): BackgroundDetector {
  // Check cache first
  if (detectors.has(platform)) {
    return detectors.get(platform)!;
  }

  // Create new detector based on platform
  let detector: BackgroundDetector;

  switch (platform) {
    case 'wordpress':
      detector = new WordPressBackgroundDetector();
      break;
    case 'squarespace':
      detector = new SquarespaceBackgroundDetector();
      break;
    case 'wix':
      // Wix can use generic for now - add specific detector if needed later
      detector = new GenericBackgroundDetector();
      break;
    case 'webflow':
      // Webflow can use generic for now - add specific detector if needed later
      detector = new GenericBackgroundDetector();
      break;
    case 'shopify':
      // Shopify can use generic for now - add specific detector if needed later
      detector = new GenericBackgroundDetector();
      break;
    default:
      detector = new GenericBackgroundDetector();
      break;
  }

  // Cache for reuse
  detectors.set(platform, detector);
  return detector;
}

/**
 * Convenience function to detect background with platform routing
 * This is the main entry point for background detection
 */
export async function detectBackground(
  platform: Platform,
  element: Element,
  initialBackgroundColor: string | null,
  screenshot: string | null
): Promise<{ color: string | null; details: string; method: string }> {
  const detector = getBackgroundDetector(platform);

  const result = await detector.detect({
    element,
    screenshot,
    initialBackgroundColor,
  });

  return {
    color: result.color,
    details: result.details,
    method: result.method,
  };
}

// Re-export types and base class for extensibility
export { BackgroundDetector } from './types';
export { BaseBackgroundDetector } from './baseDetector';
export type { DetectionContext, DetectionResult, DetectionMethod } from './types';

// Re-export specific detectors for testing
export { WordPressBackgroundDetector } from './wordpressDetector';
export { SquarespaceBackgroundDetector } from './squarespaceDetector';
export { GenericBackgroundDetector } from './genericDetector';
