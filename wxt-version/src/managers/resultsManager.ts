// managers/resultsManager.ts
// Handles loading, saving, merging, and counting analysis results

import { type ReportData } from '../export/types';

export const ResultsManager = {
  // ============================================
  // STORAGE OPERATIONS
  // ============================================

  async loadAccumulatedResults(): Promise<ReportData | null> {
    const data = await chrome.storage.local.get(['accumulatedResults']);
    return (data.accumulatedResults as ReportData) || null;
  },

  async saveAccumulatedResults(results: ReportData): Promise<void> {
    await chrome.storage.local.set({ accumulatedResults: results });
  },

  async clearAccumulatedResults(): Promise<void> {
    await chrome.storage.local.remove('accumulatedResults');
  },

  // ============================================
  // RESULTS MERGING
  // ============================================

  normalizePath(pathname: string): string {
    if (!pathname) return '';
    let normalized = pathname.replace(/\/+$/, '');
    if (normalized === '') normalized = '/';
    return normalized;
  },

  mergeResults(
    accumulatedResults: ReportData | null,
    newResults: ReportData
  ): { merged: ReportData; alreadyAnalyzed: boolean } {
    if (!accumulatedResults) {
      const merged = { ...newResults };
      merged.metadata.pagesAnalyzed = [this.normalizePath(newResults.metadata.pathname || '')];
      return { merged, alreadyAnalyzed: false };
    }

    const normalizedNewPath = this.normalizePath(newResults.metadata.pathname || '');

    if (
      accumulatedResults.metadata.pagesAnalyzed &&
      accumulatedResults.metadata.pagesAnalyzed.includes(normalizedNewPath)
    ) {
      return {
        merged: accumulatedResults,
        alreadyAnalyzed: true,
      };
    }

    // Merge site styles
    if (newResults.siteStyles) {
      if (!accumulatedResults.siteStyles) {
        accumulatedResults.siteStyles = {};
      }
      for (const style in newResults.siteStyles) {
        const styleObj = newResults.siteStyles[style];
        if (!styleObj) continue;

        if (!styleObj.locations) {
          styleObj.locations = [];
        }

        if (!accumulatedResults.siteStyles[style]) {
          accumulatedResults.siteStyles[style] = {
            ...styleObj,
            locations: [...styleObj.locations],
          };
        } else {
          const accStyle = accumulatedResults.siteStyles[style];
          if (!accStyle.locations) {
            accStyle.locations = [];
          }
          accStyle.locations = accStyle.locations.concat(styleObj.locations);
        }
      }
    }

    // Merge buttons
    if (newResults.buttons) {
      for (const btnType in newResults.buttons) {
        const btnObj = newResults.buttons[btnType];
        if (!btnObj) continue;

        if (!btnObj.locations) {
          btnObj.locations = [];
        }

        if (!accumulatedResults.buttons[btnType]) {
          accumulatedResults.buttons[btnType] = {
            locations: [...btnObj.locations],
          };
        } else {
          if (!accumulatedResults.buttons[btnType].locations) {
            accumulatedResults.buttons[btnType].locations = [];
          }
          accumulatedResults.buttons[btnType].locations = accumulatedResults.buttons[
            btnType
          ].locations.concat(btnObj.locations);
        }
      }
    }

    // Merge links
    if (!accumulatedResults.links) {
      accumulatedResults.links = { 'in-content': { locations: [] } };
    }
    if (newResults.links && newResults.links['in-content']) {
      if (!newResults.links['in-content'].locations) {
        newResults.links['in-content'].locations = [];
      }
      if (!accumulatedResults.links['in-content'].locations) {
        accumulatedResults.links['in-content'].locations = [];
      }
      accumulatedResults.links['in-content'].locations = accumulatedResults.links[
        'in-content'
      ].locations.concat(newResults.links['in-content'].locations);
    }

    // Merge mobile issues
    if (!accumulatedResults.mobileIssues) {
      accumulatedResults.mobileIssues = {
        viewportMeta: { exists: false, content: null, isProper: false },
        issues: [],
      };
    }
    if (newResults.mobileIssues) {
      if (newResults.mobileIssues.viewportMeta && newResults.mobileIssues.viewportMeta.exists) {
        accumulatedResults.mobileIssues.viewportMeta = newResults.mobileIssues.viewportMeta;
      }
      if (newResults.mobileIssues.issues) {
        accumulatedResults.mobileIssues.issues = accumulatedResults.mobileIssues.issues.concat(
          newResults.mobileIssues.issues
        );
      }
    }

    // Merge images
    accumulatedResults.images = (accumulatedResults.images || []).concat(newResults.images || []);

    // Merge color palette
    if (!accumulatedResults.colorPalette) {
      accumulatedResults.colorPalette = newResults.colorPalette;
    } else if (newResults.colorPalette) {
      const allColors = new Set(
        (accumulatedResults.colorPalette.all || []).concat(newResults.colorPalette.all || [])
      );
      const bgColors = new Set(
        (accumulatedResults.colorPalette.backgrounds || []).concat(
          newResults.colorPalette.backgrounds || []
        )
      );
      const textColors = new Set(
        (accumulatedResults.colorPalette.text || []).concat(newResults.colorPalette.text || [])
      );
      const borderColors = new Set(
        (accumulatedResults.colorPalette.borders || []).concat(
          newResults.colorPalette.borders || []
        )
      );

      accumulatedResults.colorPalette.all = Array.from(allColors);
      accumulatedResults.colorPalette.backgrounds = Array.from(bgColors);
      accumulatedResults.colorPalette.text = Array.from(textColors);
      accumulatedResults.colorPalette.borders = Array.from(borderColors);
    }

    // Merge colorData
    if (newResults.colorData) {
      if (!accumulatedResults.colorData) {
        accumulatedResults.colorData = {
          colors: {},
          contrastPairs: [],
        };
      }

      if (newResults.colorData.colors) {
        for (const hex in newResults.colorData.colors) {
          const colorInfo = newResults.colorData.colors[hex];

          if (!accumulatedResults.colorData.colors[hex]) {
            accumulatedResults.colorData.colors[hex] = {
              count: colorInfo.count,
              usedAs: [...(colorInfo.usedAs || [])],
              instances: [...(colorInfo.instances || [])],
            };
          } else {
            accumulatedResults.colorData.colors[hex].count += colorInfo.count;

            if (colorInfo.usedAs) {
              for (const usage of colorInfo.usedAs) {
                if (!accumulatedResults.colorData.colors[hex].usedAs.includes(usage)) {
                  accumulatedResults.colorData.colors[hex].usedAs.push(usage);
                }
              }
            }

            if (colorInfo.instances) {
              accumulatedResults.colorData.colors[hex].instances =
                accumulatedResults.colorData.colors[hex].instances.concat(colorInfo.instances);
            }
          }
        }
      }

      if (newResults.colorData.contrastPairs && newResults.colorData.contrastPairs.length > 0) {
        accumulatedResults.colorData.contrastPairs =
          accumulatedResults.colorData.contrastPairs.concat(newResults.colorData.contrastPairs);
      }
    }

    // Merge headings
    if (newResults.headings) {
      for (const headingType in newResults.headings) {
        const headingObj = newResults.headings[headingType];
        if (!headingObj) continue;

        if (!headingObj.locations) {
          headingObj.locations = [];
        }

        if (!accumulatedResults.headings[headingType]) {
          accumulatedResults.headings[headingType] = { locations: [] };
        }
        if (!accumulatedResults.headings[headingType].locations) {
          accumulatedResults.headings[headingType].locations = [];
        }
        accumulatedResults.headings[headingType].locations = accumulatedResults.headings[
          headingType
        ].locations.concat(headingObj.locations);
      }
    }

    // Merge paragraphs
    if (newResults.paragraphs) {
      for (const paragraphType in newResults.paragraphs) {
        const paraObj = newResults.paragraphs[paragraphType];
        if (!paraObj) continue;

        if (!paraObj.locations) {
          paraObj.locations = [];
        }

        if (!accumulatedResults.paragraphs[paragraphType]) {
          accumulatedResults.paragraphs[paragraphType] = { locations: [] };
        }
        if (!accumulatedResults.paragraphs[paragraphType].locations) {
          accumulatedResults.paragraphs[paragraphType].locations = [];
        }
        accumulatedResults.paragraphs[paragraphType].locations = accumulatedResults.paragraphs[
          paragraphType
        ].locations.concat(paraObj.locations);
      }
    }

    // Merge quality checks
    if (newResults.qualityChecks) {
      if (!accumulatedResults.qualityChecks) {
        accumulatedResults.qualityChecks = {};
      }
      for (const check in newResults.qualityChecks) {
        if (!accumulatedResults.qualityChecks[check]) {
          accumulatedResults.qualityChecks[check] = [];
        }
        const newCheckData = newResults.qualityChecks[check] || [];
        accumulatedResults.qualityChecks[check] = (
          accumulatedResults.qualityChecks[check] || []
        ).concat(newCheckData);
      }
    }

    // Add page to analyzed list
    if (!accumulatedResults.metadata.pagesAnalyzed) {
      accumulatedResults.metadata.pagesAnalyzed = [];
    }
    accumulatedResults.metadata.pagesAnalyzed.push(
      this.normalizePath(newResults.metadata.pathname || '')
    );

    return { merged: accumulatedResults, alreadyAnalyzed: false };
  },

  // ============================================
  // RESULTS COUNTING & HELPERS
  // ============================================

  countCategory(categoryData: Record<string, any>): number {
    let count = 0;
    for (const key in categoryData) {
      if (categoryData[key].locations) {
        count += categoryData[key].locations.length;
      }
    }
    return count;
  },

  getCounts(accumulatedResults: ReportData | null) {
    if (!accumulatedResults) {
      return {
        headings: 0,
        paragraphs: 0,
        buttons: 0,
        styles: 0,
        pages: 0,
      };
    }

    return {
      headings: this.countCategory(accumulatedResults.headings || {}),
      paragraphs: this.countCategory(accumulatedResults.paragraphs || {}),
      buttons: this.countCategory(accumulatedResults.buttons || {}),
      styles: Object.keys(accumulatedResults.siteStyles || {}).length,
      pages: (accumulatedResults.metadata?.pagesAnalyzed || []).length,
    };
  },

  isPageAnalyzed(accumulatedResults: ReportData, pathname: string): boolean {
    if (
      !accumulatedResults ||
      !accumulatedResults.metadata ||
      !accumulatedResults.metadata.pagesAnalyzed
    ) {
      return false;
    }
    return accumulatedResults.metadata.pagesAnalyzed.includes(pathname);
  },

  isMobileOnlyData(accumulatedResults: ReportData | null): boolean {
    if (!accumulatedResults) return false;

    const headingCount = Object.values(accumulatedResults.headings || {}).reduce(
      (sum: number, h: any) => sum + (h.locations?.length || 0),
      0
    );
    const paragraphCount = Object.values(accumulatedResults.paragraphs || {}).reduce(
      (sum: number, p: any) => sum + (p.locations?.length || 0),
      0
    );
    const buttonCount = Object.values(accumulatedResults.buttons || {}).reduce(
      (sum: number, b: any) => sum + (b.locations?.length || 0),
      0
    );

    return headingCount === 0 && paragraphCount === 0 && buttonCount === 0;
  },

  hasMobileData(accumulatedResults: ReportData | null): boolean {
    if (!accumulatedResults) return false;

    const mobileIssues = accumulatedResults.mobileIssues;
    if (!mobileIssues) return false;

    const issues = mobileIssues.issues || [];
    if (issues.length > 0) return true;

    const viewportMeta = mobileIssues.viewportMeta;
    if (viewportMeta && viewportMeta.content !== null) {
      return true;
    }

    if (viewportMeta && (viewportMeta.exists === true || viewportMeta.isProper === true)) {
      return true;
    }

    return false;
  },

  // ============================================
  // UI DISPLAY
  // ============================================

  displayResults(accumulatedResults: ReportData | null): void {
    const resultsSectionEl = document.getElementById('resultsSection');
    const pagesAnalyzedInfoEl = document.getElementById('pagesAnalyzedInfo');

    if (!accumulatedResults) {
      if (resultsSectionEl) resultsSectionEl.style.setProperty('display', 'none', 'important');
      if (pagesAnalyzedInfoEl)
        pagesAnalyzedInfoEl.style.setProperty('display', 'none', 'important');
      return;
    }

    const counts = this.getCounts(accumulatedResults);

    // Update count displays
    const headingsCountEl = document.getElementById('headingsCount');
    const paragraphsCountEl = document.getElementById('paragraphsCount');
    const buttonsCountEl = document.getElementById('buttonsCount');
    const pagesCountEl = document.getElementById('pagesCount');

    if (headingsCountEl) headingsCountEl.textContent = counts.headings.toString();
    if (paragraphsCountEl) paragraphsCountEl.textContent = counts.paragraphs.toString();
    if (buttonsCountEl) buttonsCountEl.textContent = counts.buttons.toString();
    if (pagesCountEl) pagesCountEl.textContent = counts.pages.toString();

    // Show results sections
    if (pagesAnalyzedInfoEl) pagesAnalyzedInfoEl.style.setProperty('display', 'block', 'important');
    if (resultsSectionEl) resultsSectionEl.style.setProperty('display', 'block', 'important');
  },

  hideResults(): void {
    const resultsSectionEl = document.getElementById('resultsSection');
    const pagesAnalyzedInfoEl = document.getElementById('pagesAnalyzedInfo');

    if (resultsSectionEl) resultsSectionEl.style.display = 'none';
    if (pagesAnalyzedInfoEl) pagesAnalyzedInfoEl.style.display = 'none';
  },

  async resetAnalysis(
    showSuccessCallback?: (msg: string) => void,
    hideMessagesCallback?: () => void
  ): Promise<boolean> {
    // In migrated version, we'll use the provided callbacks or standard alerts
    // For now, let's keep it simple as the confirmation logic is usually in the UI layer
    // but we can add the basic clearing here.
    await this.clearAccumulatedResults();
    this.hideResults();
    if (hideMessagesCallback) hideMessagesCallback();
    return true;
  },
};
