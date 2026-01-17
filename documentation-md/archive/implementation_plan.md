# WXT Migration Implementation Plan

**Date**: January 15, 2026  
**Goal**: Migrate to WXT framework with dual-extension build capability  
**Related**: [PRODUCT_STRATEGY.md](../../PRODUCT_STRATEGY.md), [code-review-findings.md](../squarespace-extension/documentation-md/code-review-findings.md)

---

## Overview

Migrate from vanilla Chrome Extension to WXT framework while implementing:

1. Single codebase producing **two branded extensions**
2. **Platform-adaptive functionality** (auto-detect SQS, WordPress, etc.)
3. **TypeScript** for better maintainability
4. **Modular platform modules** for future expansion

---

## Technology Stack Decisions

### WXT Framework

**What it is**: A modern framework for building browser extensions (like Next.js for web apps)
**Why use it**:

- Hot module reloading during development
- Built-in TypeScript support
- Environment variable handling for dual builds
- Automatic manifest generation

### TypeScript

**What it is**: JavaScript with type checking (catches errors before runtime)
**Why use it**: Better code quality, IDE autocomplete, easier refactoring
**Migration**: WXT handles this automatically

### Tailwind CSS - **NOT RECOMMENDED**

**What it is**: Utility-first CSS framework
**Why NOT use it**:

- Your current CSS (`popup.css`) works well
- Tailwind adds complexity without benefit for this project
- Would require learning new syntax
- **Recommendation**: Keep your existing CSS approach

### React/Vue - **OPTIONAL**

**What they are**: UI frameworks for building component-based interfaces
**Current state**: Your popup uses vanilla HTML/JS which is simple and works
**Recommendation**:

- **Start without React/Vue** - keep the simple approach
- Can add later if popup becomes more complex
- WXT supports both if needed in future

---

## Phase 1: Project Setup

### 1.1 Initialize WXT Project

```bash
# Create new WXT project alongside existing code
npx wxt@latest init wxt-version --template vanilla

# Install dependencies
cd wxt-version
npm install
```

### 1.2 Project Structure

```
/wxt-version
├── wxt.config.ts           # WXT configuration with env-based branding
├── package.json
├── tsconfig.json
├── .env.sqs                # Squarespace version env vars
├── .env.generic            # Generic version env vars
│
├── /src
│   ├── /entrypoints
│   │   ├── background.ts          # Service worker
│   │   ├── popup/
│   │   │   ├── index.html
│   │   │   ├── main.ts
│   │   │   └── App.vue or .tsx    # Optional: framework
│   │   └── content.ts             # Main content script
│   │
│   ├── /platforms                  # Platform-specific modules
│   │   ├── index.ts               # Platform detector + registry
│   │   ├── squarespace/
│   │   │   ├── selectors.ts
│   │   │   ├── dataAttributes.ts
│   │   │   └── themeCapture.ts
│   │   ├── wordpress/             # Future
│   │   │   └── selectors.ts
│   │   └── generic/
│   │       └── selectors.ts
│   │
│   ├── /analyzers                  # Core analysis logic
│   │   ├── buttons.ts
│   │   ├── headings.ts
│   │   ├── paragraphs.ts
│   │   ├── images.ts
│   │   ├── links.ts
│   │   └── colors.ts
│   │
│   ├── /export                     # Report generation
│   │   ├── htmlReports.ts
│   │   ├── styleGuide.ts
│   │   ├── imagesReport.ts
│   │   └── mobileReport.ts
│   │
│   ├── /utils
│   │   ├── helpers.ts
│   │   ├── domHelpers.ts
│   │   └── colorUtils.ts
│   │
│   └── /config
│       └── branding.ts            # Build-time branding config
│
└── /public
    └── icons/
```

### 1.3 Environment Files

**.env.sqs**

```env
VITE_PRODUCT_NAME="Squarespace Style Analyzer Pro"
VITE_PRODUCT_ID="squarespace-style-analyzer"
VITE_IS_SQS_VERSION=true
VITE_API_BASE="https://squarespace-style-analyzer-pro.eamass.workers.dev"
VITE_ICON_BASE="https://intolos.github.io/squarespace-style-analyzer-pro"
```

**.env.generic**

```env
VITE_PRODUCT_NAME="Website Style Analyzer Pro"
VITE_PRODUCT_ID="website-style-analyzer"
VITE_IS_SQS_VERSION=false
VITE_API_BASE="https://website-style-analyzer-pro.eamass.workers.dev"
VITE_ICON_BASE="https://intolos.github.io/website-style-analyzer-pro"
```

### 1.4 Build Scripts

**package.json**

```json
{
  "scripts": {
    "dev:sqs": "wxt --env-file .env.sqs",
    "dev:generic": "wxt --env-file .env.generic",
    "build:sqs": "wxt build --env-file .env.sqs",
    "build:generic": "wxt build --env-file .env.generic",
    "zip:sqs": "wxt zip --env-file .env.sqs",
    "zip:generic": "wxt zip --env-file .env.generic"
  }
}
```

---

## Phase 2: Core Configuration

### 2.1 WXT Config

**wxt.config.ts**

```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: process.env.VITE_PRODUCT_NAME,
    description:
      process.env.VITE_IS_SQS_VERSION === 'true'
        ? 'Professional design audit tool for Squarespace websites'
        : 'Professional design audit tool for any website',
    permissions: ['activeTab', 'scripting', 'storage', 'tabs'],
    host_permissions: ['<all_urls>'],
  },
  modules: ['@wxt-dev/module-vue'], // Optional: if using Vue
});
```

### 2.2 Branding Config

**src/config/branding.ts**

```typescript
export const BRANDING = {
  productName: import.meta.env.VITE_PRODUCT_NAME,
  productId: import.meta.env.VITE_PRODUCT_ID,
  isSqsVersion: import.meta.env.VITE_IS_SQS_VERSION === 'true',
  apiBase: import.meta.env.VITE_API_BASE,
  iconBase: import.meta.env.VITE_ICON_BASE,
};
```

---

## Phase 3: Platform Detection

### 3.1 Platform Detector

**src/platforms/index.ts**

```typescript
export type Platform = 'squarespace' | 'wordpress' | 'wix' | 'webflow' | 'generic';

export interface PlatformInfo {
  platform: Platform;
  detected: boolean;
  elementCount: number;
  message: string;
}

export function detectPlatform(): PlatformInfo {
  // Squarespace detection
  const isSqs = !!(
    document.querySelector('meta[name="generator"][content*="Squarespace"]') ||
    document.querySelector('.sqs-block')
  );

  if (isSqs) {
    return {
      platform: 'squarespace',
      detected: true,
      elementCount: 15,
      message: `We have detected a Squarespace website. We have automatically included 15 Squarespace-specific elements into our analysis.`,
    };
  }

  // WordPress detection
  const isWP = !!(
    document.querySelector('meta[name="generator"][content*="WordPress"]') ||
    document.querySelector('.wp-block')
  );

  if (isWP) {
    return {
      platform: 'wordpress',
      detected: true,
      elementCount: 0, // TBD
      message: `We have detected a WordPress website.`,
    };
  }

  // Generic fallback
  return {
    platform: 'generic',
    detected: false,
    elementCount: 0,
    message: '',
  };
}
```

### 3.2 Platform Selectors

**src/platforms/squarespace/selectors.ts**

```typescript
export const SQS_BUTTON_SELECTORS = [
  'a[class*="sqs-button"]',
  'a[class*="sqs-block-button"]',
  '.sqs-block-button-element',
  '.sqs-button-element--primary',
  '.sqs-button-element--secondary',
  '.sqs-button-element--tertiary',
];

export const SQS_NAV_SELECTORS = [
  'nav[data-content-field="navigation"]',
  '.header-nav',
  '.header-nav-wrapper',
  '.header-menu',
  '[data-nc-group="top"]',
];

// etc.
```

---

## Phase 4: Migration Order

Migrate files in this order to minimize risk:

| Order | File(s)                           | Priority | Notes             |
| ----- | --------------------------------- | -------- | ----------------- |
| 1     | `content-script-helpers.js`       | High     | ✅ Done           |
| 2     | `content-script-analyzers.js`     | High     | ✅ Done           |
| 3     | `content-script-theme-capture.js` | Medium   | ✅ Done           |
| 4     | `color-analyzer.js`               | Medium   | ✅ Done           |
| 5     | `export-*.js` (all 5 files)       | Medium   | ⏳ 3/5 Done       |
| 6     | `domain-analyzer.js`              | High     | Complex, refactor |
| 7     | `domain-analysis-manager.js`      | High     | Core logic        |
| 8     | `background.js`                   | High     | Service worker    |
| 9     | `popup.js` + `popup.html`         | Medium   | UI                |
| 10    | `license-manager.js`              | Low      | API calls         |

---

## Phase 5: Verification

### 5.1 Automated Tests

- Unit tests for platform detection
- Unit tests for analyzers
- E2E tests with Playwright or Puppeteer

### 5.2 Manual Testing Matrix

| Site Type        | SQS Version        | Generic Version                 |
| ---------------- | ------------------ | ------------------------------- |
| Squarespace site | ✓ Full analysis    | ✓ SQS detection + bonus message |
| WordPress site   | ✓ Generic analysis | ✓ WP detection (future)         |
| Static HTML      | ✓ Generic analysis | ✓ Generic analysis              |
| Wix site         | ✓ Generic analysis | ✓ Wix detection (future)        |

---

## Timeline Estimate

| Phase                       | Duration   | Dependencies |
| --------------------------- | ---------- | ------------ |
| Phase 1: Setup              | 2-3 hours  | None         |
| Phase 2: Config             | 1-2 hours  | Phase 1      |
| Phase 3: Platform Detection | 2-3 hours  | Phase 2      |
| Phase 4: Migration          | 8-12 hours | Phase 3      |
| Phase 5: Testing            | 4-6 hours  | Phase 4      |

**Total: ~20-26 hours** (can be spread over multiple sessions)

---

## Pre-Migration Checklist

- [x] Code review findings documented
- [x] Squarespace-specific elements cataloged
- [x] Debug flags implemented
- [x] Product strategy documented
- [x] Backup current working version (`v4.2.8-stable` tag exists)
- [ ] Test current extension one more time before migration

---

## Code Review Integration

Outstanding issues from [code-review-findings.md](../squarespace-extension/documentation-md/code-review-findings.md) to address **during** migration:

### Address During `domain-analyzer.js` Migration (Phase 4, Order 6)

| Issue | Description                                                 | Action                                                                                        |
| ----- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| #2    | `analyzePageInBackground` 460 lines, duplicated retry logic | Extract helpers: `createEmptyMobileResponse()`, `runMobileAnalysis()`, `runDesktopAnalysis()` |
| #4    | `mergeAllResults` 340 lines                                 | Extract: `mergeButtons()`, `mergeHeadings()`, `mergeParagraphs()`, etc.                       |
| #5    | Repeated merge pattern                                      | Create generic `mergeLocationsObject()` helper                                                |

### Already Fixed ✅

| Issue | Description                 | Status               |
| ----- | --------------------------- | -------------------- |
| #1    | Duplicate `settings` object | ✅ Fixed             |
| #3    | Excessive debug logging     | ✅ DEBUG flags added |

### Address During WXT Migration (Low Priority)

| Issue | Description            | When                                             |
| ----- | ---------------------- | ------------------------------------------------ |
| #10   | `var` vs `const`/`let` | TypeScript migration will enforce `const`/`let`  |
| #7    | Large export files     | Consider splitting into modules during migration |
