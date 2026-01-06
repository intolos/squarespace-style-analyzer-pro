// mobile-lighthouse-analyzer.js
// Single Responsibility: Run Lighthouse-quality mobile usability checks via Chrome DevTools Protocol
// This replaces the basic content-script mobile checks with Google-grade accuracy
// REFACTORED: Now uses MobileCheckScripts for injected logic

var MobileLighthouseAnalyzer = (function () {
  'use strict';

  // ============================================
  // CONSTANTS
  // ============================================

  var MOBILE_DEVICE_CONFIG = {
    width: 412,
    height: 823,
    deviceScaleFactor: 2.625,
    mobile: true,
    screenWidth: 412,
    screenHeight: 823,
  };

  var MOBILE_USER_AGENT =
    'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36';

  var LIGHTHOUSE_THRESHOLDS = {
    minTapTargetSize: 24, // Lighthouse v12+ uses axe-core target-size: 24x24px minimum (WCAG 2.2 Level AA)
    minTapTargetSpacing: 8, // Lighthouse uses 8px minimum spacing
    // NOTE: Font-size audit was removed in Lighthouse v12+ (no replacement, no WCAG pixel-based requirement)
  };

  // ============================================
  // MAIN ANALYSIS FUNCTION
  // ============================================

  function analyzePage(tabId, pageUrl) {
    return new Promise(function (resolve, reject) {
      analyzePageAsync(tabId, pageUrl).then(resolve).catch(reject);
    });
  }

  async function analyzePageAsync(tabId, pageUrl) {
    var results = {
      url: pageUrl, // Use passed URL directly
      viewport: null,
      tapTargets: [],
      fontSize: [],
      contentWidth: null,
      imageSizing: [],
      userAgent: MOBILE_USER_AGENT,
    };

    try {
      // Step 1: Attach debugger
      await attachDebugger(tabId);

      // Step 2: Set mobile device emulation
      await setMobileEmulation(tabId);

      // Step 3: Set mobile user agent (CRITICAL - triggers mobile-specific code)
      await setMobileUserAgent(tabId);

      // Step 4: Enable required DevTools domains
      await enableDevToolsDomains(tabId);

      // Step 5: Wait for page to stabilize with mobile settings
      await delay(1000);

      // Step 6: Run all checks
      results.viewport = await checkViewport(tabId);
      results.tapTargets = await checkTapTargets(tabId);
      // Font-size check removed (Lighthouse v12+ removed this audit)
      results.contentWidth = await checkContentWidth(tabId);
      results.imageSizing = await checkImageSizing(tabId);

      // Step 7: Reset viewport to desktop BEFORE detaching
      await resetToDesktopView(tabId);
      await delay(1000); // Give desktop layout time to settle

      // Step 8: Capture screenshots in Desktop View
      if (results.tapTargets.length > 0) {
        await captureDesktopScreenshots(tabId, results.tapTargets);
      }

      // Step 9: Detach debugger
      await detachDebugger(tabId);

      return results;
    } catch (error) {
      // Always try to reset viewport and detach on error
      try {
        await resetToDesktopView(tabId);
        await detachDebugger(tabId);
      } catch (e) {
        // Ignore cleanup errors
      }

      throw error;
    }
  }

  // ============================================
  // DEBUGGER MANAGEMENT
  // ============================================

  function attachDebugger(tabId) {
    return chrome.debugger.attach({ tabId: tabId }, '1.3');
  }

  function detachDebugger(tabId) {
    return chrome.debugger.detach({ tabId: tabId });
  }

  function sendDebuggerCommand(tabId, method, params) {
    return chrome.debugger.sendCommand({ tabId: tabId }, method, params || {});
  }

  // ============================================
  // MOBILE EMULATION SETUP
  // ============================================

  function setMobileEmulation(tabId) {
    return sendDebuggerCommand(tabId, 'Emulation.setDeviceMetricsOverride', MOBILE_DEVICE_CONFIG);
  }

  function resetToDesktopView(tabId) {
    // Clear device metrics override to return to desktop view
    return sendDebuggerCommand(tabId, 'Emulation.clearDeviceMetricsOverride', {});
  }

  function setMobileUserAgent(tabId) {
    return sendDebuggerCommand(tabId, 'Emulation.setUserAgentOverride', {
      userAgent: MOBILE_USER_AGENT,
    });
  }

  function enableDevToolsDomains(tabId) {
    return Promise.all([
      sendDebuggerCommand(tabId, 'DOM.enable'),
      sendDebuggerCommand(tabId, 'CSS.enable'),
      sendDebuggerCommand(tabId, 'Overlay.enable'),
    ]);
  }

  // ============================================
  // VIEWPORT CHECK (Lighthouse: viewport audit)
  // ============================================

  async function checkViewport(tabId) {
    var result = await sendDebuggerCommand(tabId, 'Runtime.evaluate', {
      // Inject check script from MobileCheckScripts
      expression: `(${MobileCheckScripts.getViewportCheck.toString()})()`,
      returnByValue: true,
    });

    return result.result.value;
  }

  // ============================================
  // TAP TARGETS CHECK (Lighthouse: tap-targets audit)
  // ============================================

  async function checkTapTargets(tabId) {
    // Note: Screenshot logic moved to captureDesktopScreenshots to capture in desktop view
    var options = {
      minSize: LIGHTHOUSE_THRESHOLDS.minTapTargetSize,
    };

    var result = await sendDebuggerCommand(tabId, 'Runtime.evaluate', {
      expression: `(${MobileCheckScripts.getTapTargetIssues.toString()})(${JSON.stringify(options)})`,
      returnByValue: true,
    });

    return result.result.value || [];
  }

  // ============================================
  // DESKTOP SCREENSHOT CAPTURE (Phase 2)
  // ============================================

  async function captureDesktopScreenshots(tabId, issues) {
    // Enable Page domain for screenshots
    await sendDebuggerCommand(tabId, 'Page.enable');

    for (var i = 0; i < issues.length; i++) {
      var issue = issues[i];
      if (!issue.selector) continue;

      try {
        // Step 1: Get desktop coordinates for the element
        var coordResult = await sendDebuggerCommand(tabId, 'Runtime.evaluate', {
          expression: `(${MobileCheckScripts.getElementCoordinates.toString()})('${issue.selector}')`,
          returnByValue: true,
        });

        var coords = coordResult.result.value;
        if (!coords) continue;

        // Step 2: Capture Thumbnail (Fixed 200x50)
        // Center on the element
        var thumbWidth = 200;
        var thumbHeight = 50;
        var thumbX = coords.left - (thumbWidth - coords.width) / 2;
        var thumbY = coords.top - (thumbHeight - coords.height) / 2;

        var thumbShot = await sendDebuggerCommand(tabId, 'Page.captureScreenshot', {
          format: 'png',
          quality: 80,
          clip: {
            x: Math.max(0, thumbX),
            y: Math.max(0, thumbY),
            width: thumbWidth,
            height: thumbHeight,
            scale: 1, // Fixed 1:1 scale
          },
        });
        issue.elementScreenshot = 'data:image/png;base64,' + thumbShot.data;

        // Step 3: Capture Context (Fixed 800x600)
        // Center on the element
        var contextWidth = 800;
        var contextHeight = 600;
        var contextX = coords.left - (contextWidth - coords.width) / 2;
        var contextY = coords.top - (contextHeight - coords.height) / 2;

        var contextShot = await sendDebuggerCommand(tabId, 'Page.captureScreenshot', {
          format: 'png',
          quality: 80,
          clip: {
            x: Math.max(0, contextX),
            y: Math.max(0, contextY),
            width: contextWidth,
            height: contextHeight,
            scale: 1, // Fixed 1:1 scale
          },
        });
        issue.elementContext = 'data:image/png;base64,' + contextShot.data;
      } catch (e) {
        console.error('Failed to capture desktop screenshot for selector:', issue.selector, e);
      }
    }
  }

  // ============================================
  // FONT SIZE CHECK - REMOVED
  // ============================================
  // Font-size audit was removed in Lighthouse v12+ with no replacement.

  // ============================================
  // CONTENT WIDTH CHECK (Lighthouse: checks for horizontal scroll)
  // ============================================

  async function checkContentWidth(tabId) {
    var result = await sendDebuggerCommand(tabId, 'Runtime.evaluate', {
      // Inject check script from MobileCheckScripts
      expression: `(${MobileCheckScripts.getContentWidthCheck.toString()})()`,
      returnByValue: true,
    });

    return result.result.value;
  }

  // ============================================
  // IMAGE SIZING CHECK
  // ============================================

  async function checkImageSizing(tabId) {
    var result = await sendDebuggerCommand(tabId, 'Runtime.evaluate', {
      // Inject check script from MobileCheckScripts
      expression: `(${MobileCheckScripts.getImageSizingCheck.toString()})()`,
      returnByValue: true,
    });

    return result.result.value;
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  // ============================================
  // PUBLIC API
  // ============================================

  return {
    analyzePage: analyzePage,
    LIGHTHOUSE_THRESHOLDS: LIGHTHOUSE_THRESHOLDS,
    MOBILE_USER_AGENT: MOBILE_USER_AGENT,
  };
})();

// Make available in service worker context
if (typeof self !== 'undefined') {
  self.MobileLighthouseAnalyzer = MobileLighthouseAnalyzer;
}
