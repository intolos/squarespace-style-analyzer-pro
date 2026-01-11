// results-manager.js - Results Management
// Handles loading, saving, merging, displaying, and resetting analysis results

const ResultsManager = {
  // ============================================
  // STORAGE OPERATIONS
  // ============================================

  // Load accumulated results from Chrome storage
  loadAccumulatedResults: async function () {
    const data = await chrome.storage.local.get(['accumulatedResults']);
    return data.accumulatedResults || null;
  },

  // Save accumulated results to Chrome storage
  saveAccumulatedResults: async function (results) {
    await chrome.storage.local.set({ accumulatedResults: results });
  },

  // Clear accumulated results from Chrome storage
  clearAccumulatedResults: async function () {
    await chrome.storage.local.remove('accumulatedResults');
  },

  // ============================================
  // RESULTS MERGING
  // ============================================

  // Normalize pathname for consistent comparison
  // Removes trailing slashes and ensures consistent format
  normalizePath: function (pathname) {
    if (!pathname) return '';
    // Remove trailing slash (except for root path '/')
    let normalized = pathname.replace(/\/+$/, '');
    // Ensure we always have at least '/'
    if (normalized === '') normalized = '/';
    return normalized;
  },

  // Merge new page results into accumulated results
  // Returns the merged results object
  mergeResults: function (accumulatedResults, newResults) {
    // If no accumulated results, use new results as base
    if (!accumulatedResults) {
      const merged = { ...newResults };
      merged.metadata.pagesAnalyzed = [this.normalizePath(newResults.metadata.pathname)];
      return { merged: merged, alreadyAnalyzed: false };
    }

    // Normalize the new pathname for comparison
    const normalizedNewPath = this.normalizePath(newResults.metadata.pathname);

    // Check if page was already analyzed (using normalized paths)
    if (accumulatedResults.metadata.pagesAnalyzed.includes(normalizedNewPath)) {
      return {
        merged: accumulatedResults,
        alreadyAnalyzed: true,
      };
    }

    // Merge site styles
    if (newResults.siteStyles) {
      for (const style in newResults.siteStyles) {
        const styleObj = newResults.siteStyles[style];
        if (!styleObj) continue;

        // Ensure locations array exists
        if (!styleObj.locations) {
          styleObj.locations = [];
        }

        if (!accumulatedResults.siteStyles[style]) {
          accumulatedResults.siteStyles[style] = {
            ...styleObj,
            locations: [...styleObj.locations],
          };
        } else {
          if (!accumulatedResults.siteStyles[style].locations) {
            accumulatedResults.siteStyles[style].locations = [];
          }
          accumulatedResults.siteStyles[style].locations = accumulatedResults.siteStyles[
            style
          ].locations.concat(styleObj.locations);
        }
      }
    }

    // Merge buttons
    if (newResults.buttons) {
      for (const btnType in newResults.buttons) {
        const btnObj = newResults.buttons[btnType];
        if (!btnObj) continue;

        // Ensure locations array exists
        if (!btnObj.locations) {
          btnObj.locations = [];
        }

        if (!accumulatedResults.buttons[btnType]) {
          accumulatedResults.buttons[btnType] = { locations: [...btnObj.locations] };
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

    // Merge links (structured format)
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
      // Update viewport meta if the new result has it
      if (newResults.mobileIssues.viewportMeta && newResults.mobileIssues.viewportMeta.exists) {
        accumulatedResults.mobileIssues.viewportMeta = newResults.mobileIssues.viewportMeta;
      }
      // Merge issues
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
    } else {
      const allColors = new Set(
        accumulatedResults.colorPalette.all.concat(newResults.colorPalette.all)
      );
      const bgColors = new Set(
        accumulatedResults.colorPalette.backgrounds.concat(newResults.colorPalette.backgrounds)
      );
      const textColors = new Set(
        accumulatedResults.colorPalette.text.concat(newResults.colorPalette.text)
      );
      const borderColors = new Set(
        accumulatedResults.colorPalette.borders.concat(newResults.colorPalette.borders)
      );

      accumulatedResults.colorPalette.all = Array.from(allColors);
      accumulatedResults.colorPalette.backgrounds = Array.from(bgColors);
      accumulatedResults.colorPalette.text = Array.from(textColors);
      accumulatedResults.colorPalette.borders = Array.from(borderColors);
    }

    // ============================================
    // ADD: Merge colorData for comprehensive color analysis
    // ============================================
    if (newResults.colorData) {
      // Initialize colorData if it doesn't exist in accumulated results
      if (!accumulatedResults.colorData) {
        accumulatedResults.colorData = {
          colors: {},
          contrastPairs: [],
        };
      }

      // Merge colors
      if (newResults.colorData.colors) {
        for (const hex in newResults.colorData.colors) {
          const colorInfo = newResults.colorData.colors[hex];

          if (!accumulatedResults.colorData.colors[hex]) {
            // First time seeing this color - copy it
            accumulatedResults.colorData.colors[hex] = {
              count: colorInfo.count,
              usedAs: [...(colorInfo.usedAs || [])],
              instances: [...(colorInfo.instances || [])],
            };
          } else {
            // Color already exists - merge the data
            accumulatedResults.colorData.colors[hex].count += colorInfo.count;

            // Merge usedAs array (unique values only)
            if (colorInfo.usedAs) {
              for (const usage of colorInfo.usedAs) {
                if (!accumulatedResults.colorData.colors[hex].usedAs.includes(usage)) {
                  accumulatedResults.colorData.colors[hex].usedAs.push(usage);
                }
              }
            }

            // Merge instances array
            if (colorInfo.instances) {
              accumulatedResults.colorData.colors[hex].instances =
                accumulatedResults.colorData.colors[hex].instances.concat(colorInfo.instances);
            }
          }
        }
      }

      // Merge contrastPairs
      if (newResults.colorData.contrastPairs && newResults.colorData.contrastPairs.length > 0) {
        accumulatedResults.colorData.contrastPairs =
          accumulatedResults.colorData.contrastPairs.concat(newResults.colorData.contrastPairs);
      }
    }
    // ============================================
    // END: colorData merge
    // ============================================

    // Merge headings
    if (newResults.headings) {
      for (const headingType in newResults.headings) {
        const headingObj = newResults.headings[headingType];
        if (!headingObj) continue;

        // Ensure locations array exists
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

        // Ensure locations array exists
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
    for (const check in newResults.qualityChecks) {
      if (!accumulatedResults.qualityChecks[check]) {
        accumulatedResults.qualityChecks[check] = [];
      }
      const newCheckData = newResults.qualityChecks[check] || [];
      accumulatedResults.qualityChecks[check] =
        accumulatedResults.qualityChecks[check].concat(newCheckData);
    }

    // Add page to analyzed list (using normalized path)
    accumulatedResults.metadata.pagesAnalyzed.push(
      this.normalizePath(newResults.metadata.pathname)
    );

    return { merged: accumulatedResults, alreadyAnalyzed: false };
  },

  // ============================================
  // RESULTS COUNTING
  // ============================================

  // Count total items in a category (headings, paragraphs, buttons)
  countCategory: function (categoryData) {
    let count = 0;
    for (const key in categoryData) {
      if (categoryData[key].locations) {
        count += categoryData[key].locations.length;
      }
    }
    return count;
  },

  // Get all counts from accumulated results
  getCounts: function (accumulatedResults) {
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

  // ============================================
  // UI DISPLAY
  // ============================================

  // Display results in the popup UI
  displayResults: function (accumulatedResults) {
    const resultsSectionEl = document.getElementById('resultsSection');
    const pagesAnalyzedInfoEl = document.getElementById('pagesAnalyzedInfo');

    if (!accumulatedResults) {
      if (resultsSectionEl) resultsSectionEl.style.display = 'none';
      if (pagesAnalyzedInfoEl) pagesAnalyzedInfoEl.style.display = 'none';
      return;
    }

    const counts = this.getCounts(accumulatedResults);

    // Update count displays
    const headingsCountEl = document.getElementById('headingsCount');
    const paragraphsCountEl = document.getElementById('paragraphsCount');
    const buttonsCountEl = document.getElementById('buttonsCount');
    const pagesCountEl = document.getElementById('pagesCount');

    if (headingsCountEl) headingsCountEl.textContent = counts.headings;
    if (paragraphsCountEl) paragraphsCountEl.textContent = counts.paragraphs;
    if (buttonsCountEl) buttonsCountEl.textContent = counts.buttons;
    if (pagesCountEl) pagesCountEl.textContent = counts.pages;

    // Show results sections
    if (pagesAnalyzedInfoEl) pagesAnalyzedInfoEl.style.display = 'block';
    if (resultsSectionEl) resultsSectionEl.style.display = 'block';
  },

  // Hide results UI
  hideResults: function () {
    const resultsSectionEl = document.getElementById('resultsSection');
    const pagesAnalyzedInfoEl = document.getElementById('pagesAnalyzedInfo');

    if (resultsSectionEl) resultsSectionEl.style.display = 'none';
    if (pagesAnalyzedInfoEl) pagesAnalyzedInfoEl.style.display = 'none';
  },

  // ============================================
  // RESET FUNCTIONALITY
  // ============================================

  // Reset all analysis data with confirmation
  resetAnalysis: async function (showSuccessCallback, hideMessagesCallback) {
    const confirmed = await customConfirm(
      'This will clear all accumulated analysis data from multiple pages. Are you sure?'
    );

    if (confirmed) {
      await this.clearAccumulatedResults();
      this.hideResults();

      if (hideMessagesCallback) hideMessagesCallback();

      customAlert('Analysis data cleared! You can now start fresh.');

      return true; // Reset was performed
    }

    return false; // Reset was cancelled
  },

  // ============================================
  // VALIDATION
  // ============================================

  // Check if results exist and are valid
  hasResults: function (accumulatedResults) {
    return (
      accumulatedResults !== null &&
      accumulatedResults !== undefined &&
      typeof accumulatedResults === 'object'
    );
  },

  // Check if a specific page has been analyzed
  isPageAnalyzed: function (accumulatedResults, pathname) {
    if (
      !accumulatedResults ||
      !accumulatedResults.metadata ||
      !accumulatedResults.metadata.pagesAnalyzed
    ) {
      return false;
    }
    return accumulatedResults.metadata.pagesAnalyzed.includes(pathname);
  },

  // Get list of analyzed pages
  getAnalyzedPages: function (accumulatedResults) {
    if (!accumulatedResults || !accumulatedResults.metadata) {
      return [];
    }
    return accumulatedResults.metadata.pagesAnalyzed || [];
  },

  // Check if data is from mobile-only analysis (all design fields empty)
  isMobileOnlyData: function (accumulatedResults) {
    if (!accumulatedResults) return false;

    // Check if all design data is empty (mobile-only analysis)
    const headingCount = Object.values(accumulatedResults.headings || {}).reduce(
      (sum, h) => sum + (h.locations?.length || 0),
      0
    );
    const paragraphCount = Object.values(accumulatedResults.paragraphs || {}).reduce(
      (sum, p) => sum + (p.locations?.length || 0),
      0
    );
    const buttonCount = Object.values(accumulatedResults.buttons || {}).reduce(
      (sum, b) => sum + (b.locations?.length || 0),
      0
    );

    return headingCount === 0 && paragraphCount === 0 && buttonCount === 0;
  },

  // Check if data contains mobile analysis results
  hasMobileData: function (accumulatedResults) {
    if (!accumulatedResults) return false;

    // Check if mobileIssues exists
    const mobileIssues = accumulatedResults.mobileIssues;
    if (!mobileIssues) return false;

    // Check if there are any mobile issues
    const issues = mobileIssues.issues || [];
    if (issues.length > 0) return true;

    // Check if viewport meta was actually analyzed (content will not be null if analyzed)
    const viewportMeta = mobileIssues.viewportMeta;
    if (viewportMeta && viewportMeta.content !== null) {
      return true; // Mobile analysis was performed
    }

    // If viewport exists but was never analyzed, mobile analysis was still performed
    if (viewportMeta && (viewportMeta.exists === true || viewportMeta.isProper === true)) {
      return true;
    }

    return false; // No mobile analysis was performed
  },
};

// Make globally available
window.ResultsManager = ResultsManager;
