import { defineContentScript } from 'wxt/sandbox';
import axe from 'axe-core';
import { createColorTracker, finalizeColorPalette, ColorTracker } from '../src/utils/colorUtils';
import {
  getNavigationName,
  generateSelector,
  getTextNodeFontSize,
  getSectionInfo,
  getBlockInfo,
} from '../src/utils/domHelpers';
import {
  initializeColorData,
  trackColor,
  finalizeColorData,
  ColorData,
} from '../src/analyzers/colors'; // ColorAnalyzer methods
import { captureSquarespaceThemeStyles } from '../src/analyzers/themeCapture';
import { analyzeButtons } from '../src/analyzers/buttons';
import { analyzeHeadings, analyzeParagraphs } from '../src/analyzers/typography';
import { analyzeLinks } from '../src/analyzers/links';
import { analyzeImages } from '../src/analyzers/images';
import { scanAllPageColors } from '../src/analyzers/colorScanner';
import { AnalysisResult } from '../src/types';
import { LiveInspector } from '../src/utils/inspector';
import { ScreenshotUtils } from '../src/utils/screenshot';
import { detectPlatform } from '../src/platforms/index';
import { PlatformSelectorManager } from '../src/platforms/selectorManager';
import { platformStrings } from '../src/utils/platform';
import {
  activateTestMode,
  deactivateTestMode,
  exportTestResults,
  getTestStats,
  clearTestResults,
} from '../src/analyzers/colorDetectionTestHarness';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log(`[SSA-${platformStrings.productNameShort}] content script loaded (WXT)`);

    // Expose test harness functions globally for A/B testing
    // Content scripts run in isolated context, so we inject a script file to expose to page context
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('test-harness-bridge.js');
    script.onload = function () {
      // Script loaded successfully
      console.log('[SSA] Test harness bridge script loaded successfully');
    };
    script.onerror = function () {
      console.error('[SSA] Failed to load test harness bridge script');
    };
    (document.head || document.documentElement).appendChild(script);

    // Listen for messages from the injected script
    window.addEventListener('message', event => {
      if (event.data?.type === 'SSA_TEST_HARNESS') {
        switch (event.data.action) {
          case 'activate':
            activateTestMode();
            break;
          case 'deactivate':
            deactivateTestMode();
            break;
          case 'export':
            exportTestResults();
            break;
          case 'stats':
            console.log('Test Stats:', getTestStats());
            break;
          case 'clear':
            clearTestResults();
            break;
        }
      }
    });

    // Initialize Live Inspector
    LiveInspector.initialize();

    // Listener for messages
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
          } catch (error: any) {
            console.error('Analysis failed:', error);
            sendResponse({ success: false, error: error.message });
          }
        })();
        return true;
      }

      if (request.action === 'captureMobileScreenshots') {
        (async () => {
          try {
            const issues = request.issues || [];
            console.log('Capturing screenshots for', issues.length, 'mobile issues');

            const screenshotResponse = await chrome.runtime.sendMessage({
              action: 'captureScreenshot',
            });

            if (!screenshotResponse || !screenshotResponse.success) {
              sendResponse({ success: false, capturedCount: 0, issues: issues });
              return;
            }

            const fullPageScreenshot = screenshotResponse.screenshot;
            let capturedCount = 0;

            for (let i = 0; i < issues.length; i++) {
              const issue = issues[i];
              if (
                issue.type !== 'touch-target-too-small' &&
                issue.type !== 'touch-target-spacing'
              ) {
                continue;
              }
              if (!issue.selector) continue;

              try {
                const element = document.querySelector(issue.selector);
                if (!element) continue;

                // Capture element screenshot with context
                issue.elementScreenshot = await ScreenshotUtils.captureElementScreenshot(
                  fullPageScreenshot,
                  element,
                  20
                );
                issue.elementContext = await ScreenshotUtils.captureElementScreenshot(
                  fullPageScreenshot,
                  element,
                  200
                );

                if (issue.elementScreenshot || issue.elementContext) {
                  capturedCount++;
                }
              } catch (e) {
                console.error('Failed to capture mobile issue screenshot:', e);
              }
            }
            sendResponse({ success: true, capturedCount, issues });
          } catch (error: any) {
            console.error('Mobile screenshot capture failed:', error);
            sendResponse({ success: false, error: error.message, issues: request.issues });
          }
        })();
        return true;
      }
    });

    async function analyzeSquarespaceStyles(): Promise<AnalysisResult> {
      console.log('Analysis started');

      // 1. Capture full-page screenshot first
      let fullPageScreenshot: string | null = null;
      try {
        const response = await chrome.runtime.sendMessage({ action: 'captureScreenshot' });
        if (response && response.success) {
          fullPageScreenshot = response.screenshot;
        }
      } catch (error) {
        console.warn('Screenshot capture failed:', error);
      }

      // 2. Run axe-core audit
      console.log('Running axe-core color-contrast audit...');
      const axeContrastIssues: any[] = [];
      try {
        // @ts-ignore - axe might have type issues depending on version
        const axeResults = await axe.run(document, {
          runOnly: ['color-contrast'],
          resultTypes: ['violations'],
        });

        // Process violations
        for (const violation of axeResults.violations) {
          for (const node of violation.nodes) {
            const data = node.any?.[0]?.data || {};
            const selector = node.target?.[0]; // simple selector

            if (!selector) continue;

            let element: HTMLElement | null = null;
            try {
              element = document.querySelector(selector as string);
            } catch (e) {
              continue;
            }

            if (!element) continue;

            // Filter skipped elements (hidden, aria-hidden, disabled, presentation)
            // Re-implementing filter logic from original
            const computedStyle = window.getComputedStyle(element);
            if (
              computedStyle.display === 'none' ||
              computedStyle.visibility === 'hidden' ||
              parseFloat(computedStyle.opacity) === 0 ||
              element.getAttribute('aria-hidden') === 'true' ||
              (element as any).disabled ||
              element.getAttribute('aria-disabled') === 'true' ||
              ['presentation', 'none'].includes(element.getAttribute('role') || '')
            ) {
              continue;
            }

            // Skip off-screen
            const rect = element.getBoundingClientRect();
            if (rect.left < -1000 || rect.top < -5000) continue;

            // Gradient Check (Fix for False Positives)
            // Automated tools often fail on gradients, seeing the fallback color (often transparent/white)
            // instead of the actual visual background. We filter these out.
            let hasGradient = false;
            let currentEl: HTMLElement | null = element;
            while (currentEl && currentEl !== document.body) {
              const style = window.getComputedStyle(currentEl);

              // Check background-image property explicitly
              const bgImage = style.getPropertyValue('background-image');
              // Also check background shorthand property (gradients can be here too)
              const bg = style.getPropertyValue('background');

              // Check for gradient functions (including vendor prefixes)
              if (
                bgImage.includes('linear-gradient') ||
                bgImage.includes('radial-gradient') ||
                bgImage.includes('conic-gradient') ||
                bgImage.includes('repeating-linear-gradient') ||
                bgImage.includes('repeating-radial-gradient') ||
                bgImage.includes('-webkit-gradient') ||
                bgImage.includes('-moz-linear-gradient') ||
                bgImage.includes('-webkit-linear-gradient') ||
                bg.includes('linear-gradient') ||
                bg.includes('radial-gradient') ||
                bg.includes('conic-gradient') ||
                bg.includes('repeating-linear-gradient') ||
                bg.includes('repeating-radial-gradient')
              ) {
                hasGradient = true;
                break;
              }

              currentEl = currentEl.parentElement;
            }

            if (hasGradient) {
              // console.log('Skipping contrast check for gradient element:', element);
              continue;
            }

            // Text content
            let elementText =
              element.textContent?.trim().substring(0, 100) ||
              element.getAttribute('aria-label') ||
              element.getAttribute('title') ||
              'No text';

            // Filter out typing cursors (Regex for pipe with optional whitespace at end)
            if (/\|\s*$/.test(elementText)) {
              console.log('[SSA] Filtered out typing cursor:', elementText);
              continue;
            }

            // Filter out WordPress button wrappers (we analyze the inner link instead)
            if (element.classList && element.classList.contains('wp-block-button')) {
              continue;
            }

            // Screenshots
            let elementThumbnail: string | null = null;
            let elementContext: string | null = null;

            if (fullPageScreenshot) {
              elementThumbnail = await ScreenshotUtils.captureElementScreenshot(
                fullPageScreenshot,
                element,
                20
              );
              elementContext = await ScreenshotUtils.captureElementScreenshot(
                fullPageScreenshot,
                element,
                200
              );
            }

            if (elementThumbnail || elementContext) {
              const stableSelector = generateSelector(element);
              const { fontSize, fontSizeString, fontSizeUndetermined } =
                getTextNodeFontSize(element);

              // Get accurate Section/Block info even for Generic/Axe issues
              const section = getSectionInfo(element);
              const block = getBlockInfo(element);

              axeContrastIssues.push({
                textColor: data.fgColor || 'unknown',
                backgroundColor: data.bgColor || 'unknown',
                ratio: data.contrastRatio || 0,
                passes: false,
                wcagLevel: 'Fail',
                isLargeText: fontSize >= 18 || (fontSize >= 14 && data.fontWeight >= 700),
                page: window.location.href
                  .replace(/[?&]ssa-inspect-selector=[^&]+/, '')
                  .replace(/\?$/, ''),
                pageTitle: document.title || 'Unknown',
                location: stableSelector,
                selector: stableSelector,
                elementText: elementText,
                section: section,
                block: block,
                element: node.html,
                elementScreenshot: elementThumbnail,
                elementContext: elementContext,
                impact: node.impact,
                message: node.failureSummary,
                fontSize: Math.round(fontSize),
                fontSizeString: fontSizeString,
                fontSizeUndetermined: fontSizeUndetermined,
                fontWeight: parseInt(data.fontWeight) || 400,
              });
            }
          }
        }
      } catch (error) {
        console.error('axe-core audit failed:', error);
      }

      // 3. Initialize Results
      const results: AnalysisResult = {
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
        links: { 'in-content': { locations: [] } },
        images: [],
        colorPalette: { backgrounds: [], text: [], borders: [], all: [] },
        colorData: initializeColorData(),
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
          url: window.location.href
            .replace(/[?&]ssa-inspect-selector=[^&]+/, '')
            .replace(/\?$/, ''),
          domain: window.location.hostname,
          title: document.title || 'Unknown',
          pathname: window.location.pathname,
          timestamp: new Date().toISOString(),
        },
      };

      // 4. Initialize Tracking
      const colorTracker = createColorTracker();
      // Add processed elements set to prevent duplicate color tracking
      (results.colorData as any)._processedElements = new Set<Element>();

      // 5. Detect Platform and Load Selectors
      // IMPORTANT: Platform detection must happen BEFORE theme capture and analyzers
      // so they can use platform-specific color detection strategies
      const platformInfo = detectPlatform();
      console.log('Detected platform:', platformInfo.platform);
      const selectors = PlatformSelectorManager.getSelectors(platformInfo.platform);

      // Store detected platform in results so it can be passed to UI/Reports
      if (platformInfo.detected) {
        // @ts-ignore - Adding dynamic property
        results.detectedPlatform = platformInfo;
      }

      // 6. Capture Theme Styles
      // Pass detected platform for platform-specific color detection
      const squarespaceThemeStyles = await captureSquarespaceThemeStyles(
        colorTracker,
        results.colorData,
        platformInfo.platform
      );
      results.squarespaceThemeStyles = squarespaceThemeStyles;

      // 7. Get Navigation Name
      const navigationName = getNavigationName();

      // 7. Store Contrast Issues - DEFERRED to after custom analyzers
      // We want custom analyzers (which have better section/block info) to take precedence.
      // (results.colorData as any).contrastPairs will be populated by analyzers below.

      // 8. Run Analyzers
      // Pass detected platform for platform-specific color detection
      await analyzeButtons(
        results,
        navigationName,
        colorTracker,
        results.colorData,
        selectors.buttons,
        platformInfo.platform
      );
      await analyzeHeadings(
        results,
        navigationName,
        colorTracker,
        results.colorData,
        selectors.headings,
        platformInfo.platform
      );
      await analyzeParagraphs(
        results,
        navigationName,
        squarespaceThemeStyles,
        colorTracker,
        results.colorData,
        selectors.paragraphs,
        platformInfo.platform
      );
      await analyzeLinks(results, navigationName, colorTracker, results.colorData, selectors, platformInfo.platform);
      await analyzeImages(results, navigationName, selectors.images);

      // 9. Scan remaining page colors
      await scanAllPageColors(results.colorData);

      // 10. Add Axe Core Contrast Issues (as fallback/supplement)
      // We add these LAST so that if there are duplicates, the custom analysis (with better metadata)
      // appears first in the array.
      if (axeContrastIssues.length > 0) {
        // Filter out issues that might have been caught by custom analyzers to avoid duplicates?
        // For now, we just append them. The report generator handles some deduplication.
        (results.colorData as any).contrastPairs.push(...axeContrastIssues);
      }

      // 10. Finalize
      results.colorPalette = finalizeColorPalette(colorTracker);
      results.colorData = finalizeColorData(results.colorData);

      console.log('Analysis completed');
      return results;
    }
  },
});
