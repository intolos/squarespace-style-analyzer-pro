/**
 * Color Detection Test Harness
 * A/B testing framework for comparing color detection accuracy
 * Tests six methods: Fast Path Original, Fast Path, Smart Hybrid, Full Hybrid, SQS Current, SQS Proposed
 */

import { rgbToHex, isTransparentColor } from '../utils/colorUtils';

// Test result interface
interface TestResult {
  element: string;
  selector: string;
  timestamp: number;
  methods: {
    fastPathOriginal: MethodResult;
    fastPath: MethodResult;
    smartHybrid: MethodResult;
    fullHybrid: MethodResult;
    sqsCurrent: MethodResult;
    sqsProposed: MethodResult;
  };
  manualVerification: string | null;
  elementInfo: {
    tagName: string;
    className: string;
    id: string;
    rect: DOMRect;
  };
}

interface MethodResult {
  color: string | null;
  timeMs: number;
  confidence: 'high' | 'medium' | 'low';
  details: string;
}

// Test data storage
let testResults: TestResult[] = [];
let isTestModeActive = false;
let clickHandler: ((e: MouseEvent) => void) | null = null;
let lastClickCoordinates: { x: number; y: number } | null = null;

const STORAGE_KEY = 'colorDetectionTestResults';

/**
 * Load test results from storage
 */
async function loadTestResults(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'testHarnessLoad' });
    if (response.data && Array.isArray(response.data)) {
      testResults = response.data;
    }
  } catch (error: any) {
    testResults = [];
  }
  console.log(`[SSA] Loaded ${testResults.length} test results from storage`);
}

/**
 * Save test results to background script storage
 */
async function saveTestResults(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ 
      action: 'testHarnessSave', 
      data: testResults 
    });
    console.log(`[SSA] Saved ${testResults.length} test results to storage`);
  } catch (error: any) {
    console.warn('[SSA] Could not save test results to storage:', error?.message || error);
  }
}

/**
 * Capture screenshot with retry logic
 * Handles "Extension context invalidated" errors
 */
async function captureScreenshotWithRetry(maxRetries: number = 3): Promise<string | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'captureScreenshot' });
      if (response && response.success) {
        return response.screenshot;
      }
      console.warn(`[SSA] Screenshot attempt ${attempt} failed:`, response?.error || 'Unknown error');
    } catch (error: any) {
      console.warn(`[SSA] Screenshot attempt ${attempt} error:`, error?.message || error);
      
      // If extension context is invalidated, we can't retry
      if (error?.message?.includes('Extension context invalidated')) {
        console.error('[SSA] Extension context invalidated - please reload the extension');
        return null;
      }
    }
    
    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.error(`[SSA] Failed to capture screenshot after ${maxRetries} attempts`);
  return null;
}

/**
 * CSS analysis for Fast Path Original - checks computed style and pseudo-elements
 */
function analyzeCSSForBackgroundOriginal(element: Element): { color: string | null; details: string } {
  const details: string[] = [];
  
  // Check element classes for background patterns (logging only)
  const classList = Array.from(element.classList);
  const backgroundClasses = classList.filter(cls => 
    cls.includes('background') || 
    cls.includes('lp-background') ||
    cls.includes('bg')
  );
  
  if (backgroundClasses.length > 0) {
    details.push(`Background classes found: ${backgroundClasses.join(', ')}`);
  }
  
  // Check computed style
  const computedStyle = window.getComputedStyle(element);
  const bgColor = computedStyle.backgroundColor;
  
  if (bgColor && !isTransparentColor(bgColor)) {
    details.push(`Computed background: ${bgColor}`);
    return { color: rgbToHex(bgColor), details: details.join('; ') };
  }
  
  // Check pseudo-elements
  const beforeStyle = window.getComputedStyle(element, '::before');
  const afterStyle = window.getComputedStyle(element, '::after');
  
  if (beforeStyle.backgroundColor && !isTransparentColor(beforeStyle.backgroundColor)) {
    details.push(`::before background: ${beforeStyle.backgroundColor}`);
    return { color: rgbToHex(beforeStyle.backgroundColor), details: details.join('; ') };
  }
  
  if (afterStyle.backgroundColor && !isTransparentColor(afterStyle.backgroundColor)) {
    details.push(`::after background: ${afterStyle.backgroundColor}`);
    return { color: rgbToHex(afterStyle.backgroundColor), details: details.join('; ') };
  }
  
  details.push('No background found in CSS');
  return { color: null, details: details.join('; ') };
}

/**
 * Get background color from CSS rules matching background classes
 */
function getBackgroundFromCSSRules(element: Element): string | null {
  const classList = Array.from(element.classList);
  const backgroundClassPatterns = ['background', 'bg', 'backdrop'];
  
  // Find matching background classes (excluding .is-style-*)
  const matchingClasses = classList.filter(cls => {
    if (cls.startsWith('is-style-')) return false;
    return backgroundClassPatterns.some(pattern => 
      cls.toLowerCase().includes(pattern.toLowerCase())
    );
  });
  
  if (matchingClasses.length === 0) return null;
  
  // Search through all stylesheets for matching rules
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule) {
            // Check if this rule applies to any of our matching classes
            for (const className of matchingClasses) {
              if (rule.selectorText.includes(className)) {
                const bgColor = rule.style.backgroundColor;
                if (bgColor && !isTransparentColor(bgColor)) {
                  return rgbToHex(bgColor);
                }
              }
            }
          }
        }
      } catch (e) {
        // Cross-origin stylesheets may throw errors, skip them
        continue;
      }
    }
  } catch (e) {
    console.warn('[SSA] Error searching CSS rules:', e);
  }
  
  return null;
}

/**
 * CSS analysis for Fast Path New - checks pseudo-elements, CSS classes, then computed style
 */
function analyzeCSSForBackgroundNew(element: Element): { color: string | null; details: string } {
  const details: string[] = [];
  
  // 1. Check ::before pseudo-element FIRST
  const beforeStyle = window.getComputedStyle(element, '::before');
  if (beforeStyle.backgroundColor && !isTransparentColor(beforeStyle.backgroundColor)) {
    details.push(`::before background: ${beforeStyle.backgroundColor}`);
    return { color: rgbToHex(beforeStyle.backgroundColor), details: details.join('; ') };
  }
  
  // 2. Check ::after pseudo-element SECOND
  const afterStyle = window.getComputedStyle(element, '::after');
  if (afterStyle.backgroundColor && !isTransparentColor(afterStyle.backgroundColor)) {
    details.push(`::after background: ${afterStyle.backgroundColor}`);
    return { color: rgbToHex(afterStyle.backgroundColor), details: details.join('; ') };
  }
  
  // 3. Check CSS class rules THIRD
  const cssRuleColor = getBackgroundFromCSSRules(element);
  if (cssRuleColor) {
    details.push(`CSS rule background: ${cssRuleColor}`);
    return { color: cssRuleColor, details: details.join('; ') };
  }
  
  // 4. Check computed style on element FOURTH
  const computedStyle = window.getComputedStyle(element);
  const bgColor = computedStyle.backgroundColor;
  if (bgColor && !isTransparentColor(bgColor)) {
    details.push(`Computed background: ${bgColor}`);
    return { color: rgbToHex(bgColor), details: details.join('; ') };
  }
  
  details.push('No background found');
  return { color: null, details: details.join('; ') };
}

/**
 * Fast Path Original Method
 * Original implementation: CSS classes, computed styles, then pseudo-elements
 * Expected time: ~5ms
 */
async function fastPathOriginalMethod(element: Element): Promise<MethodResult> {
  const startTime = performance.now();
  
  const { color, details } = analyzeCSSForBackgroundOriginal(element);
  
  const timeMs = performance.now() - startTime;
  
  return {
    color,
    timeMs: Math.round(timeMs * 100) / 100,
    confidence: color ? 'high' : 'low',
    details
  };
}

/**
 * Fast Path New Method
 * Revised implementation: Pseudo-elements, CSS classes, then computed style
 * Expected time: ~5ms
 */
async function fastPathNewMethod(element: Element): Promise<MethodResult> {
  const startTime = performance.now();
  
  const { color, details } = analyzeCSSForBackgroundNew(element);
  
  const timeMs = performance.now() - startTime;
  
  return {
    color,
    timeMs: Math.round(timeMs * 100) / 100,
    confidence: color ? 'high' : 'low',
    details
  };
}

/**
 * Multi-point canvas sampling
 * Samples in a grid pattern across the element
 */
async function sampleCanvasColors(
  element: Element, 
  screenshot: string | null,
  gridSize: number = 4
): Promise<{ dominantColor: string | null; samples: Array<{x: number; y: number; color: string}> }> {
  if (!screenshot) {
    return { dominantColor: null, samples: [] };
  }
  
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return { dominantColor: null, samples: [] };
  }
  
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { dominantColor: null, samples: [] };
    
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = screenshot;
    });
    
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    const devicePixelRatio = window.devicePixelRatio || 1;
    const samples: Array<{x: number; y: number; color: string}> = [];
    
    // Sample in a grid pattern
    for (let i = 1; i < gridSize; i++) {
      for (let j = 1; j < gridSize; j++) {
        const x = Math.floor((rect.left + (rect.width * i / gridSize)) * devicePixelRatio);
        const y = Math.floor((rect.top + (rect.height * j / gridSize)) * devicePixelRatio);
        
        if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          const color = `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3] / 255})`;
          samples.push({ x, y, color });
        }
      }
    }
    
    // Find dominant color (simple mode - most frequent)
    const colorCounts = new Map<string, number>();
    samples.forEach(s => {
      const hex = rgbToHex(s.color);
      if (hex) {
        colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
      }
    });
    
    let dominantColor: string | null = null;
    let maxCount = 0;
    colorCounts.forEach((count, color) => {
      if (count > maxCount) {
        maxCount = count;
        dominantColor = color;
      }
    });
    
    return { dominantColor, samples };
  } catch (error) {
    console.error('Canvas sampling failed:', error);
    return { dominantColor: null, samples: [] };
  }
}

/**
 * Smart Hybrid Method
 * Fast Path first, then canvas verification if needed
 * Expected time: ~25ms
 */
async function smartHybridMethod(element: Element, screenshot: string | null): Promise<MethodResult> {
  const startTime = performance.now();
  
  // Step 1: Fast Path (using NEW implementation)
  const fastPath = analyzeCSSForBackgroundNew(element);
  
  // Step 2: Canvas sampling (16 points in 4x4 grid)
  const canvasResult = await sampleCanvasColors(element, screenshot, 4);
  
  let finalColor = fastPath.color;
  let confidence: 'high' | 'medium' | 'low' = 'high';
  let details = fastPath.details;
  
  // Step 3: Compare and decide
  if (fastPath.color && canvasResult.dominantColor) {
    // Simple comparison - exact match or close enough
    if (fastPath.color.toLowerCase() === canvasResult.dominantColor.toLowerCase()) {
      details += `; Canvas confirms: ${canvasResult.dominantColor}`;
      confidence = 'high';
    } else {
      // Mismatch - use canvas (visual reality)
      finalColor = canvasResult.dominantColor;
      details += `; CSS/Canvas mismatch. Using canvas: ${canvasResult.dominantColor} (was ${fastPath.color})`;
      confidence = 'medium';
    }
  } else if (canvasResult.dominantColor) {
    // No CSS background, use canvas
    finalColor = canvasResult.dominantColor;
    details += `; No CSS background, using canvas: ${canvasResult.dominantColor}`;
    confidence = 'medium';
  }
  
  const timeMs = performance.now() - startTime;
  
  return {
    color: finalColor,
    timeMs: Math.round(timeMs * 100) / 100,
    confidence,
    details
  };
}

/**
 * Dense canvas sampling for Full Hybrid
 * Samples 64 points in 8x8 grid
 */
async function denseCanvasSampling(
  element: Element, 
  screenshot: string | null
): Promise<{ dominantColor: string | null; samples: number; consistency: number }> {
  if (!screenshot) {
    return { dominantColor: null, samples: 0, consistency: 0 };
  }
  
  const result = await sampleCanvasColors(element, screenshot, 8);
  
  // Calculate consistency (percentage of samples matching dominant color)
  let consistency = 0;
  if (result.dominantColor && result.samples.length > 0) {
    const dominantCount = result.samples.filter(s => {
      const hex = rgbToHex(s.color);
      return hex?.toLowerCase() === result.dominantColor?.toLowerCase();
    }).length;
    consistency = Math.round((dominantCount / result.samples.length) * 100);
  }
  
  return {
    dominantColor: result.dominantColor,
    samples: result.samples.length,
    consistency
  };
}

/**
 * Full Hybrid Method
 * Comprehensive CSS analysis + dense canvas sampling
 * Expected time: ~150-200ms
 */
async function fullHybridMethod(element: Element, screenshot: string | null): Promise<MethodResult> {
  const startTime = performance.now();
  
  // Step 1: Comprehensive CSS analysis (using NEW implementation)
  const cssResult = analyzeCSSForBackgroundNew(element);
  
  // Step 2: Dense canvas sampling (64 points)
  const canvasResult = await denseCanvasSampling(element, screenshot);
  
  let finalColor = cssResult.color;
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  let details = cssResult.details;
  details += `; Dense sampling: ${canvasResult.samples} points, consistency: ${canvasResult.consistency}%`;
  
  // Step 3: Smart comparison
  if (canvasResult.consistency > 70 && canvasResult.dominantColor) {
    // High consistency in canvas - trust it
    if (cssResult.color && cssResult.color.toLowerCase() !== canvasResult.dominantColor.toLowerCase()) {
      details += `; CSS/Canvas mismatch resolved: using canvas ${canvasResult.dominantColor}`;
    }
    finalColor = canvasResult.dominantColor;
    confidence = 'high';
  } else if (cssResult.color) {
    // Low canvas consistency, trust CSS
    details += `; Low canvas consistency, using CSS: ${cssResult.color}`;
    confidence = 'medium';
  } else if (canvasResult.dominantColor) {
    // No CSS, use canvas even with low consistency
    finalColor = canvasResult.dominantColor;
    details += `; No CSS match, using best canvas guess: ${canvasResult.dominantColor}`;
    confidence = 'low';
  }
  
  const timeMs = performance.now() - startTime;
  
  return {
    color: finalColor,
    timeMs: Math.round(timeMs * 100) / 100,
    confidence,
    details
  };
}

// Suspicious colors for verification
const SUSPICIOUS_COLORS = new Set(['#000000', '#FFFFFF', '#000', '#FFF']);

/**
 * Check CSS rules for background classes (same as baseDetector)
 */
function checkCssRules(element: Element): string | null {
  const classList = Array.from(element.classList);
  const backgroundPatterns = ['background', 'bg', 'backdrop'];

  const matchingClasses = classList.filter(cls => {
    if (cls.startsWith('is-style-')) return false;
    return backgroundPatterns.some(pattern =>
      cls.toLowerCase().includes(pattern.toLowerCase())
    );
  });

  if (matchingClasses.length === 0) return null;

  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule) {
            for (const className of matchingClasses) {
              if (rule.selectorText.includes(className)) {
                const bgColor = rule.style.backgroundColor;
                if (bgColor && !isTransparentColor(bgColor)) {
                  return rgbToHex(bgColor);
                }
              }
            }
          }
        }
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    console.warn('[SSA] Error searching CSS rules:', e);
  }

  return null;
}

/**
 * Walk DOM to find background color (returns first non-transparent found)
 */
function walkDomForBackground(startElement: Element): { color: string | null; details: string } {
  let el: Element | null = startElement;
  let depth = 0;
  const maxDepth = 15;

  while (el && depth < maxDepth) {
    const style = window.getComputedStyle(el);
    const bg = style.backgroundColor;
    if (bg && !isTransparentColor(bg)) {
      const hex = rgbToHex(bg);
      return {
        color: hex,
        details: `DOM walk: found ${bg} at ${el.tagName} after ${depth} levels`
      };
    }
    el = el.parentElement;
    depth++;
  }

  return { color: null, details: 'DOM walk: no background found' };
}

/**
 * Canvas verification using edge/corner sampling (not center)
 * Returns null if canvas not available or sampling fails
 */
async function canvasVerifyWithEdges(
  element: Element,
  screenshot: string | null,
  domColor: string
): Promise<{ canvasColor: string | null; confidence: 'high' | 'medium' | 'low'; details: string }> {
  if (!screenshot) {
    return { canvasColor: null, confidence: 'low', details: 'Canvas: no screenshot available' };
  }

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return { canvasColor: null, confidence: 'low', details: 'Canvas: zero-dimension element' };
  }

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return { canvasColor: null, confidence: 'low', details: 'Canvas: context failed' };
    }

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = screenshot;
    });

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const devicePixelRatio = window.devicePixelRatio || 1;

    // Sample from edges/corners (4 points from each edge)
    const margin = 0.15; // 15% from edge
    const samples: { x: number; y: number; color: string }[] = [];

    // Top edge
    for (let i = 1; i < 4; i++) {
      const x = Math.floor((rect.left + rect.width * i / 4) * devicePixelRatio);
      const y = Math.floor((rect.top + rect.height * margin) * devicePixelRatio);
      if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        samples.push({ x, y, color: `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3] / 255})` });
      }
    }

    // Bottom edge
    for (let i = 1; i < 4; i++) {
      const x = Math.floor((rect.left + rect.width * i / 4) * devicePixelRatio);
      const y = Math.floor((rect.top + rect.height * (1 - margin)) * devicePixelRatio);
      if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        samples.push({ x, y, color: `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3] / 255})` });
      }
    }

    // Left edge
    for (let i = 1; i < 4; i++) {
      const x = Math.floor((rect.left + rect.width * margin) * devicePixelRatio);
      const y = Math.floor((rect.top + rect.height * i / 4) * devicePixelRatio);
      if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        samples.push({ x, y, color: `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3] / 255})` });
      }
    }

    // Right edge
    for (let i = 1; i < 4; i++) {
      const x = Math.floor((rect.left + rect.width * (1 - margin)) * devicePixelRatio);
      const y = Math.floor((rect.top + rect.height * i / 4) * devicePixelRatio);
      if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        samples.push({ x, y, color: `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3] / 255})` });
      }
    }

    if (samples.length === 0) {
      return { canvasColor: null, confidence: 'low', details: 'Canvas: no valid samples' };
    }

    // Find dominant color
    const colorCounts = new Map<string, number>();
    samples.forEach(s => {
      const hex = rgbToHex(s.color);
      if (hex) {
        colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
      }
    });

    let dominantColor: string | null = null;
    let maxCount = 0;
    colorCounts.forEach((count: number, color: string) => {
      if (count > maxCount) {
        maxCount = count;
        dominantColor = color;
      }
    });

    if (!dominantColor) {
      return { canvasColor: null, confidence: 'low', details: 'Canvas: no dominant color found' };
    }

    const dominantColorValue = dominantColor as string;
    const consistency = Math.round((maxCount / samples.length) * 100);
    const details = `Canvas edge sampling: ${samples.length} points, dominant: ${dominantColorValue}, consistency: ${consistency}%`;

    // If canvas differs significantly from DOM and has high consistency, use canvas
    const domLower = domColor.toLowerCase();
    const canvasLower = dominantColorValue.toLowerCase();

    if (domLower !== canvasLower && consistency >= 70) {
      return {
        canvasColor: dominantColorValue,
        confidence: 'high',
        details: details + `; DOM/Canvas mismatch - using canvas`
      };
    } else if (domLower !== canvasLower) {
      return {
        canvasColor: dominantColorValue,
        confidence: 'low',
        details: details + `; DOM/Canvas differ but low consistency - keeping DOM`
      };
    }

    return {
      canvasColor: dominantColorValue,
      confidence: 'high',
      details: details + `; DOM/Canvas match`
    };

  } catch (error) {
    return { canvasColor: null, confidence: 'low', details: `Canvas: error - ${error}` };
  }
}

/**
 * SQS Current Method
 * Exact current Squarespace detection (no changes):
 * 1. initialBackgroundColor check
 * 2. computed-style
 * 3. dom-walk (returns first found)
 * 4. pseudo-before
 * 5. pseudo-after
 * 6. canvas (buttons only)
 * 7. indeterminate
 */
async function sqsCurrentMethod(element: Element, screenshot: string | null, canvasElement?: Element): Promise<MethodResult> {
  const startTime = performance.now();
  const details: string[] = [];

  // 1. Check initial background color (passed from getStyleDefinition)
  // Note: We don't have access to initialBackgroundColor here, so skip

  // 2. Check computed style on element
  const computedStyle = window.getComputedStyle(element);
  const bgColor = computedStyle.backgroundColor;
  if (bgColor && !isTransparentColor(bgColor)) {
    const hex = rgbToHex(bgColor);
    return {
      color: hex,
      timeMs: Math.round((performance.now() - startTime) * 100) / 100,
      confidence: 'high',
      details: `Computed style: ${bgColor}`
    };
  }

  // 3. DOM walk (returns first non-transparent found)
  const domResult = walkDomForBackground(element);
  if (domResult.color) {
    // Continue to verification step - if suspicious, verify with canvas
    // Use canvasElement (original clicked element) for position if provided
    const canvasTarget = canvasElement || element;
    if (SUSPICIOUS_COLORS.has(domResult.color.toUpperCase())) {
      const canvasVerify = await canvasVerifyWithEdges(canvasTarget, screenshot, domResult.color);
      details.push(domResult.details);
      details.push(canvasVerify.details);

      if (canvasVerify.canvasColor && canvasVerify.confidence === 'high' && canvasVerify.canvasColor.toLowerCase() !== domResult.color.toLowerCase()) {
        return {
          color: canvasVerify.canvasColor,
          timeMs: Math.round((performance.now() - startTime) * 100) / 100,
          confidence: 'medium',
          details: details.join('; ')
        };
      }
    }

    return {
      color: domResult.color,
      timeMs: Math.round((performance.now() - startTime) * 100) / 100,
      confidence: 'high',
      details: domResult.details
    };
  }

  // 4. Check pseudo-before
  const beforeStyle = window.getComputedStyle(element, '::before');
  if (beforeStyle.backgroundColor && !isTransparentColor(beforeStyle.backgroundColor)) {
    const hex = rgbToHex(beforeStyle.backgroundColor);
    return {
      color: hex,
      timeMs: Math.round((performance.now() - startTime) * 100) / 100,
      confidence: 'medium',
      details: `::before: ${beforeStyle.backgroundColor}`
    };
  }

  // 5. Check pseudo-after
  const afterStyle = window.getComputedStyle(element, '::after');
  if (afterStyle.backgroundColor && !isTransparentColor(afterStyle.backgroundColor)) {
    const hex = rgbToHex(afterStyle.backgroundColor);
    return {
      color: hex,
      timeMs: Math.round((performance.now() - startTime) * 100) / 100,
      confidence: 'medium',
      details: `::after: ${afterStyle.backgroundColor}`
    };
  }

  // 6. Canvas for button-like elements
  const tagName = element.tagName.toLowerCase();
  const isButton = tagName === 'button' || tagName === 'a' || tagName === 'input';
  const hasButtonClass = (element.className || '').toLowerCase().includes('button');

  if ((isButton || hasButtonClass) && screenshot) {
    const canvasResult = await sampleCanvasColors(element, screenshot, 4);
    if (canvasResult.dominantColor) {
      return {
        color: canvasResult.dominantColor,
        timeMs: Math.round((performance.now() - startTime) * 100) / 100,
        confidence: 'medium',
        details: `Canvas (button): ${canvasResult.dominantColor}`
      };
    }
  }

  // 7. Indeterminate fallback
  return {
    color: null,
    timeMs: Math.round((performance.now() - startTime) * 100) / 100,
    confidence: 'low',
    details: 'Indeterminate: No background found. Use Contrast Checker Tool to verify manually.'
  };
}

/**
 * SQS Proposed Method
 * Revised approach with Squarespace section CSS variable check first:
 * 1. Query SECTION elements for --siteBackgroundColor CSS variable
 * 2. CSS class rules
 * 3. Check CLICKED ELEMENT itself for direct background
 * 4. Pseudo-elements on clicked element
 * 5. Walk UP DOM tree from clicked element
 * 6. Query for .section-background elements as fallback
 * 7. Indeterminate fallback
 */
async function sqsProposedMethod(element: Element): Promise<MethodResult> {
  const startTime = performance.now();

  console.log('[SQS Debug] Clicked element:', element.tagName, element.className?.substring(0, 30));

  // 1. Check CLICKED ELEMENT itself first (including if it's body)
  const clickedStyle = window.getComputedStyle(element);
  const clickedBg = clickedStyle.backgroundColor;
  if (clickedBg && !isTransparentColor(clickedBg)) {
    const hex = rgbToHex(clickedBg);
    // IMPORTANT: If body has white background, don't return it - continue to section detection
    if (hex && !(element.tagName === 'BODY' && hex === '#FFFFFF')) {
      console.log('[SQS Debug] Found via clicked element:', hex);
      return {
        color: hex,
        timeMs: Math.round((performance.now() - startTime) * 100) / 100,
        confidence: 'high',
        details: `Clicked element: ${element.tagName} - ${clickedBg}`
      };
    }
    if (element.tagName === 'BODY' && hex === '#FFFFFF') {
      console.log('[SQS Debug] Body has white, skipping to section detection');
    }
  }

  // 2. Walk UP DOM from parent (not including body)
  // This finds colored ancestors for elements with selector paths
  let currentEl: Element | null = element.parentElement;
  while (currentEl && currentEl !== document.body) {
    const style = window.getComputedStyle(currentEl);
    const bg = style.backgroundColor;
    if (bg && !isTransparentColor(bg)) {
      const hex = rgbToHex(bg);
      if (hex) {
        console.log('[SQS Debug] Found via DOM walk:', hex);
        return {
          color: hex,
          timeMs: Math.round((performance.now() - startTime) * 100) / 100,
          confidence: 'high',
          details: `DOM walk: ${currentEl.tagName} - ${bg}`
        };
      }
    }
    currentEl = currentEl.parentElement;
  }

  // 3. Section detection using click coordinates
  let sectionElement: Element | null = null;
  
  if (lastClickCoordinates) {
    console.log('[SQS Debug] Using click coordinates:', lastClickCoordinates);
    
    // Try to find element at click position
    const elementAtPoint = document.elementFromPoint(lastClickCoordinates.x, lastClickCoordinates.y);
    console.log('[SQS Debug] elementFromPoint returned:', elementAtPoint ? elementAtPoint.tagName : 'null');
    
    if (elementAtPoint) {
      console.log('[SQS Debug] Element at point:', elementAtPoint.tagName, elementAtPoint.className?.substring(0, 30));
      sectionElement = elementAtPoint.closest('section');
      console.log('[SQS Debug] Found section via elementFromPoint:', sectionElement ? 'YES' : 'NO');
      if (sectionElement) {
        console.log('[SQS Debug] Section found:', sectionElement.tagName, 'class:', sectionElement.className?.substring(0, 30));
      }
    } else {
      console.log('[SQS Debug] elementFromPoint returned null');
    }
    
    // If still no section, check all sections to find which one contains the click point
    if (!sectionElement) {
      const allSections = document.querySelectorAll('section');
      console.log('[SQS Debug] Checking all sections by bounding rect... Total:', allSections.length);
      
      for (let i = 0; i < allSections.length; i++) {
        const section = allSections[i];
        const rect = section.getBoundingClientRect();
        const isInRect = lastClickCoordinates.y >= rect.top && lastClickCoordinates.y <= rect.bottom &&
                        lastClickCoordinates.x >= rect.left && lastClickCoordinates.x <= rect.right;
        console.log(`[SQS Debug] Section ${i}: top=${rect.top}, bottom=${rect.bottom}, inRect=${isInRect}`);
        if (isInRect) {
          sectionElement = section;
          console.log('[SQS Debug] Found section by rect at index:', i);
          break;
        }
      }
    }
  } else {
    console.log('[SQS Debug] No lastClickCoordinates available');
  }
  
  // Check the section's CSS variable if we found one
  if (sectionElement) {
    const style = window.getComputedStyle(sectionElement);
    const cssVarValue = style.getPropertyValue('--siteBackgroundColor').trim();
    console.log('[SQS Debug] Section CSS var:', cssVarValue);
    
    // Skip white (hsla(0,0%,100%,1)) and transparent
    if (cssVarValue && 
        cssVarValue !== 'hsla(0,0%,100%,1)' && 
        cssVarValue !== 'rgba(255, 255, 255, 1)' &&
        cssVarValue !== '#ffffff' &&
        !isTransparentColor(cssVarValue)) {
      const hex = rgbToHex(cssVarValue);
      console.log('[SQS Debug] Converted to hex:', hex);
      if (hex) {
        return {
          color: hex,
          timeMs: Math.round((performance.now() - startTime) * 100) / 100,
          confidence: 'high',
          details: `Section CSS Variable: ${cssVarValue}`
        };
      }
    }
  }

  // 4. CSS class rules
  const cssClassColor = checkCssRules(element);
  if (cssClassColor) {
    return {
      color: cssClassColor,
      timeMs: Math.round((performance.now() - startTime) * 100) / 100,
      confidence: 'high',
      details: `CSS class rules: ${cssClassColor}`
    };
  }

  // 5. Pseudo-elements
  const beforeStyle = window.getComputedStyle(element, '::before');
  if (beforeStyle.backgroundColor && !isTransparentColor(beforeStyle.backgroundColor)) {
    return {
      color: rgbToHex(beforeStyle.backgroundColor),
      timeMs: Math.round((performance.now() - startTime) * 100) / 100,
      confidence: 'medium',
      details: `::before: ${beforeStyle.backgroundColor}`
    };
  }

  const afterStyle = window.getComputedStyle(element, '::after');
  if (afterStyle.backgroundColor && !isTransparentColor(afterStyle.backgroundColor)) {
    return {
      color: rgbToHex(afterStyle.backgroundColor),
      timeMs: Math.round((performance.now() - startTime) * 100) / 100,
      confidence: 'medium',
      details: `::after: ${afterStyle.backgroundColor}`
    };
  }

  // 6. Walk UP DOM tree from clicked element (fallback)
  let el: Element | null = element.parentElement;
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    const bg = style.backgroundColor;
    if (bg && !isTransparentColor(bg)) {
      return {
        color: rgbToHex(bg),
        timeMs: Math.round((performance.now() - startTime) * 100) / 100,
        confidence: 'high',
        details: `Ancestor ${el.tagName}: ${bg}`
      };
    }
    el = el.parentElement;
  }

  // 7. Indeterminate fallback
  return {
    color: null,
    timeMs: Math.round((performance.now() - startTime) * 100) / 100,
    confidence: 'low',
    details: 'Indeterminate: No background found. Use Contrast Checker Tool to verify manually.'
  };
}

/**
 * Normalize color to 6-digit hex format
 */
function normalizeToHex(color: string | null): string | null {
  if (!color) return null;
  
  // Already hex
  if (color.startsWith('#')) {
    // Convert #rgb to #rrggbb
    if (color.length === 4) {
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
    }
    return color.toLowerCase();
  }
  
  // rgb() or rgba()
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`.toLowerCase();
  }
  
  return color.toLowerCase();
}

/**
 * Calculate "1 diff by 1" accuracy
 * Returns: "exact", "yes", or "no"
 */
function calculateOneDiffOne(manual: string | null, technique: string | null): string {
  if (!manual || !technique) return 'no';
  
  const manualHex = normalizeToHex(manual);
  const techniqueHex = normalizeToHex(technique);
  
  if (!manualHex || !techniqueHex) return 'no';
  
  // Exact match
  if (manualHex === techniqueHex) return 'exact';
  
  // Compare character by character
  let diffCount = 0;
  let diffValue = 0;
  let diffPosition = -1;
  
  for (let i = 0; i < manualHex.length; i++) {
    if (manualHex[i] !== techniqueHex[i]) {
      diffCount++;
      diffPosition = i;
      
      // Calculate numeric difference for this position
      const manualVal = parseInt(manualHex[i], 16);
      const techniqueVal = parseInt(techniqueHex[i], 16);
      diffValue = Math.abs(manualVal - techniqueVal);
      
      // If more than 1 difference, return "no" immediately
      if (diffCount > 1) return 'no';
    }
  }
  
  // Exactly 1 position differs by exactly 1
  if (diffCount === 1 && diffValue === 1) return 'yes';
  
  // 1 position differs but by more than 1
  if (diffCount === 1 && diffValue > 1) return 'no';
  
  return 'no';
}

/**
 * Walk up DOM tree to find element with actual background
 * Matches production behavior in getEffectiveBackgroundColor
 */
function findBackgroundContainer(startElement: Element): Element {
  let el: Element | null = startElement;
  
  while (el) {
    const style = window.getComputedStyle(el);
    const bg = style.backgroundColor;
    if (bg && !isTransparentColor(bg)) {
      return el;
    }
    el = el.parentElement;
  }
  
  // Fallback to body if no background found
  return document.body;
}

/**
 * Run all six methods on an element
 */
async function runTestOnElement(element: Element, screenshot: string | null): Promise<TestResult> {
  // Find the actual background container
  const backgroundContainer = findBackgroundContainer(element);
  
  // Run all six methods - pass both original element and background container
  // Original element is used for canvas verification position
  const [fastPathOriginal, fastPath, smartHybrid, fullHybrid, sqsCurrent, sqsProposed] = await Promise.all([
    fastPathOriginalMethod(backgroundContainer),
    fastPathNewMethod(backgroundContainer),
    smartHybridMethod(backgroundContainer, screenshot),
    fullHybridMethod(backgroundContainer, screenshot),
    sqsCurrentMethod(backgroundContainer, screenshot, element),
    sqsProposedMethod(backgroundContainer)
  ]);
  
  const rect = backgroundContainer.getBoundingClientRect();
  
  return {
    element: backgroundContainer.tagName.toLowerCase(),
    selector: generateSelector(backgroundContainer),
    timestamp: Date.now(),
    methods: {
      fastPathOriginal,
      fastPath,
      smartHybrid,
      fullHybrid,
      sqsCurrent,
      sqsProposed
    },
    manualVerification: null,
    elementInfo: {
      tagName: backgroundContainer.tagName,
      className: backgroundContainer.className,
      id: backgroundContainer.id,
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right,
        x: rect.x,
        y: rect.y,
        toJSON: () => ({})
      } as DOMRect
    }
  };
}

/**
 * Generate CSS selector for element
 */
function generateSelector(element: Element): string {
  const parts: string[] = [];
  let el: Element | null = element;
  
  while (el && el !== document.body) {
    let selector = el.tagName.toLowerCase();
    if (el.id) {
      selector += `#${el.id}`;
    } else if (el.className) {
      const classes = el.className.split(' ').filter(c => c).slice(0, 2);
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }
    parts.unshift(selector);
    el = el.parentElement;
  }
  
  return parts.join(' > ');
}

/**
 * Create test overlay UI
 */
function createTestOverlay(result: TestResult): HTMLElement {
  // Get persisted position or use center default
  const savedX = parseFloat(localStorage.getItem('ssa-overlay-x') || '0');
  const savedY = parseFloat(localStorage.getItem('ssa-overlay-y') || '0');
  const hasSavedPosition = savedX !== 0 || savedY !== 0;
  
  const overlay = document.createElement('div');
  overlay.id = 'color-test-overlay';
  overlay.style.cssText = `
    position: fixed;
    ${hasSavedPosition ? `left: ${savedX}px; top: ${savedY}px; transform: none;` : `top: 50%; left: 50%; transform: translate(-50%, -50%);`}
    background: white;
    border: 2px solid #667eea;
    border-radius: 8px;
    max-width: 700px;
    max-height: 80vh;
    overflow-y: auto;
    z-index: 10000;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
  `;
  
  // Stop all click events from bubbling to the page
  overlay.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  overlay.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  
  overlay.innerHTML = `
    <div id="color-test-header" style="
      background: #667eea;
      color: white;
      padding: 12px 20px;
      margin: -20px -20px 15px -20px;
      border-radius: 6px 6px 0 0;
      cursor: move;
      user-select: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 10;
    ">
      <h3 style="margin: 0; font-size: 16px; font-weight: 600;">🎨 Color Detection Test Results</h3>
      <span style="font-size: 12px; opacity: 0.8;">Drag to move</span>
    </div>
    
    <div style="padding: 0 20px 20px 20px;">
    
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
      <thead>
        <tr style="background: #667eea; color: white;">
          <th style="padding: 8px; text-align: left;">Method</th>
          <th style="padding: 8px; text-align: left;">Color</th>
          <th style="padding: 8px; text-align: left;">Time</th>
          <th style="padding: 8px; text-align: left;">Confidence</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;"><strong>Fast Path Original</strong></td>
          <td style="padding: 8px;">
            ${result.methods.fastPathOriginal.color ? `
              <span style="display: inline-block; width: 20px; height: 20px; background: ${result.methods.fastPathOriginal.color}; border: 1px solid #ccc; vertical-align: middle; margin-right: 5px;"></span>
              ${result.methods.fastPathOriginal.color}
            ` : 'Not found'}
          </td>
          <td style="padding: 8px;">${result.methods.fastPathOriginal.timeMs}ms</td>
          <td style="padding: 8px;">${result.methods.fastPathOriginal.confidence}</td>
        </tr>
        <tr style="border-bottom: 1px solid #ddd; background: #f9f9f9;">
          <td style="padding: 8px;"><strong>Fast Path (New)</strong></td>
          <td style="padding: 8px;">
            ${result.methods.fastPath.color ? `
              <span style="display: inline-block; width: 20px; height: 20px; background: ${result.methods.fastPath.color}; border: 1px solid #ccc; vertical-align: middle; margin-right: 5px;"></span>
              ${result.methods.fastPath.color}
            ` : 'Not found'}
          </td>
          <td style="padding: 8px;">${result.methods.fastPath.timeMs}ms</td>
          <td style="padding: 8px;">${result.methods.fastPath.confidence}</td>
        </tr>
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;"><strong>Smart Hybrid</strong></td>
          <td style="padding: 8px;">
            ${result.methods.smartHybrid.color ? `
              <span style="display: inline-block; width: 20px; height: 20px; background: ${result.methods.smartHybrid.color}; border: 1px solid #ccc; vertical-align: middle; margin-right: 5px;"></span>
              ${result.methods.smartHybrid.color}
            ` : 'Not found'}
          </td>
          <td style="padding: 8px;">${result.methods.smartHybrid.timeMs}ms</td>
          <td style="padding: 8px;">${result.methods.smartHybrid.confidence}</td>
        </tr>
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;"><strong>Full Hybrid</strong></td>
          <td style="padding: 8px;">
            ${result.methods.fullHybrid.color ? `
              <span style="display: inline-block; width: 20px; height: 20px; background: ${result.methods.fullHybrid.color}; border: 1px solid #ccc; vertical-align: middle; margin-right: 5px;"></span>
              ${result.methods.fullHybrid.color}
            ` : 'Not found'}
          </td>
          <td style="padding: 8px;">${result.methods.fullHybrid.timeMs}ms</td>
          <td style="padding: 8px;">${result.methods.fullHybrid.confidence}</td>
        </tr>
        <tr style="border-bottom: 1px solid #ddd; background: #e8f4e8;">
          <td style="padding: 8px;"><strong>SQS Current</strong> <span style="font-size: 11px; color: #666;">(current)</span></td>
          <td style="padding: 8px;">
            ${result.methods.sqsCurrent?.color ? `
              <span style="display: inline-block; width: 20px; height: 20px; background: ${result.methods.sqsCurrent?.color}; border: 1px solid #ccc; vertical-align: middle; margin-right: 5px;"></span>
              ${result.methods.sqsCurrent?.color}
            ` : result.methods.sqsCurrent?.details?.includes('Indeterminate') ? `<span style="color: #666; font-style: italic;">Indeterminate</span>` : 'N/A'}
          </td>
          <td style="padding: 8px;">${result.methods.sqsCurrent?.timeMs ?? 'N/A'}ms</td>
          <td style="padding: 8px;">${result.methods.sqsCurrent?.confidence ?? 'N/A'}</td>
        </tr>
        <tr style="background: #e8f4e8;">
          <td style="padding: 8px;"><strong>SQS Proposed</strong></td>
          <td style="padding: 8px;">
            ${result.methods.sqsProposed?.color ? `
              <span style="display: inline-block; width: 20px; height: 20px; background: ${result.methods.sqsProposed?.color}; border: 1px solid #ccc; vertical-align: middle; margin-right: 5px;"></span>
              ${result.methods.sqsProposed?.color}
            ` : result.methods.sqsProposed?.details?.includes('Indeterminate') ? `<span style="color: #666; font-style: italic;">Indeterminate</span>` : 'N/A'}
          </td>
          <td style="padding: 8px;">${result.methods.sqsProposed?.timeMs ?? 'N/A'}ms</td>
          <td style="padding: 8px;">${result.methods.sqsProposed?.confidence ?? 'N/A'}</td>
        </tr>
      </tbody>
    </table>
    
    <div style="margin-bottom: 15px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold;">
        Your Color Picker Result (starts with #):
      </label>
      <div style="display: flex; align-items: center;">
        <span style="padding: 8px; background: #f0f0f0; border: 1px solid #ddd; border-right: none; border-radius: 4px 0 0 4px; font-weight: bold; color: #666;">#</span>
        <input type="text" id="manual-color-input" placeholder="f6f7f7" 
          style="flex: 1; padding: 8px; border: 1px solid #ddd; border-left: none; border-radius: 0 4px 4px 0; font-size: 14px;">
      </div>
    </div>
    
    <div style="display: flex; gap: 10px; justify-content: flex-end;">
      <button id="skip-test-btn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">
        Skip
      </button>
      <button id="submit-test-btn" style="padding: 8px 16px; border: none; background: #667eea; color: white; border-radius: 4px; cursor: pointer;">
        Submit Result
      </button>
    </div>
    
    <div style="margin-top: 10px; font-size: 12px; color: #666;">
      Tests completed: ${testResults.length}
    </div>
    
    <div style="margin-top: 15px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
      <strong>Element:</strong> ${result.elementInfo.tagName}<br>
      <strong>Classes:</strong> ${result.elementInfo.className || 'none'}<br>
      <strong>Selector:</strong> <code style="background: #e0e0e0; padding: 2px 4px; border-radius: 3px;">${result.selector}</code>
    </div>
    </div>
  `;
  
  // Add drag functionality
  const header = overlay.querySelector('#color-test-header');
  if (header) {
    let isDragging = false;
    let currentX = savedX;
    let currentY = savedY;
    let initialX = 0;
    let initialY = 0;
    let startX = 0;
    let startY = 0;

    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e: MouseEvent) {
      startX = e.clientX;
      startY = e.clientY;
      initialX = currentX;
      initialY = currentY;
      isDragging = true;
    }

    function drag(e: MouseEvent) {
      if (isDragging) {
        e.preventDefault();
        currentX = initialX + (e.clientX - startX);
        currentY = initialY + (e.clientY - startY);
        
        overlay.style.left = `${currentX}px`;
        overlay.style.top = `${currentY}px`;
        overlay.style.transform = 'none';
      }
    }

    function dragEnd() {
      isDragging = false;
      // Save position to localStorage
      localStorage.setItem('ssa-overlay-x', currentX.toString());
      localStorage.setItem('ssa-overlay-y', currentY.toString());
    }
  }
  
  return overlay;
}

/**
 * Show test overlay and wait for user input
 */
function showTestOverlay(result: TestResult): Promise<TestResult> {
  return new Promise((resolve) => {
    // Remove existing overlay
    const existingOverlay = document.getElementById('color-test-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }
    
    const overlay = createTestOverlay(result);
    document.body.appendChild(overlay);
    
    // Handle submit
    const submitBtn = document.getElementById('submit-test-btn');
    const skipBtn = document.getElementById('skip-test-btn');
    const input = document.getElementById('manual-color-input') as HTMLInputElement;
    
    submitBtn?.addEventListener('click', async () => {
      let value = input.value.trim();
      // Auto-prepend # for hex codes if missing
      if (value && !value.startsWith('#') && !value.toLowerCase().startsWith('rgba') && !value.toLowerCase().startsWith('rgb')) {
        value = '#' + value;
      }
      result.manualVerification = value || null;
      testResults.push(result);
      await saveTestResults(); // Persist to storage
      overlay.remove();
      resolve(result);
    });
    
    skipBtn?.addEventListener('click', () => {
      overlay.remove();
      resolve(result);
    });
    
    // Also allow Enter key
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        submitBtn?.click();
      }
    });
  });
}

/**
 * Activate test mode - allows clicking elements to test
 */
export async function activateTestMode(): Promise<void> {
  if (isTestModeActive) {
    console.log('Color detection test mode is already active');
    return;
  }
  
  isTestModeActive = true;
  
  // Load existing results from storage instead of resetting
  await loadTestResults();
  
  console.log('🎨 Color Detection Test Mode Activated');
  console.log(`Currently have ${testResults.length} test results stored`);
  console.log('Click on any element to test color detection methods');
  console.log('Click on the BACKGROUND area (not text/images)');
  console.log('Run exportTestResults() when done to get your data');
  console.log('Run clearTestResults() to start fresh');
  
  // Create visual indicator
  const indicator = document.createElement('div');
  indicator.id = 'test-mode-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #667eea;
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    z-index: 10001;
    font-family: system-ui, sans-serif;
    font-weight: bold;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  indicator.textContent = '🎨 Test Mode Active - Click elements to test';
  document.body.appendChild(indicator);
  
  // Add click handler
  clickHandler = async (e: MouseEvent) => {
    if (!isTestModeActive) return;
    
    // Store click coordinates for accurate section detection
    lastClickCoordinates = { x: e.clientX, y: e.clientY };
    
    const target = e.target as Element;
    if (!target) return;
    
    // Check if click is inside the test overlay or indicator - if so, ignore it
    const overlay = document.getElementById('color-test-overlay');
    if (overlay && (overlay === target || overlay.contains(target))) {
      return; // Click is in the form, don't process as page element
    }
    
    const indicator = document.getElementById('test-mode-indicator');
    if (indicator && (indicator === target || indicator.contains(target))) {
      return; // Click is on the indicator, don't process
    }
    
    // Ignore clicks on elements with blob URLs (these are from our own export links)
    if (target instanceof HTMLAnchorElement && target.href?.startsWith('blob:')) {
      return; // This is our own export link click, ignore
    }
    
    // Prevent default behavior only for page elements
    e.preventDefault();
    e.stopPropagation();
    
    // Get screenshot from extension
    const screenshot = await captureScreenshotWithRetry(3);
    
    // Run tests
    const result = await runTestOnElement(target, screenshot);
    
    // Show overlay
    await showTestOverlay(result);
  };
  
  document.addEventListener('click', clickHandler, true);
}

/**
 * Deactivate test mode
 */
export function deactivateTestMode(): void {
  isTestModeActive = false;
  
  if (clickHandler) {
    document.removeEventListener('click', clickHandler, true);
    clickHandler = null;
  }
  
  // Remove indicator
  const indicator = document.getElementById('test-mode-indicator');
  if (indicator) {
    indicator.remove();
  }
  
  console.log('🎨 Color Detection Test Mode Deactivated');
}

/**
 * Export test results as CSV
 */
export async function exportTestResults(): Promise<string> {
  if (testResults.length === 0) {
    console.log('No test results to export');
    return '';
  }
  
  // Filter out old results that don't have the new SQS methods
  // This handles legacy data stored before sqsCurrent/sqsProposed were added
  const validResults = testResults.filter(r => r.methods && r.methods.sqsCurrent && r.methods.sqsProposed);
  
  if (validResults.length === 0) {
    console.log('No valid test results to export (legacy data without SQS methods)');
    return 'No valid test results. Please run new tests with updated extension.';
  }
  
  // Use valid results for export
  const resultsToExport = validResults;
  // Create CSV header
  const headers = [
    'Element',
    'Classes',
    'Selector',
    'Fast_Path_Original_Color',
    'Fast_Path_Original_Time',
    'Fast_Path_Original_Confidence',
    'Fast_Path_Color',
    'Fast_Path_Time',
    'Fast_Path_Confidence',
    'Smart_Hybrid_Color',
    'Smart_Hybrid_Time',
    'Smart_Hybrid_Confidence',
    'Full_Hybrid_Color',
    'Full_Hybrid_Time',
    'Full_Hybrid_Confidence',
    'SQS_Current_Color',
    'SQS_Current_Time',
    'SQS_Current_Confidence',
    'SQS_Proposed_Color',
    'SQS_Proposed_Time',
    'SQS_Proposed_Confidence',
    'Manual_Verification',
    'Fast_Path_Original_Accurate',
    'Fast_Path_Accurate',
    'Smart_Hybrid_Accurate',
    'Full_Hybrid_Accurate',
    'SQS_Current_Accurate',
    'SQS_Proposed_Accurate',
    'Fast_Path_Original_1diff1',
    'Fast_Path_1diff1',
    'Smart_Hybrid_1diff1',
    'Full_Hybrid_1diff1',
    'SQS_Current_1diff1',
    'SQS_Proposed_1diff1',
    'Fastest_Accurate_Method'
  ];
  
  // Create CSV rows
  const rows = resultsToExport.map(result => {
    const manual = result.manualVerification?.toLowerCase() || '';
    
    // Calculate accuracy (exact match) - with null checks for legacy data
    const fastOriginalAccurate = manual && result.methods.fastPathOriginal?.color?.toLowerCase() === manual ? 'YES' : 'NO';
    const fastAccurate = manual && result.methods.fastPath?.color?.toLowerCase() === manual ? 'YES' : 'NO';
    const smartAccurate = manual && result.methods.smartHybrid?.color?.toLowerCase() === manual ? 'YES' : 'NO';
    const fullAccurate = manual && result.methods.fullHybrid?.color?.toLowerCase() === manual ? 'YES' : 'NO';
    const sqsCurrentAccurate = manual && result.methods.sqsCurrent?.color?.toLowerCase() === manual ? 'YES' : 'NO';
    const sqsProposedAccurate = manual && result.methods.sqsProposed?.color?.toLowerCase() === manual ? 'YES' : 'NO';
    
    // Calculate 1diff1 (1 difference by 1) - with null checks
    const fastOriginal1diff1 = calculateOneDiffOne(result.manualVerification, result.methods.fastPathOriginal?.color);
    const fast1diff1 = calculateOneDiffOne(result.manualVerification, result.methods.fastPath?.color);
    const smart1diff1 = calculateOneDiffOne(result.manualVerification, result.methods.smartHybrid?.color);
    const full1diff1 = calculateOneDiffOne(result.manualVerification, result.methods.fullHybrid?.color);
    const sqsCurrent1diff1 = calculateOneDiffOne(result.manualVerification, result.methods.sqsCurrent?.color);
    const sqsProposed1diff1 = calculateOneDiffOne(result.manualVerification, result.methods.sqsProposed?.color);
    
    // Find fastest accurate method
    let fastestAccurate = 'NONE';
    const accurateMethods = [];
    if (fastOriginalAccurate === 'YES') accurateMethods.push({ name: 'Fast_Path_Original', time: result.methods.fastPathOriginal?.timeMs ?? 0 });
    if (fastAccurate === 'YES') accurateMethods.push({ name: 'Fast_Path', time: result.methods.fastPath?.timeMs ?? 0 });
    if (smartAccurate === 'YES') accurateMethods.push({ name: 'Smart_Hybrid', time: result.methods.smartHybrid?.timeMs ?? 0 });
    if (fullAccurate === 'YES') accurateMethods.push({ name: 'Full_Hybrid', time: result.methods.fullHybrid?.timeMs ?? 0 });
    if (sqsCurrentAccurate === 'YES') accurateMethods.push({ name: 'SQS_Current', time: result.methods.sqsCurrent?.timeMs ?? 0 });
    if (sqsProposedAccurate === 'YES') accurateMethods.push({ name: 'SQS_Proposed', time: result.methods.sqsProposed?.timeMs ?? 0 });
    
    if (accurateMethods.length > 0) {
      const fastest = accurateMethods.reduce((min, curr) => curr.time < min.time ? curr : min);
      fastestAccurate = fastest.name;
    }
    
    return [
      result.element,
      result.elementInfo.className || '',
      result.selector,
      result.methods.fastPathOriginal.color || 'N/A',
      result.methods.fastPathOriginal.timeMs,
      result.methods.fastPathOriginal.confidence,
      result.methods.fastPath.color || 'N/A',
      result.methods.fastPath.timeMs,
      result.methods.fastPath.confidence,
      result.methods.smartHybrid.color || 'N/A',
      result.methods.smartHybrid.timeMs,
      result.methods.smartHybrid.confidence,
      result.methods.fullHybrid.color || 'N/A',
      result.methods.fullHybrid.timeMs,
      result.methods.fullHybrid.confidence,
      result.methods.sqsCurrent?.color || 'N/A',
      result.methods.sqsCurrent?.timeMs ?? 'N/A',
      result.methods.sqsCurrent?.confidence ?? 'N/A',
      result.methods.sqsProposed?.color || 'N/A',
      result.methods.sqsProposed?.timeMs ?? 'N/A',
      result.methods.sqsProposed?.confidence ?? 'N/A',
      result.manualVerification || 'N/A',
      fastOriginalAccurate,
      fastAccurate,
      smartAccurate,
      fullAccurate,
      sqsCurrentAccurate,
      sqsProposedAccurate,
      fastOriginal1diff1,
      fast1diff1,
      smart1diff1,
      full1diff1,
      sqsCurrent1diff1,
      sqsProposed1diff1,
      fastestAccurate
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
  });
  
  const csv = [headers.join(','), ...rows].join('\n');
  
  // Download CSV using client-side anchor
  const filename = `color-detection-test-results-${new Date().toISOString().split('T')[0]}.csv`;
  
  try {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`✅ Exported ${resultsToExport.length} test results to ${filename}`);
    return filename;
  } catch (error) {
    console.error('Export failed:', error);
    return 'Export failed';
  }
  console.log(`📁 Downloaded: ${filename}`);
  console.log('📂 Check your Downloads folder');
  
  return csv;
}

/**
 * Get current test statistics
 */
export function getTestStats(): object {
  const total = testResults.length;
  if (total === 0) {
    return { total: 0, message: 'No tests completed yet' };
  }
  
  // Filter to valid results with SQS methods
  const validResults = testResults.filter(r => r.methods && r.methods.sqsCurrent && r.methods.sqsProposed);
  
  if (validResults.length === 0) {
    return { 
      total, 
      validWithSQSMethods: 0,
      message: 'No valid results with SQS methods. Run new tests with updated extension.' 
    };
  }
  
  const withManual = validResults.filter(r => r.manualVerification).length;
  
  const fastOriginalAccurate = validResults.filter(r => {
    const manual = r.manualVerification?.toLowerCase();
    return manual && r.methods.fastPathOriginal?.color?.toLowerCase() === manual;
  }).length;
  
  const fastAccurate = validResults.filter(r => {
    const manual = r.manualVerification?.toLowerCase();
    return manual && r.methods.fastPath?.color?.toLowerCase() === manual;
  }).length;
  
  const smartAccurate = validResults.filter(r => {
    const manual = r.manualVerification?.toLowerCase();
    return manual && r.methods.smartHybrid?.color?.toLowerCase() === manual;
  }).length;
  
  const fullAccurate = validResults.filter(r => {
    const manual = r.manualVerification?.toLowerCase();
    return manual && r.methods.fullHybrid?.color?.toLowerCase() === manual;
  }).length;

  const sqsCurrentAccurate = validResults.filter(r => {
    const manual = r.manualVerification?.toLowerCase();
    return manual && r.methods.sqsCurrent?.color?.toLowerCase() === manual;
  }).length;

  const sqsProposedAccurate = validResults.filter(r => {
    const manual = r.manualVerification?.toLowerCase();
    return manual && r.methods.sqsProposed?.color?.toLowerCase() === manual;
  }).length;
  
  const avgTimeFastOriginal = validResults.reduce((sum, r) => sum + (r.methods.fastPathOriginal?.timeMs ?? 0), 0) / validResults.length;
  const avgTimeFast = validResults.reduce((sum, r) => sum + (r.methods.fastPath?.timeMs ?? 0), 0) / validResults.length;
  const avgTimeSmart = validResults.reduce((sum, r) => sum + (r.methods.smartHybrid?.timeMs ?? 0), 0) / validResults.length;
  const avgTimeFull = validResults.reduce((sum, r) => sum + (r.methods.fullHybrid?.timeMs ?? 0), 0) / validResults.length;
  const avgTimeSqsCurrent = validResults.reduce((sum, r) => sum + (r.methods.sqsCurrent?.timeMs ?? 0), 0) / validResults.length;
  const avgTimeSqsProposed = validResults.reduce((sum, r) => sum + (r.methods.sqsProposed?.timeMs ?? 0), 0) / validResults.length;
  
  return {
    totalTests: total,
    validWithSQSMethods: validResults.length,
    withManualVerification: withManual,
    accuracy: {
      fastPathOriginal: withManual > 0 ? Math.round((fastOriginalAccurate / withManual) * 100) : 0,
      fastPath: withManual > 0 ? Math.round((fastAccurate / withManual) * 100) : 0,
      smartHybrid: withManual > 0 ? Math.round((smartAccurate / withManual) * 100) : 0,
      fullHybrid: withManual > 0 ? Math.round((fullAccurate / withManual) * 100) : 0,
      sqsCurrent: withManual > 0 ? Math.round((sqsCurrentAccurate / withManual) * 100) : 0,
      sqsProposed: withManual > 0 ? Math.round((sqsProposedAccurate / withManual) * 100) : 0
    },
    averageTimeMs: {
      fastPathOriginal: Math.round(avgTimeFastOriginal * 100) / 100,
      fastPath: Math.round(avgTimeFast * 100) / 100,
      smartHybrid: Math.round(avgTimeSmart * 100) / 100,
      fullHybrid: Math.round(avgTimeFull * 100) / 100,
      sqsCurrent: Math.round(avgTimeSqsCurrent * 100) / 100,
      sqsProposed: Math.round(avgTimeSqsProposed * 100) / 100
    }
  };
}

/**
 * Clear all test results from memory and storage
 */
export async function clearTestResults(): Promise<void> {
  testResults = [];
  try {
    await chrome.runtime.sendMessage({ action: 'testHarnessClear' });
    console.log('🗑️  All test results cleared');
  } catch (error: any) {
    // Extension context may be invalidated, try direct storage access
    console.warn('[SSA] Message failed, trying direct storage clear:', error?.message || error);
    try {
      await chrome.storage.local.remove('colorDetectionTestResults');
      console.log('🗑️  Test results cleared from storage directly');
    } catch (storageError) {
      console.warn('[SSA] Could not clear storage either:', storageError);
    }
  }
}

/**
 * Add a predefined test case for a specific element
 * Useful for testing problematic elements on specific sites (e.g., Squarespace)
 * 
 * @param selector - CSS selector to find the element
 * @param label - Label for this test (e.g., 'sqs-heading-launchhappy')
 * @param expectedColor - Optional expected background color for verification
 * @returns TestResult if element found, null otherwise
 * 
 * Usage:
 *   // Test a specific Squarespace heading
 *   await addTestCase('h2', 'sqs-heading-launchhappy', '#ffffff');
 *   
 *   // Test with more specific selector
 *   await addTestCase('[data-section-id="abc123"] h2', 'sqs-section-heading', '#f8f9fa');
 */
export async function addTestCase(
  selector: string, 
  label: string, 
  expectedColor?: string
): Promise<TestResult | null> {
  const element = document.querySelector(selector);
  
  if (!element) {
    console.warn(`[SSA Test] Element not found for selector: ${selector}`);
    return null;
  }
  
  console.log(`[SSA Test] Testing element with label: ${label}`);
  console.log(`[SSA Test] Selector: ${selector}`);
  console.log(`[SSA Test] Element:`, element);
  if (expectedColor) {
    console.log(`[SSA Test] Expected color: ${expectedColor}`);
  }
  
  // Get screenshot from extension
  const screenshot = await captureScreenshotWithRetry(3);
  
  // Run tests on this element
  const result = await runTestOnElement(element, screenshot);
  
  // Add label and expected color to result
  (result as any).testLabel = label;
  (result as any).expectedColor = expectedColor || null;
  
  // Store result
  testResults.push(result);
  await saveTestResults();
  
  // Show overlay with test results
  await showTestOverlay(result);
  
  console.log(`[SSA Test] Result for ${label}:`, result);
  
  if (expectedColor) {
    const detectedColor = result.methods.fastPath.color;
    const match = detectedColor?.toLowerCase() === expectedColor.toLowerCase();
    console.log(`[SSA Test] ${match ? '✅ PASS' : '❌ FAIL'} - Detected: ${detectedColor}, Expected: ${expectedColor}`);
  }
  
  return result;
}

/**
 * Run Squarespace-specific tests
 * Tests common problematic elements on Squarespace sites
 * 
 * Usage:
 *   await runSquarespaceTests();
 */
export async function runSquarespaceTests(): Promise<void> {
  console.log('🎨 Running Squarespace-specific tests...');
  
  const testCases = [
    { selector: 'h1, h2, h3', label: 'sqs-heading', description: 'Headings (common contrast issues)' },
    { selector: 'p', label: 'sqs-paragraph', description: 'Paragraphs (text on section backgrounds)' },
    { selector: '.sqs-block-button-element, .btn, .button', label: 'sqs-button', description: 'Buttons' },
    { selector: 'a', label: 'sqs-link', description: 'Links' },
  ];
  
  for (const testCase of testCases) {
    const elements = document.querySelectorAll(testCase.selector);
    console.log(`[SSA Test] Found ${elements.length} ${testCase.description}`);
    
    if (elements.length > 0) {
      // Test first 3 elements of each type
      for (let i = 0; i < Math.min(3, elements.length); i++) {
        const element = elements[i];
        const uniqueLabel = `${testCase.label}-${i + 1}`;
        
        console.log(`[SSA Test] Testing ${uniqueLabel}...`);
        await addTestCase(testCase.selector, uniqueLabel);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  console.log('✅ Squarespace tests complete');
  console.log(`📊 Run exportTestResults() to see results`);
}

// Make functions available globally for console access
if (typeof window !== 'undefined') {
  (window as any).activateColorTestMode = activateTestMode;
  (window as any).deactivateColorTestMode = deactivateTestMode;
  (window as any).exportTestResults = exportTestResults;
  (window as any).getTestStats = getTestStats;
  (window as any).clearTestResults = clearTestResults;
  (window as any).addTestCase = addTestCase;
  (window as any).runSquarespaceTests = runSquarespaceTests;
}