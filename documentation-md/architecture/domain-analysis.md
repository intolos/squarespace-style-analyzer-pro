# Domain Analysis Documentation (`src/analyzers/domain/`)

## Overview

This is the **Orchestrator** module. It manages the process of crawling a site, opening background tabs, injecting content scripts, and aggregating results.

- **Main Orchestrator:** `src/analyzers/domain/index.ts`
- **Page Analysis Logic:** `src/analyzers/domain/pageAnalyzer.ts`

## Critical Logic & workflow

### 1. Sitemap Discovery (`findSitemap`)

**Goal:** Find the list of URLs to analyze without user input.
**Strategy:**

- Checks standard locations: `/sitemap.xml`, `/sitemap_index.xml` (root and www subdomain).
- **Recursive Parsing:** If a sitemap contains `<sitemap>` tags (an index), it recursively fetches the child sitemaps to build a flat list of all page URLs.

### 2. The Analysis Loop (`analyzeDomain`)

**Goal:** Process a list of URLs reliably.

- **Throttling:** A configurable `delayBetweenPages` (default 2s) prevents rate-limiting by the server.
- **Cancellation:** Checks a cancellation flag at every sync point (before fetch, after load, during analysis) to allow immediate user abort.

### 3. Background Tab Management (`analyzePageInBackground`)

**Goal:** Load a page in a hidden tab to run content scripts.

- **Retry Policy:** If a page fails to load, we retry with increasing timeouts (15s, 20s, 25s).
- **Emergency Cleanup:** Tracks `tabId`s to ensure tabs are closed even if the script crashes or is cancelled.
- **Platform Detection:** Before running full analysis, it checks `meta[name="generator"]` or known platform classes to confirm site relevance.

### 4. Branching Logic (Mobile vs Desktop)

- **Desktop Mode:**
  - Opens tab.
  - WXT automatically handles content script injection (`entrypoints/content.ts`).
  - Communicates via `chrome.runtime.sendMessage`.
- **Mobile Mode:**
  - Calls `src/analyzers/mobileLighthouse.ts` which uses the Debugger API to emulate a mobile device and run audits.

## Reconstruction Guide (Code Structure)

```typescript
// From src/analyzers/domain/index.ts
export const DomainAnalyzer = {
  // 1. Discovery
  async findSitemap(domain: string): Promise<string[]> { ... },

  // 2. Orchestration
  async analyzeDomain(domain: string, options: DomainAnalysisOptions): Promise<AnalysisResults> {
     // Get URLs -> Loop
     // Check Cancel -> analyzePage(url)
     // Merge Results -> Return
  },
};

// From src/analyzers/domain/pageAnalyzer.ts
export async function analyzePage(url: string, ...): Promise<PageAnalysisResult> {
   // Create hidden tab
   // Wait for 'complete' status
   // Check Platform
   // IF Mobile: Call MobileLighthouseAnalyzer
   // ELSE: Send 'analyzeStyles' message to content script
   // Close tab
}
```
