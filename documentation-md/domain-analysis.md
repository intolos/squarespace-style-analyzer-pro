# Domain Analysis Documentation (`domain-analyzer.js`)

## Overview

This is the **Orchestrator** module. It does not perform checking itself; instead, it manages the _process_ of crawling a site, opening background tabs, injecting content scripts, and aggregating results.

## Critical Logic & workflow

### 1. Sitemap Discovery (`findSitemap`)

**Goal:** Find the list of URLs to analyze without user input.
**Strategy:**

- Checks standard locations: `/sitemap.xml`, `/sitemap_index.xml` (root and www subdomain).
- **Recursive Parsing:** If a sitemap contains `<sitemap>` tags (an index), it recursively fetches the child sitemaps to build a flat list of all page URLs.

### 2. The Analysis Loop (`analyzeDomain`)

**Goal:** Process a list of URLs reliably.

- ** throttling:** A configurable `delayBetweenPages` (default 2s) prevents rate-limiting by the server.
- **Cancellation:** Checks `this.shouldCancel` at every sync point (before fetch, after load, during analysis) to allow immediate user abort.

### 3. Background Tab Management (`analyzePageInBackground`)

**Goal:** Load a page in a hidden tab to run content scripts.

- **Retry Policy:** If a page fails to load, we retry with increasing timeouts:
  1.  15 seconds
  2.  20 seconds
  3.  25 seconds
- **Emergency Cleanup:** Tracks `tabId`s in `this.openTabs` to ensure tabs are closed even if the script crashes or is cancelled.
- **Squarespace Detection:** Before running full analysis, it checks `meta[name="generator"]` or known Squarespace classes (`.sqs-block`) to confirm the site is relevant.

### 4. Branching Logic (Mobile vs Desktop)

- **Desktop Mode:**
  - Opens tab.
  - Injects content script (`sqs-style-analyzer-main.js`).
  - Sends `analyzeStyles` message.
- **Mobile Mode:**
  - Calls `MobileLighthouseAnalyzer.analyzePage` which uses the Debugger API to emulate a mobile device and run Lighthouse audits.

## Reconstruction Guide (Code Structure)

```javascript
DomainAnalyzer.prototype = {
  // 1. Discovery
  findSitemap(domain) { ... },
  fetchAndParseSitemap(url) { ... },

  // 2. Orchestration
  analyzeDomain(domain, options) {
     // Get URLs -> Loop
     // Check Cancel -> analyzePageInBackground(url)
     // Merge Results -> Return
  },

  // 3. Execution
  analyzePageInBackground(url) {
     // Create hidden tab
     // Wait for 'complete' status
     // Check isSquarespace?
     // IF Mobile: Call MobileLighthouseAnalyzer
     // ELSE: Send 'analyzeStyles' message to content script
     // Close tab
  }
};
```
