# Mobile Analysis Documentation (`mobile-lighthouse-analyzer.js`)

## Overview

This module brings "Google-grade" accuracy to mobile testing by using the **Chrome DevTools Protocol (CDP)** instead of just resizing the window. It emulates a real physical device at the engine level.

## Critical Logic & "The Why"

### 1. Chrome Debugger Protocol (`chrome.debugger`)

**Why:** Simply resizing the browser window (`window.resizeTo`) is unreliable because:

- It doesn't trigger mobile-specific CSS media queries correctly on all sites.
- It doesn't change the `User-Agent`.
- It doesn't emulate touch events or pixel density (DPR).
  **Solution:** `MobileLighthouseAnalyzer` attaches to the tab via CDP (`1.3` protocol).

### 2. Device Emulation

We explicitly override device metrics to match a **Moto G Power / Pixel 5** class device:

- **Dimensions:** 412 x 823 px
- **DPR (Device Pixel Ratio):** 2.625
- **User Agent:** Android 11 / Chrome Mobile
  **Why:** This ensures the site serves the _actual_ mobile version, including any server-side UA sniffing.

### 3. The Audit Suite

Instead of generic "responsiveness" checks, we run specific accessibility/usability audits:

1.  **Viewport Meta:** Verifies `width=device-width, initial-scale=1`.
2.  **Tap Targets:** Checks if interactive elements (buttons, links) are at least **16px** wide/tall (User customized threshold) and have **8px** spacing.
3.  **Content Width:** Detects horizontal scrolling (content overflowing the viewport).
4.  **Image Sizing:** Flags images that are wider than the screen (causing layout breaks).

### 4. Code Structure & Workflow

```javascript
/* Workflow */
// 1. Attach Debugger
await chrome.debugger.attach({ tabId }, '1.3');

// 2. Emulate Mobile
await sendCommand('Emulation.setDeviceMetricsOverride', { ... });
await sendCommand('Emulation.setUserAgentOverride', { ... });

// 3. Inject Analysis Scripts
// We use 'Runtime.evaluate' to run checks inside the mobile context
const results = await runAudits();

// 4. Capture "Context" (Desktop View)
// We temporarily reset to Desktop (1280x800) to take screenshots.
// Why? Users are on Desktop when viewing reports; seeing the "Mobile Issue"
// in the context of the Desktop layout is often more helpful for locating it.
await sendCommand('Emulation.clearDeviceMetricsOverride');
await captureScreenshots();

// 5. Detach
await chrome.debugger.detach({ tabId });
```
