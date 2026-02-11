/**
 * Color Detection Test Harness
 * A/B testing framework for comparing color detection accuracy
 * Tests three methods: Fast Path, Smart Hybrid, Full Hybrid
 */

import { rgbToHex, isTransparentColor } from '../utils/colorUtils';

// Test result interface
interface TestResult {
  element: string;
  selector: string;
  timestamp: number;
  methods: {
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
 * CSS analysis - checks for background-related classes and rules
 */
function analyzeCSSForBackground(element: Element): { color: string | null; details: string } {
  const details: string[] = [];
  
  // Check element classes for background patterns
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
 * Fast Path Method
 * Checks CSS classes, computed styles, and pseudo-elements
 * Expected time: ~5ms
 */
async function fastPathMethod(element: Element): Promise<MethodResult> {
  const startTime = performance.now();
  
  const { color, details } = analyzeCSSForBackground(element);
  
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
  
  // Step 1: Fast Path
  const fastPath = analyzeCSSForBackground(element);
  
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
  
  // Step 1: Comprehensive CSS analysis (already done in fastPath)
  const cssResult = analyzeCSSForBackground(element);
  
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
 * Run all three methods on an element
 */
async function runTestOnElement(element: Element, screenshot: string | null): Promise<TestResult> {
  // Find the actual background container
  const backgroundContainer = findBackgroundContainer(element);
  
  // Run all three methods
  const [fastPath, smartHybrid, fullHybrid] = await Promise.all([
    fastPathMethod(backgroundContainer),
    smartHybridMethod(backgroundContainer, screenshot),
    fullHybridMethod(backgroundContainer, screenshot)
  ]);
  
  const rect = backgroundContainer.getBoundingClientRect();
  
  return {
    element: backgroundContainer.tagName.toLowerCase(),
    selector: generateSelector(backgroundContainer),
    timestamp: Date.now(),
    methods: {
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
    max-width: 600px;
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
          <td style="padding: 8px;"><strong>Fast Path</strong></td>
          <td style="padding: 8px;">
            ${result.methods.fastPath.color ? `
              <span style="display: inline-block; width: 20px; height: 20px; background: ${result.methods.fastPath.color}; border: 1px solid #ccc; vertical-align: middle; margin-right: 5px;"></span>
              ${result.methods.fastPath.color}
            ` : 'Not found'}
          </td>
          <td style="padding: 8px;">${result.methods.fastPath.timeMs}ms</td>
          <td style="padding: 8px;">${result.methods.fastPath.confidence}</td>
        </tr>
        <tr style="border-bottom: 1px solid #ddd; background: #f9f9f9;">
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
    'Fast_Path_Accurate',
    'Smart_Hybrid_Accurate',
    'Full_Hybrid_Accurate',
    'Fastest_Accurate_Method'
  ];
  
  // Create CSV rows
  const rows = testResults.map(result => {
    const manual = result.manualVerification?.toLowerCase() || '';
    const fastAccurate = manual && result.methods.fastPath.color?.toLowerCase() === manual ? 'YES' : 'NO';
    const smartAccurate = manual && result.methods.smartHybrid.color?.toLowerCase() === manual ? 'YES' : 'NO';
    const fullAccurate = manual && result.methods.fullHybrid.color?.toLowerCase() === manual ? 'YES' : 'NO';
    
    // Find fastest accurate method
    let fastestAccurate = 'NONE';
    const accurateMethods = [];
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
      fastAccurate,
      smartAccurate,
      fullAccurate,
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
  
  const avgTimeFast = testResults.reduce((sum, r) => sum + r.methods.fastPath.timeMs, 0) / total;
  const avgTimeSmart = testResults.reduce((sum, r) => sum + r.methods.smartHybrid.timeMs, 0) / total;
  const avgTimeFull = testResults.reduce((sum, r) => sum + r.methods.fullHybrid.timeMs, 0) / total;
  
  return {
    totalTests: total,
    withManualVerification: withManual,
    accuracy: {
      fastPath: withManual > 0 ? Math.round((fastAccurate / withManual) * 100) : 0,
      smartHybrid: withManual > 0 ? Math.round((smartAccurate / withManual) * 100) : 0,
      fullHybrid: withManual > 0 ? Math.round((fullAccurate / withManual) * 100) : 0
    },
    averageTimeMs: {
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