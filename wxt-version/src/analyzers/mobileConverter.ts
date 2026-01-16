/**
 * Mobile Results Converter
 * Single Responsibility: Convert Lighthouse-style results to the extension's issue format
 */

export const MobileResultsConverter = {
  // Main Conversion Function
  convertToMobileIssues(lighthouseResults: any, pageUrl: string): any[] {
    const issues: any[] = [];

    // Convert viewport issues
    if (lighthouseResults.viewport) {
      this.convertViewportIssues(lighthouseResults.viewport, issues, pageUrl);
    }

    // Convert tap target issues
    if (lighthouseResults.tapTargets) {
      this.convertTapTargetIssues(lighthouseResults.tapTargets, issues, pageUrl);
    }

    // Convert content width issues
    if (lighthouseResults.contentWidth) {
      this.convertContentWidthIssues(lighthouseResults.contentWidth, issues, pageUrl);
    }

    // Convert image sizing issues
    if (lighthouseResults.imageSizing) {
      this.convertImageSizingIssues(lighthouseResults.imageSizing, issues, pageUrl);
    }

    return issues;
  },

  // Viewport Conversion
  convertViewportIssues(viewportData: any, issues: any[], pageUrl: string): void {
    const pathname = new URL(pageUrl).pathname;

    if (!viewportData.exists) {
      issues.push({
        type: 'viewport-missing',
        severity: 'error',
        element: 'META',
        url: pageUrl,
        navigationName: pathname,
        section: 'head',
        block: 'meta',
        details: {
          actual: 'missing',
          required: '<meta name="viewport" content="width=device-width, initial-scale=1">',
        },
      });
    } else if (!viewportData.isOptimal) {
      issues.push({
        type: 'viewport-improper',
        severity: 'error',
        element: 'META',
        url: pageUrl,
        navigationName: pathname,
        section: 'head',
        block: 'meta',
        details: {
          actual: viewportData.content,
          required: 'width=device-width, initial-scale=1',
        },
      });
    }

    // Accessibility checks
    if (viewportData.blocksZoom) {
      issues.push({
        type: 'viewport-blocks-zoom',
        severity: 'error',
        element: 'META',
        url: pageUrl,
        navigationName: pathname,
        section: 'head',
        block: 'meta',
        details: {
          actual: 'user-scalable=no',
          required: 'user-scalable=yes or omit (accessibility standard)',
        },
      });
    }

    if (viewportData.limitsZoom) {
      issues.push({
        type: 'viewport-limits-zoom',
        severity: 'error',
        element: 'META',
        url: pageUrl,
        navigationName: pathname,
        section: 'head',
        block: 'meta',
        details: {
          actual: 'maximum-scale=' + viewportData.maxScaleValue,
          required: 'maximum-scale ≥5 or omit (accessibility standard)',
        },
      });
    }
  },

  // Tap Target Conversion
  convertTapTargetIssues(tapTargets: any[], issues: any[], pageUrl: string): void {
    const pathname = new URL(pageUrl).pathname;

    for (const issue of tapTargets) {
      if (issue.type === 'size') {
        issues.push({
          type: 'touch-target-too-small',
          severity: 'error',
          element: issue.element,
          selector: issue.selector,
          text: issue.text || '',
          url: pageUrl,
          navigationName: pathname,
          section: 'body',
          block: 'interactive-element',
          details: {
            actual: issue.width + 'x' + issue.height + 'px',
            recommended: '≥' + issue.minRequired + 'x' + issue.minRequired + 'px',
            width: issue.width,
            height: issue.height,
            fontSize: issue.fontSize,
            href: issue.href || null,
          },
          elementScreenshot: issue.elementScreenshot || null,
          elementContext: issue.elementContext || null,
        });
      } else if (issue.type === 'spacing') {
        issues.push({
          type: 'touch-target-spacing',
          severity: 'warning',
          element: issue.element,
          selector: issue.selector,
          text: issue.text || '',
          url: pageUrl,
          navigationName: pathname,
          section: 'body',
          block: 'interactive-element',
          details: {
            actual: issue.overlapPercent + '% overlap with nearby tap target',
            recommended:
              '≤25% overlap (Lighthouse standard), maintain ≥' + issue.minRequired + 'px spacing',
            nearElement: issue.nearElement,
            href: issue.href || null,
          },
          elementScreenshot: issue.elementScreenshot || null,
          elementContext: issue.elementContext || null,
        });
      }
    }
  },

  // Content Width Conversion
  convertContentWidthIssues(contentWidth: any, issues: any[], pageUrl: string): void {
    if (contentWidth.hasHorizontalScroll) {
      const pathname = new URL(pageUrl).pathname;
      issues.push({
        type: 'horizontal-scroll',
        severity: 'error',
        element: 'DOCUMENT',
        url: pageUrl,
        navigationName: pathname,
        section: 'page',
        block: 'document',
        details: {
          actual: contentWidth.contentWidth + 'px content width',
          required: contentWidth.viewportWidth + 'px (viewport width)',
          overflow: contentWidth.overflowAmount + 'px',
        },
      });
    }
  },

  // Image Sizing Conversion
  convertImageSizingIssues(imageSizing: any[], issues: any[], pageUrl: string): void {
    const pathname = new URL(pageUrl).pathname;

    for (const issue of imageSizing) {
      issues.push({
        type: 'image-oversized',
        severity: 'warning',
        element: issue.element,
        text: issue.alt,
        url: pageUrl,
        navigationName: pathname,
        section: 'body',
        block: 'image',
        selector: issue.selector,
        details: {
          src: issue.src,
          displaySize: issue.displaySize,
          naturalSize: issue.naturalSize,
          ratio: issue.ratio + 'x display size',
          wastedPixels: issue.wastedPixels.toLocaleString() + ' pixels',
        },
      });
    }
  },

  // Viewport Meta Tag Result
  convertViewportMeta(viewportData: any): any {
    if (!viewportData) {
      return {
        exists: false,
        content: null,
        isProper: false,
      };
    }
    return {
      exists: viewportData.exists,
      content: viewportData.content || null,
      isProper: viewportData.isOptimal || false,
    };
  },
};
