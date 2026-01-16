import { MobileCheckScripts } from './mobileScripts';

// Constants
const MOBILE_DEVICE_CONFIG = {
  width: 412,
  height: 823,
  deviceScaleFactor: 2.625,
  mobile: true,
  screenWidth: 412,
  screenHeight: 823,
};

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36';

const LIGHTHOUSE_THRESHOLDS = {
  minTapTargetSize: 16,
  minTapTargetSpacing: 8,
};

export const MobileLighthouseAnalyzer = {
  // Main Analysis Function
  async analyzePage(tabId: number, pageUrl: string, additionalIssues: any[] = []): Promise<any> {
    const results = {
      url: pageUrl,
      viewport: null,
      tapTargets: [] as any[],
      fontSize: [] as any[],
      contentWidth: null,
      imageSizing: [] as any[],
      userAgent: MOBILE_USER_AGENT,
    };

    try {
      // Step 1: Attach debugger
      await this.attachDebugger(tabId);

      // Step 2: Set mobile device emulation
      await this.setMobileEmulation(tabId);

      // Step 3: Set mobile user agent
      await this.setMobileUserAgent(tabId);

      // Step 4: Enable required DevTools domains
      await this.enableDevToolsDomains(tabId);

      // Step 5: Wait for page to stabilize
      await this.delay(1000);

      // Step 6: Run all checks
      results.viewport = await this.checkViewport(tabId);
      results.tapTargets = await this.checkTapTargets(tabId);
      results.contentWidth = await this.checkContentWidth(tabId);
      results.imageSizing = await this.checkImageSizing(tabId);

      // Step 9: Detach debugger (Screenshots skipped as per original comment)
      await this.detachDebugger(tabId);

      return results;
    } catch (error) {
      // Try to cleanup
      try {
        await this.resetToDesktopView(tabId);
        await this.detachDebugger(tabId);
      } catch (e) {
        // Ignore cleanup errors
      }
      throw error;
    }
  },

  // Debugger Management
  attachDebugger(tabId: number): Promise<void> {
    return chrome.debugger.attach({ tabId: tabId }, '1.3');
  },

  detachDebugger(tabId: number): Promise<void> {
    return chrome.debugger.detach({ tabId: tabId });
  },

  sendDebuggerCommand(tabId: number, method: string, params: any = {}): Promise<any> {
    return chrome.debugger.sendCommand({ tabId: tabId }, method, params);
  },

  // Emulation Setup
  setMobileEmulation(tabId: number): Promise<void> {
    return this.sendDebuggerCommand(
      tabId,
      'Emulation.setDeviceMetricsOverride',
      MOBILE_DEVICE_CONFIG
    );
  },

  resetToDesktopView(tabId: number): Promise<void> {
    return this.sendDebuggerCommand(tabId, 'Emulation.clearDeviceMetricsOverride', {});
  },

  setMobileUserAgent(tabId: number): Promise<void> {
    return this.sendDebuggerCommand(tabId, 'Emulation.setUserAgentOverride', {
      userAgent: MOBILE_USER_AGENT,
    });
  },

  enableDevToolsDomains(tabId: number): Promise<any[]> {
    return Promise.all([
      this.sendDebuggerCommand(tabId, 'DOM.enable'),
      this.sendDebuggerCommand(tabId, 'CSS.enable'),
      this.sendDebuggerCommand(tabId, 'Overlay.enable'),
    ]);
  },

  // Checks
  async checkViewport(tabId: number): Promise<any> {
    const result = await this.sendDebuggerCommand(tabId, 'Runtime.evaluate', {
      expression: `(${MobileCheckScripts.getViewportCheck.toString()})()`,
      returnByValue: true,
    });
    return result.result.value;
  },

  async checkTapTargets(tabId: number): Promise<any[]> {
    const options = {
      minSize: LIGHTHOUSE_THRESHOLDS.minTapTargetSize,
    };

    const result = await this.sendDebuggerCommand(tabId, 'Runtime.evaluate', {
      expression: `(${MobileCheckScripts.getTapTargetIssues.toString()})(${JSON.stringify(options)})`,
      returnByValue: true,
    });
    return result.result.value || [];
  },

  async checkContentWidth(tabId: number): Promise<any> {
    const result = await this.sendDebuggerCommand(tabId, 'Runtime.evaluate', {
      expression: `(${MobileCheckScripts.getContentWidthCheck.toString()})()`,
      returnByValue: true,
    });
    return result.result.value;
  },

  async checkImageSizing(tabId: number): Promise<any[]> {
    const result = await this.sendDebuggerCommand(tabId, 'Runtime.evaluate', {
      expression: `(${MobileCheckScripts.getImageSizingCheck.toString()})()`,
      returnByValue: true,
    });
    return result.result.value || [];
  },

  // Utility
  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
};
