/**
 * Color Detection Test Harness
 * A/B testing framework for comparing color detection accuracy
 * Tests four methods: Fast Path Original, Fast Path, Smart Hybrid, Full Hybrid
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

const STORAGE_KEY = 'colorDetectionTestResults';

/**
 * Load test results from background script storage
 */
async function loadTestResults(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'testHarnessLoad' });
    if (response.data && Array.isArray(response.data)) {
      testResults = response.data;
      console.log(`[SSA] Loaded ${testResults.length} existing test results from storage`);
    }
  } catch (error: any) {
    console.warn('[SSA] Could not load test results from storage:', error?.message || error);
  }
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
    cls.startsWith('is-style-')
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
 * Run all four methods on an element
 */
async function runTestOnElement(element: Element, screenshot: string | null): Promise<TestResult> {
  // Find the actual background container
  const backgroundContainer = findBackgroundContainer(element);
  
  // Run all four methods
  const [fastPathOriginal, fastPath, smartHybrid, fullHybrid] = await Promise.all([
    fastPathOriginalMethod(backgroundContainer),
    fastPathNewMethod(backgroundContainer),
    smartHybridMethod(backgroundContainer, screenshot),
    fullHybridMethod(backgroundContainer, screenshot)
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
      fullHybrid
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
  const overlay = document.createElement('div');
  overlay.id = 'color-test-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
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
    ">
      <h3 style="margin: 0; font-size: 16px; font-weight: 600;">🎨 Color Detection Test Results</h3>
      <span style="font-size: 12px; opacity: 0.8;">Drag to move</span>
    </div>
    
    <div style="padding: 0 20px 20px 20px;">
    
    <div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
      <strong>Element:</strong> ${result.elementInfo.tagName}<br>
      <strong>Classes:</strong> ${result.elementInfo.className || 'none'}<br>
      <strong>Selector:</strong> <code style="background: #e0e0e0; padding: 2px 4px; border-radius: 3px;">${result.selector}</code>
    </div>
    
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
        <tr>
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
      </tbody>
    </table>
    
    <div style="margin-bottom: 15px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold;">
        Your Color Picker Result (click the BACKGROUND area with your color picker):
      </label>
      <input type="text" id="manual-color-input" placeholder="e.g., #f6f7f7 or rgba(246, 247, 247)" 
        style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
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
    </div>
  `;
  
  // Add drag functionality
  const header = overlay.querySelector('#color-test-header');
  if (header) {
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    let xOffset = 0;
    let yOffset = 0;

    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e: MouseEvent) {
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      isDragging = true;
    }

    function drag(e: MouseEvent) {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;

        overlay.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px))`;
      }
    }

    function dragEnd() {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
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
      result.manualVerification = input.value.trim() || null;
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
    
    // Prevent default behavior only for page elements
    e.preventDefault();
    e.stopPropagation();
    
    // Get screenshot from extension
    const screenshot = await captureScreenshotWithRetry(3);
    
    console.log('Testing element:', target);
    
    // Run tests
    const result = await runTestOnElement(target, screenshot);
    
    // Show overlay
    await showTestOverlay(result);
    
    console.log('Test result:', result);
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
  
  // Create CSV header
  const headers = [
    'Element',
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
    'Manual_Verification',
    'Fast_Path_Original_Accurate',
    'Fast_Path_Accurate',
    'Smart_Hybrid_Accurate',
    'Full_Hybrid_Accurate',
    'Fast_Path_Original_1diff1',
    'Fast_Path_1diff1',
    'Smart_Hybrid_1diff1',
    'Full_Hybrid_1diff1',
    'Fastest_Accurate_Method'
  ];
  
  // Create CSV rows
  const rows = testResults.map(result => {
    const manual = result.manualVerification?.toLowerCase() || '';
    
    // Calculate accuracy (exact match)
    const fastOriginalAccurate = manual && result.methods.fastPathOriginal.color?.toLowerCase() === manual ? 'YES' : 'NO';
    const fastAccurate = manual && result.methods.fastPath.color?.toLowerCase() === manual ? 'YES' : 'NO';
    const smartAccurate = manual && result.methods.smartHybrid.color?.toLowerCase() === manual ? 'YES' : 'NO';
    const fullAccurate = manual && result.methods.fullHybrid.color?.toLowerCase() === manual ? 'YES' : 'NO';
    
    // Calculate 1diff1 (1 difference by 1)
    const fastOriginal1diff1 = calculateOneDiffOne(result.manualVerification, result.methods.fastPathOriginal.color);
    const fast1diff1 = calculateOneDiffOne(result.manualVerification, result.methods.fastPath.color);
    const smart1diff1 = calculateOneDiffOne(result.manualVerification, result.methods.smartHybrid.color);
    const full1diff1 = calculateOneDiffOne(result.manualVerification, result.methods.fullHybrid.color);
    
    // Find fastest accurate method
    let fastestAccurate = 'NONE';
    const accurateMethods = [];
    if (fastOriginalAccurate === 'YES') accurateMethods.push({ name: 'Fast_Path_Original', time: result.methods.fastPathOriginal.timeMs });
    if (fastAccurate === 'YES') accurateMethods.push({ name: 'Fast_Path', time: result.methods.fastPath.timeMs });
    if (smartAccurate === 'YES') accurateMethods.push({ name: 'Smart_Hybrid', time: result.methods.smartHybrid.timeMs });
    if (fullAccurate === 'YES') accurateMethods.push({ name: 'Full_Hybrid', time: result.methods.fullHybrid.timeMs });
    
    if (accurateMethods.length > 0) {
      const fastest = accurateMethods.reduce((min, curr) => curr.time < min.time ? curr : min);
      fastestAccurate = fastest.name;
    }
    
    return [
      result.element,
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
      result.manualVerification || 'N/A',
      fastOriginalAccurate,
      fastAccurate,
      smartAccurate,
      fullAccurate,
      fastOriginal1diff1,
      fast1diff1,
      smart1diff1,
      full1diff1,
      fastestAccurate
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
  });
  
  const csv = [headers.join(','), ...rows].join('\n');
  
  // Send CSV to background script for download
  const filename = `color-detection-test-results-${new Date().toISOString().split('T')[0]}.csv`;
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'testHarnessDownload',
      filename: filename,
      csvData: csv
    });
    
    if (response?.success) {
      console.log(`✅ Exported ${testResults.length} test results to CSV`);
      console.log(`📁 Downloaded: ${filename}`);
      console.log('📂 Check your Downloads folder');
    } else {
      console.error('❌ Export failed:', response?.error || 'Unknown error');
      console.log('\n📋 CSV DATA (copy manually):');
      console.log('-'.repeat(80));
      console.log(csv);
      console.log('-'.repeat(80));
    }
  } catch (error: any) {
    console.error('❌ Export error:', error?.message || error);
    console.log('\n📋 CSV DATA (copy manually):');
    console.log('-'.repeat(80));
    console.log(csv);
    console.log('-'.repeat(80));
  }
  
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
  
  const withManual = testResults.filter(r => r.manualVerification).length;
  
  const fastOriginalAccurate = testResults.filter(r => {
    const manual = r.manualVerification?.toLowerCase();
    return manual && r.methods.fastPathOriginal.color?.toLowerCase() === manual;
  }).length;
  
  const fastAccurate = testResults.filter(r => {
    const manual = r.manualVerification?.toLowerCase();
    return manual && r.methods.fastPath.color?.toLowerCase() === manual;
  }).length;
  
  const smartAccurate = testResults.filter(r => {
    const manual = r.manualVerification?.toLowerCase();
    return manual && r.methods.smartHybrid.color?.toLowerCase() === manual;
  }).length;
  
  const fullAccurate = testResults.filter(r => {
    const manual = r.manualVerification?.toLowerCase();
    return manual && r.methods.fullHybrid.color?.toLowerCase() === manual;
  }).length;
  
  const avgTimeFastOriginal = testResults.reduce((sum, r) => sum + r.methods.fastPathOriginal.timeMs, 0) / total;
  const avgTimeFast = testResults.reduce((sum, r) => sum + r.methods.fastPath.timeMs, 0) / total;
  const avgTimeSmart = testResults.reduce((sum, r) => sum + r.methods.smartHybrid.timeMs, 0) / total;
  const avgTimeFull = testResults.reduce((sum, r) => sum + r.methods.fullHybrid.timeMs, 0) / total;
  
  return {
    totalTests: total,
    withManualVerification: withManual,
    accuracy: {
      fastPathOriginal: withManual > 0 ? Math.round((fastOriginalAccurate / withManual) * 100) : 0,
      fastPath: withManual > 0 ? Math.round((fastAccurate / withManual) * 100) : 0,
      smartHybrid: withManual > 0 ? Math.round((smartAccurate / withManual) * 100) : 0,
      fullHybrid: withManual > 0 ? Math.round((fullAccurate / withManual) * 100) : 0
    },
    averageTimeMs: {
      fastPathOriginal: Math.round(avgTimeFastOriginal * 100) / 100,
      fastPath: Math.round(avgTimeFast * 100) / 100,
      smartHybrid: Math.round(avgTimeSmart * 100) / 100,
      fullHybrid: Math.round(avgTimeFull * 100) / 100
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
    console.warn('[SSA] Could not clear test results from storage:', error?.message || error);
  }
}

// Make functions available globally for console access
if (typeof window !== 'undefined') {
  (window as any).activateColorTestMode = activateTestMode;
  (window as any).deactivateColorTestMode = deactivateTestMode;
  (window as any).exportTestResults = exportTestResults;
  (window as any).getTestStats = getTestStats;
  (window as any).clearTestResults = clearTestResults;
}