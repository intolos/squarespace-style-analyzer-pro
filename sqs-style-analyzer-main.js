// sqs-style-analyzer-main.js
// Main coordinator for Squarespace Style Analyzer content script
// Dependencies: color-analyzer.js, content-script-helpers.js, content-script-theme-capture.js,
//               content-script-analyzers.js, content-script-mobile-checks.js

(function () {
  'use strict';

  console.log('Squarespace Style Analyzer content script loaded');

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'analyzeStyles') {
      (async () => {
        try {
          const results = await analyzeSquarespaceStyles();
          sendResponse({ success: true, data: results });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true; // Keep channel open for async response
    }

    if (request.action === 'captureMobileScreenshots') {
      (async () => {
        try {
          const issues = request.issues || [];
          console.log('Capturing screenshots for', issues.length, 'mobile issues');

          // Request full page screenshot from background
          const screenshotResponse = await chrome.runtime.sendMessage({
            action: 'captureScreenshot',
          });
          if (!screenshotResponse || !screenshotResponse.success) {
            sendResponse({ success: false, capturedCount: 0, issues: issues });
            return;
          }

          const fullPageScreenshot = screenshotResponse.screenshot;
          let capturedCount = 0;

          // Process each issue
          for (let i = 0; i < issues.length; i++) {
            const issue = issues[i];

            // Only capture screenshots for touch target issues
            if (issue.type !== 'touch-target-too-small' && issue.type !== 'touch-target-spacing') {
              continue;
            }

            // Skip if no selector
            if (!issue.selector) {
              console.warn('Mobile issue missing selector:', issue);
              continue;
            }

            try {
              // Find element using CSS selector
              const element = document.querySelector(issue.selector);
              if (!element) {
                console.warn('Could not find element for selector:', issue.selector);
                continue;
              }

              // Capture thumbnail (20px padding) and context (200px padding)
              const elementThumbnail = await captureElementScreenshot(
                fullPageScreenshot,
                element,
                20
              );
              const elementContext = await captureElementScreenshot(
                fullPageScreenshot,
                element,
                200
              );

              // Add screenshots to issue
              if (elementThumbnail || elementContext) {
                issue.elementScreenshot = elementThumbnail;
                issue.elementContext = elementContext;
                capturedCount++;
              }
            } catch (error) {
              console.error('Failed to capture screenshot for mobile issue:', error);
            }
          }

          sendResponse({ success: true, capturedCount: capturedCount, issues: issues });
        } catch (error) {
          console.error('Mobile screenshot capture failed:', error);
          sendResponse({ success: false, error: error.message, issues: request.issues });
        }
      })();
      return true; // Keep channel open for async response
    }

    return true;
  });

  /**
   * Crop element screenshot from full page screenshot
   * @param {string} fullScreenshot - Base64 data URL of full page
   * @param {Element} element - DOM element to crop
   * @param {number} paddingPx - Padding around element in pixels (default 20)
   * @returns {Promise<string>} Base64 data URL of cropped element screenshot
   */
  async function captureElementScreenshot(fullScreenshot, element, paddingPx = 20) {
    if (!element) return null;

    try {
      let rect = element.getBoundingClientRect();
      const isOutsideViewport =
        rect.top < 0 ||
        rect.top > window.innerHeight ||
        rect.bottom < 0 ||
        rect.bottom > window.innerHeight;

      if (isOutsideViewport) {
        element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
        await new Promise(resolve => setTimeout(resolve, 100));
        rect = element.getBoundingClientRect();

        const response = await chrome.runtime.sendMessage({ action: 'captureScreenshot' });
        if (!response || !response.success) return null;
        fullScreenshot = response.screenshot;
      }

      if (rect.width === 0 || rect.height === 0) return null;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = fullScreenshot;
      });

      const dpr = window.devicePixelRatio || 1;
      const padding = paddingPx * dpr;
      const desiredX = rect.left * dpr - padding;
      const desiredY = rect.top * dpr - padding;
      const desiredWidth = rect.width * dpr + padding * 2;
      const desiredHeight = rect.height * dpr + padding * 2;

      const cropX = Math.max(0, Math.min(desiredX, img.width - 1));
      const cropY = Math.max(0, Math.min(desiredY, img.height - 1));
      const cropWidth = Math.max(1, Math.min(desiredWidth, img.width - cropX));
      const cropHeight = Math.max(1, Math.min(desiredHeight, img.height - cropY));

      canvas.width = cropWidth;
      canvas.height = cropHeight;
      ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return null;
    }
  }

  async function analyzeSquarespaceStyles() {
    console.log('Analysis started');

    // Capture full-page screenshot first for element cropping
    let fullPageScreenshot = null;
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'captureScreenshot',
      });
      if (response && response.success) {
        fullPageScreenshot = response.screenshot;
        console.log('Full-page screenshot captured for element thumbnails');
      }
    } catch (error) {
      console.warn('Screenshot capture failed:', error);
    }

    // Run axe-core accessibility audit for WCAG contrast violations ONLY
    // Uses ONLY color-contrast rule to match WAVE's focused approach
    console.log('Running axe-core color-contrast audit...');
    let axeContrastIssues = [];
    try {
      const axeResults = await axe.run(document, {
        runOnly: ['color-contrast'],
        resultTypes: ['violations'],
      });

      console.log('axe-core audit complete:', axeResults.violations.length, 'violations found');

      // Process color-contrast violations only
      for (const violation of axeResults.violations) {
        for (const node of violation.nodes) {
          const data = node.any[0]?.data || {};
          const selector = node.target[0];

          let element = null;
          try {
            element = document.querySelector(selector);
          } catch (e) {
            console.warn('Invalid selector:', selector, e);
            continue;
          }

          if (!element) continue;

          // FILTER 1: Skip hidden/invisible elements (major false positive source)
          const computedStyle = window.getComputedStyle(element);
          if (
            computedStyle.display === 'none' ||
            computedStyle.visibility === 'hidden' ||
            parseFloat(computedStyle.opacity) === 0
          ) {
            console.log('Skipping hidden element:', selector);
            continue;
          }

          // FILTER 2: Skip elements with aria-hidden="true"
          if (element.getAttribute('aria-hidden') === 'true') {
            console.log('Skipping aria-hidden element:', selector);
            continue;
          }

          // FILTER 3: Skip disabled form elements
          if (element.disabled || element.getAttribute('aria-disabled') === 'true') {
            console.log('Skipping disabled element:', selector);
            continue;
          }

          // FILTER 4: Skip elements with role="presentation" or role="none"
          const role = element.getAttribute('role');
          if (role === 'presentation' || role === 'none') {
            console.log('Skipping presentational element:', selector);
            continue;
          }

          // FILTER 5: Skip very small text (likely decorative)
          const fontSize = parseFloat(computedStyle.fontSize);
          if (fontSize < 10) {
            console.log('Skipping decorative small text:', selector, fontSize + 'px');
            continue;
          }

          // FILTER 6: Skip off-screen positioned elements
          const rect = element.getBoundingClientRect();
          if (rect.left < -1000 || rect.top < -5000) {
            console.log('Skipping off-screen element:', selector);
            continue;
          }

          // Extract visible text
          let elementText =
            element.textContent.trim().substring(0, 100) ||
            element.getAttribute('aria-label') ||
            element.getAttribute('title') ||
            'No text';

          // Capture BOTH thumbnail and full context screenshot
          let elementThumbnail = null;
          let elementContext = null;

          if (fullPageScreenshot) {
            // Thumbnail: Cropped element (existing behavior)
            elementThumbnail = await captureElementScreenshot(fullPageScreenshot, element, 20);

            // Context: Larger area around element for modal
            elementContext = await captureElementScreenshot(fullPageScreenshot, element, 200);

            console.log(
              'Screenshots captured:',
              elementText.substring(0, 30),
              'Thumbnail:',
              !!elementThumbnail,
              'Context:',
              !!elementContext
            );
          }

          // Only add if we have valid data
          if (elementThumbnail || elementContext) {
            axeContrastIssues.push({
              textColor: data.fgColor || 'unknown',
              backgroundColor: data.bgColor || 'unknown',
              ratio: data.contrastRatio || 0,
              passes: false,
              wcagLevel: 'Fail',
              isLargeText: data.fontSize >= 18 || (data.fontSize >= 14 && data.fontWeight >= 700),
              page: window.location.href,
              pageTitle: document.title || 'Unknown',
              location: selector,
              selector: selector,
              elementText: elementText,
              section: 'N/A',
              block: 'N/A',
              element: node.html,
              elementScreenshot: elementThumbnail,
              elementContext: elementContext,
              impact: node.impact,
              message: node.failureSummary,
            });
          }
        }
      }
      console.log('Valid contrast issues after filtering:', axeContrastIssues.length);
    } catch (error) {
      console.error('axe-core audit failed:', error);
    }

    // Initialize results structure
    var results = {
      themeStyles: {
        typography: { styleDefinition: '', locations: [] },
        colors: { styleDefinition: '', locations: [] },
        spacing: { styleDefinition: '', locations: [] },
        buttons: { styleDefinition: '', locations: [] },
      },
      siteStyles: {},
      buttons: {
        primary: { locations: [] },
        secondary: { locations: [] },
        tertiary: { locations: [] },
        other: { locations: [] },
      },
      links: {
        'in-content': { locations: [] },
      },
      images: [],
      colorPalette: {
        backgrounds: [],
        text: [],
        borders: [],
        all: [],
      },
      colorData: ColorAnalyzer.initializeColorData(),
      headings: {
        'heading-1': { locations: [] },
        'heading-2': { locations: [] },
        'heading-3': { locations: [] },
        'heading-4': { locations: [] },
        'heading-5': { locations: [] },
        'heading-6': { locations: [] },
      },
      paragraphs: {
        'paragraph-1': { locations: [] },
        'paragraph-2': { locations: [] },
        'paragraph-3': { locations: [] },
        'paragraph-4': { locations: [] },
      },
      qualityChecks: {
        missingH1: [],
        multipleH1: [],
        brokenHeadingHierarchy: [],
        fontSizeInconsistency: [],
        missingAltText: [],
        genericImageNames: [],
      },
      mobileIssues: {
        viewportMeta: { exists: false, content: null, isProper: false },
        issues: [],
      },
      metadata: {
        url: window.location.href,
        domain: window.location.hostname,
        title: document.title || 'Unknown',
        pathname: window.location.pathname,
        timestamp: new Date().toISOString(),
      },
    };

    // Initialize color tracker
    var colorTracker = ContentScriptHelpers.createColorTracker();

    // Add Set to track processed elements (prevent duplicate color tracking)
    results.colorData._processedElements = new Set();
    console.log(
      '[COLOR DEBUG] _processedElements Set initialized:',
      results.colorData._processedElements
    );

    // Capture Squarespace theme styles
    var squarespaceThemeStyles = ContentScriptThemeCapture.captureSquarespaceThemeStyles(
      colorTracker,
      results.colorData
    );
    results.squarespaceThemeStyles = squarespaceThemeStyles;

    // Get navigation name for this page
    var navigationName = ContentScriptHelpers.getNavigationName();

    // Store axe-core contrast issues in contrastPairs array (format expected by UI)
    results.colorData.contrastPairs = axeContrastIssues;

    // Run all analyzers (no screenshot needed - axe-core handles contrast)
    console.log('Starting analyzers...');
    try {
      await ContentScriptAnalyzers.analyzeButtons(
        results,
        navigationName,
        colorTracker,
        results.colorData
      );
      console.log('Buttons analyzed');
    } catch (e) {
      console.error('analyzeButtons error:', e);
      throw e;
    }

    try {
      await ContentScriptAnalyzers.analyzeHeadings(
        results,
        navigationName,
        colorTracker,
        results.colorData
      );
      console.log('Headings analyzed');
    } catch (e) {
      console.error('analyzeHeadings error:', e);
      throw e;
    }

    try {
      await ContentScriptAnalyzers.analyzeParagraphs(
        results,
        navigationName,
        squarespaceThemeStyles,
        colorTracker,
        results.colorData
      );
      console.log('Paragraphs analyzed');
    } catch (e) {
      console.error('analyzeParagraphs error:', e);
      throw e;
    }

    try {
      await ContentScriptAnalyzers.analyzeLinks(
        results,
        navigationName,
        colorTracker,
        results.colorData
      );
      console.log('Links analyzed');
    } catch (e) {
      console.error('analyzeLinks error:', e);
      throw e;
    }

    ContentScriptAnalyzers.analyzeImages(results, navigationName);
    console.log('Images analyzed');

    // Scan all page colors to capture any colors missed by element-specific analyzers
    // This ensures we capture section backgrounds, navigation colors, decorative elements, etc.
    console.log(
      '[COLOR DEBUG] Before scanAllPageColors - processed elements:',
      results.colorData._processedElements.size
    );
    ContentScriptHelpers.scanAllPageColors(results.colorData);
    console.log(
      '[COLOR DEBUG] After scanAllPageColors - total unique colors:',
      Object.keys(results.colorData.colors).length
    );

    // Finalize color palette
    results.colorPalette = ContentScriptHelpers.finalizeColorPalette(colorTracker);

    // Add DevTools CSS Overview format color summary
    results.devToolsColorSummary = ColorAnalyzer.getDevToolsColorSummary(results.colorData);

    console.log('Analysis completed');
    console.log('[COLOR DEBUG] DevTools Summary:', results.devToolsColorSummary);

    // Mobile usability checks are now handled by MobileLighthouseAnalyzer
    // via the analyzeMobileViewport action when checkbox is enabled
    // No mobile checks run here to avoid duplicates

    return results;
  }

  // --- Live Inspector Support ---
  function checkUrlForInspection() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const selector = urlParams.get('ssa-inspect-selector');

      if (selector) {
        console.log('SSA Live Inspector: Highlighting element', selector);

        // Retry logic to handle slow-loading Squarespace components
        let attempts = 0;
        const maxAttempts = 3;
        const retryInterval = 1000;

        const performInspection = () => {
          // Remove existing highlights
          const existingHighlights = document.querySelectorAll('.ssa-inspector-highlight');
          existingHighlights.forEach(h => h.remove());

          let el = document.querySelector(selector);

          if (!el) {
            attempts++;
            if (attempts < maxAttempts) {
              console.log(`SSA: Element not found, retrying... (${attempts}/${maxAttempts})`);
              setTimeout(performInspection, retryInterval);
            } else {
              console.error('SSA: Element not found after max retries:', selector);
            }
            return;
          }

          // Case Found: Apply highlight
          console.log('SSA: Element found!', el);

          // Carousel Support: If the element itself is hidden or has 0 size,
          // look for its closest visible ancestor to scroll into view.
          let scrollTarget = el;
          const rect = el.getBoundingClientRect();
          const comp = window.getComputedStyle(el);

          const isNotVisible =
            rect.width <= 1 ||
            rect.height <= 1 ||
            comp.display === 'none' ||
            comp.visibility === 'hidden' ||
            parseFloat(comp.opacity) < 0.1;

          if (isNotVisible) {
            console.log('SSA: Element is obscured, searching for visible container...');
            let parent = el.parentElement;
            while (parent && parent !== document.body) {
              const pRect = parent.getBoundingClientRect();
              const pComp = window.getComputedStyle(parent);
              if (
                pRect.width > 20 &&
                pRect.height > 20 &&
                pComp.display !== 'none' &&
                pComp.visibility !== 'hidden' &&
                parseFloat(pComp.opacity) > 0.5
              ) {
                scrollTarget = parent;
                break;
              }
              parent = parent.parentElement;
            }
          }

          // Scroll element (or nearest visible parent) into view
          scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Wait just a bit for scroll to finish before calculating final position
          setTimeout(() => {
            const rectFinal = el.getBoundingClientRect();
            const highlightRect =
              rectFinal.width > 0 && rectFinal.height > 0
                ? rectFinal
                : scrollTarget.getBoundingClientRect();

            const highlight = document.createElement('div');
            highlight.className = 'ssa-inspector-highlight';

            const scrollY = window.scrollY;
            const scrollX = window.scrollX;

            highlight.style.position = 'absolute';
            highlight.style.top = highlightRect.top + scrollY + 'px';
            highlight.style.left = highlightRect.left + scrollX + 'px';
            highlight.style.width = highlightRect.width + 'px';
            highlight.style.height = highlightRect.height + 'px';
            highlight.style.border = '4px solid #f56565';
            highlight.style.backgroundColor = 'rgba(245, 101, 101, 0.15)';
            highlight.style.zIndex = '2147483647';
            highlight.style.pointerEvents = 'none';
            highlight.style.borderRadius = '4px';
            highlight.style.boxShadow = '0 0 15px rgba(245, 101, 101, 0.5)';
            highlight.style.opacity = '1';

            highlight.animate(
              [
                { opacity: 0, transform: 'scale(1)' },
                { opacity: 1, transform: 'scale(1.02)' },
                { opacity: 0.5, transform: 'scale(1)' },
                { opacity: 1, transform: 'scale(1.02)' },
                { opacity: 1, transform: 'scale(1)' },
              ],
              {
                duration: 2500,
                iterations: 1,
                fill: 'forwards',
              }
            );

            document.body.appendChild(highlight);
          }, 300);
        };

        // Initial delay
        setTimeout(performInspection, 1000);
      }
    } catch (e) {
      console.warn('SSA: Error during auto-inspection', e);
    }
  }

  // Run on load
  if (document.readyState === 'complete') {
    checkUrlForInspection();
  } else {
    window.addEventListener('load', checkUrlForInspection);
  }
})();
