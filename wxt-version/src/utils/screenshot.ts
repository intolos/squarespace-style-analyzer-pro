/**
 * Screenshot Utilities
 * Handles element cropping and screenshot capture coordination
 */

export class ScreenshotUtils {
  /**
   * Crop element screenshot from full page screenshot
   * @param fullScreenshot - Base64 data URL of full page
   * @param element - DOM element to crop
   * @param paddingPx - Padding around element in pixels (default 20)
   * @param allowReshoot - Whether to allow re-scrolling and re-capturing if outside viewport (default true)
   * @returns Promise<string | null> Base64 data URL of cropped element screenshot
   */
  static async captureElementScreenshot(
    fullScreenshot: string,
    element: Element | null,
    paddingPx: number = 20,
    allowReshoot: boolean = true
  ): Promise<string | null> {
    if (!element) return null;

    try {
      let rect = element.getBoundingClientRect();

      if (allowReshoot) {
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
          if (!response || !response.success) {
            console.warn('Failed to refresh screenshot for out-of-view element');
            // Continue with original screenshot if refresh fails, though it might be clipped
            if (!fullScreenshot) return null;
          } else {
            fullScreenshot = response.screenshot;
          }
        }
      }

      if (rect.width === 0 || rect.height === 0) return null;
      if (!fullScreenshot) return null;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

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
}
