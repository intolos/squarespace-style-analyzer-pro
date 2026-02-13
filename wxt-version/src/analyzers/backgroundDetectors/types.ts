/**
 * Types for background color detection
 * Platform-agnostic interfaces for SRP compliance
 */

export interface DetectionContext {
  element: Element;
  screenshot: string | null;
  initialBackgroundColor: string | null;
}

export interface DetectionResult {
  color: string | null;
  details: string;
  method: string;
}

export interface DetectorConfig {
  name: string;
  platform: string;
}

export type DetectionMethod = 
  | 'pseudo-before'
  | 'pseudo-after'
  | 'css-classes'
  | 'computed-style'
  | 'dom-walk'
  | 'canvas'
  | 'indeterminate';

export interface DetectionStep {
  method: DetectionMethod;
  execute: (context: DetectionContext) => Promise<DetectionResult | null>;
}

export abstract class BackgroundDetector {
  protected config: DetectorConfig;

  constructor(config: DetectorConfig) {
    this.config = config;
  }

  abstract getDetectionOrder(): DetectionMethod[];
  abstract detect(context: DetectionContext): Promise<DetectionResult>;

  getName(): string {
    return this.config.name;
  }

  getPlatform(): string {
    return this.config.platform;
  }
}
