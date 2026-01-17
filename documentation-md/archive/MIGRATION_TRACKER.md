# Master Migration Tracker

> **Note:** The file `EXPORT_MIGRATION_STATUS.md` has been deprecated and deleted. All tracking is now consolidated here.

**Status:** In Progress
**Goal:** 100% Migration of Legacy JavaScript to WXT TypeScript Architecture.

## 🏗️ Refactoring Candidates (>500 LOC)

The following files are too large and MUST be broken down into smaller modules during migration.

| Legacy File                   | Lines | Strategy                                                                      | Status  |
| ----------------------------- | ----- | ----------------------------------------------------------------------------- | ------- |
| `domain-analyzer.js`          | 1197  | Split into `crawler`, `analyzer`, `reporter` logic in `src/analyzers/domain/` | ✅ Done |
| `content-script-analyzers.js` | 972   | Split into individual analyzers: `typography.ts`, `buttons.ts`, `links.ts`    | ✅ Done |
| `domain-analysis-manager.js`  | 874   | Separate state management from orchestration logic                            | ✅ Done |
| `content-script-helpers.js`   | 841   | Categorize into `domUtils`, `textUtils`, `styleUtils`                         | ✅ Done |
| `color-analyzer.js`           | 715   | Refactor into `ColorExtractor` class and helper methods                       | ✅ Done |
| `domain-analysis-ui.js`       | 663   | Turn into a proper UI component (Vue/React or modular DOM)                    | ✅ Done |
| `background.js`               | 655   | Split into `listeners.ts`, `handlers.ts`, `storage.ts`                        | ✅ Done |
| `sqs-style-analyzer-main.js`  | 632   | Simplify into a clean entrypoint that delegates to managers                   | ✅ Done |

## 🔴 Critical: Not Yet Migrated

The following files contain core logic and MUST be migrated for the extension to function.

### 1. Managers & Utilities

| Legacy File           | Target WXT Path                        | Status        | Priority |
| --------------------- | -------------------------------------- | ------------- | -------- |
| `license-manager.js`  | `src/managers/licenseManager.ts`       | ✅ Done       | High     |
| `results-manager.js`  | `src/managers/resultsManager.ts`       | ✅ Done       | High     |
| `storage-manager.js`  | `src/utils/storage.ts`                 | ✅ Done       | Medium   |
| `utils.js`            | `src/utils/common.ts`                  | ✅ Done       | Medium   |
| `ui-helpers.js`       | `src/utils/uiHelpers.ts`               | ✅ Done       | Medium   |
| `contrast-checker.js` | `src/utils/colorUtils.ts` (Logic Only) | ✅ Logic Done | Low      |

### 2. Analyzers (Content Script)

| Legacy File                       | Target WXT Path                                                                               | Status  | Priority |
| --------------------------------- | --------------------------------------------------------------------------------------------- | ------- | -------- |
| `content-script-analyzers.js`     | `src/analyzers/buttons.ts`, `typography.ts`, `links.ts`, `images.ts`                          | ✅ Done | High     |
| `color-analyzer.js`               | `src/analyzers/colors.ts`                                                                     | ✅ Done | High     |
| `content-script-theme-capture.js` | `src/analyzers/themeCapture.ts`                                                               | ✅ Done | High     |
| `content-script-helpers.js`       | `src/utils/domHelpers.ts`, `src/analyzers/styleExtractor.ts`, `src/analyzers/colorScanner.ts` | ✅ Done | High     |

### 3. Mobile Analysis

| Legacy File                     | Target WXT Path                     | Status  | Priority |
| ------------------------------- | ----------------------------------- | ------- | -------- |
| `mobile-lighthouse-analyzer.js` | `src/analyzers/mobileLighthouse.ts` | ✅ Done | Medium   |
| `mobile-results-converter.js`   | `src/analyzers/mobileConverter.ts`  | ✅ Done | Medium   |
| `mobile-check-scripts.js`       | `src/analyzers/mobileScripts.ts`    | ✅ Done | Medium   |

### 4. Domain / Multi-Page Analysis

| Legacy File                  | Target WXT Path                       | Status  | Priority |
| ---------------------------- | ------------------------------------- | ------- | -------- |
| `domain-analyzer.js`         | `src/analyzers/domain/` (Broken down) | ✅ Done | High     |
| `domain-analysis-manager.js` | `src/managers/domainAnalysis.ts`      | ✅ Done | High     |
| `domain-analysis-ui.js`      | `src/ui/domainAnalysisUI.ts`          | ✅ Done | Medium   |
| `page-selection-ui.js`       | `src/ui/pageSelectionUI.ts`           | ✅ Done | Low      |

### 5. Main Entrypoints (The "Brain")

| `popup.js` | `entrypoints/popup/main.ts` | ✅ Done | High |

---

## ✅ Completed (Exports)

| Legacy File                           | New TypeScript Module                  |
| ------------------------------------- | -------------------------------------- | ------- |
| `export-manager.js`                   | `src/export/index.ts`                  |
| `export-csv.js`                       | `src/export/csv.ts`                    |
| `export-images-report.js`             | `src/export/imagesReport.ts`           |
| `export-mobile-report.js`             | `src/export/mobileReport.ts`           |
| `export-style-guide.js`               | `src/export/styleGuide.ts`             |
| `export-style-guide-colors-report.js` | `src/export/styleGuideColorsReport/`   | ✅ Done |
| `export-aggregated-styles-report.js`  | `src/export/aggregatedStylesReport.ts` | ✅ Done |
| `export-page-by-page-report.js`       | `src/export/pageByPageReport.ts`       | ✅ Done |
| `export-html-reports.js`              | `src/export/htmlReports.ts`            | ✅ Done |
| `export-style-guide.js`               | `src/export/styleGuide.ts`             | ✅ Done |
| `export-manager.js`                   | `src/export/index.ts`                  | ✅ Done |
| `style-comparison-utils.js`           | `src/utils/styleComparisonUtils.ts`    |

- `entrypoints/content.ts` is now valid.
- `entrypoints/background.ts` is now valid.
- `entrypoints/popup` is now valid (Main UI migrated).

---

**Next Steps**:

1.  **Verify and Test**: Build the extension and test all functionalities (Single Page, Domain Analysis, Exports).
2.  **Cleanup**: Remove any legacy JS files that are no longer referenced.
