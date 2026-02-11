 
import { test, expect, chromium } from '@playwright/test';
import path from 'path';

// Point to the POC extension in the artifacts directory
const ENC_EXTENSION_PATH = '/Users/edmass/.gemini/antigravity/brain/f27a9fa1-fdad-4e21-8b11-5164053bd0ff/debug-poc';

test.describe('Debugger API Screenshot POC', () => {

  test('can capture screenshot of inactive tab via debugger', async () => {
    console.log(`Launching browser with extension at: ${ENC_EXTENSION_PATH}`);
    
    // Use a unique user data dir
    const userDataDir = '/tmp/test-user-data-' + Date.now();

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${ENC_EXTENSION_PATH}`,
        `--load-extension=${ENC_EXTENSION_PATH}`,
      ],
    });

    // Wait for service worker
    let sw = context.serviceWorkers()[0];
    if (!sw) {
      console.log("Waiting for service worker...");
      sw = await context.waitForEvent('serviceworker'); 
    }
    
    console.log("Service worker found. Running test...");
    
    // Evaluate code in the service worker to trigger the test message
    const result = await sw.evaluate(async () => {
      // Create a promise wrapper for sendMessage since evaluate context is isolated
      return new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: "runTest" }, (response) => {
              resolve(response);
          });
      });
    });
    
    console.log("Test Result:", JSON.stringify(result, null, 2));
    
    expect(result.success).toBe(true);
    expect(result.size).toBeGreaterThan(0);
    
    await context.close();
  });
});
