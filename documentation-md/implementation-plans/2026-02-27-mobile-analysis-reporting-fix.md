# Implementation Plan - Mobile Analysis Fixes

## Overview

This plan covers two critical mobile analysis fixes:

1.  **Mobile Domain Analysis Crash**: Fixes a bug where "analyze domain mobile only" fails on all pages except the first with "Failed to construct 'URL': Invalid URL".
2.  **Mobile Reporting Logic**: Ensures that when mobile analysis is skipped (Analyze Without Mobile), the report accurately shows "not analyzed" instead of a false "Pass".

## Proposed Changes

### 1. Mobile Analysis Crash Fix

#### [MODIFY] [pageAnalyzer.ts](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/src/analyzers/domain/pageAnalyzer.ts)

Correct the variable typo when passing the URL to the mobile issues converter.

```diff
-  data.metadata.title || url
+  pageUrl
```

### 2. Mobile Reporting Logic

#### [MODIFY] [resultsManager.ts](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/src/managers/resultsManager.ts)

Propagate the `mobileAnalysisPerformed` flag using "OR" logic during domain result merging.

#### [MODIFY] [mobileReport.ts](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/src/export/mobileReport.ts)

Strictly use the `mobileAnalysisPerformed` flag to determine if "not analyzed" should be shown.

## Verification Plan

### Manual Verification

1.  **Mobile Analysis**: Run "Analyze Domain Mobile Only" and verify that it processes multiple pages without crashing.
2.  **Reporting**: Run "Analyze Without Mobile" and verify the report shows "not analyzed".
