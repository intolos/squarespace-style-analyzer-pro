# Dual Extension Build & Wording Instructions

This document explains how to manage, build, and deploy the two versions of the extension: **Squarespace Style Analyzer Pro** and **Website Style Analyzer Pro**.

## 1. Build & Deployment Commands

The build system is configured to use WXT "modes". Each mode loads its respective configuration and assets.

### Squarespace Style Analyzer Pro

- **Build**: `npm run build:sqs`
- **Zip for Store**: `npm run zip:sqs`
- **Output Folder**: `.output/chrome-mv3` (Note: Build outputs overwrite each other, so build one at a time).

### Website Style Analyzer Pro (Generic)

- **Build**: `npm run build:generic`
- **Zip for Store**: `npm run zip:generic`
- **Output Folder**: `.output/chrome-mv3`

---

## 2. Asset Management (Icons & Welcome Pages)

The assets are now split into version-specific folders. The `wxt.config.ts` file automatically selects the correct folder based on the build command.

- **Squarespace Assets**: Located in `wxt-version/public-sqs/`
  - Edit `welcome.html` here for Squarespace-specific onboarding.
  - Icons are in `public-sqs/icon/`.
- **Generic Assets**: Located in `wxt-version/public-generic/`
  - Edit `welcome.html` here for the generic onboarding.
  - Icons are in `public-generic/icon/`.

---

## 3. Dynamic Text Strategy (Work in Progress)

To avoid maintaining two separate sets of HTML files, we use environment variables.

### How to use variables in code:

In TypeScript files, you can use `import.meta.env.VITE_PRODUCT_NAME` or check `import.meta.env.VITE_IS_SQS_VERSION`.

### Plan for Popup UI:

1.  **Current Status**: `entrypoints/popup/index.html` has hardcoded "Squarespace" text.
2.  **Next Step**: Refactor `index.html` and `main.ts` to replace hardcoded strings with dynamic text populated at runtime.
    - Example: Replace `Squarespace Style Analyzer Pro` with a span `<span id="extName"></span>`.
    - Populate it in `main.ts`: `document.getElementById('extName').textContent = import.meta.env.VITE_PRODUCT_NAME;`

---

## 4. Troubleshooting: Extension Name/Icon not updating

If you load the extension in Chrome and still see "style-analyzer-pro":

1.  **Ensure you built with a mode**: Use `npm run build:sqs`. A plain `npm run build` uses default settings which might lack the name.
2.  **Manifest Check**: Open `.output/chrome-mv3/manifest.json`. If the `name` field is not "Squarespace Style Analyzer Pro", the environment variables were not picked up correctly during the build.
3.  **Reload**: Always click the "Reload" icon in `chrome://extensions` after building.

---

## 5. Specific Differences Between Versions

To ensure each extension feels native to its target audience, several dynamic changes differentiate the "Squarespace" vs "Website" (Generic) versions:

### Branding & Text

- **Extension Name**: "Squarespace Style Analyzer Pro" vs "Website Style Analyzer Pro".
- **Audit Title**: "Professional Squarespace Design Audit" vs "Professional Website Design Audit".
- **Developer Bio**: The generic version removes "from Squarespace Tools" and the disclaimer about Squarespace Circle affiliation.
- **Why Use Section**: Title changes to "Why Would You Use Website Style Analyzer Pro?".
- **Hidden Sections (Generic Only)**:
  - "Not a Squarespace Site" warning is hidden.
  - "Quick Squarespace Detection" use case is hidden.

### Reports

- **Report Titles**: "Squarespace Style Analysis Report" vs "Website Style Analysis Report".
- **Filenames**: Exported files use `[domain]-squarespace-[report]` vs `[domain]-style-analyzer-[report]`.

### Licensing (Stripe)

- **Product/Price IDs**: The generic version uses a separate set of Stripe Product and Price IDs for both Yearly and Lifetime plans.
- **Success/Cancel URLs**: Redirects to `website-style-analyzer-pro` GitHub pages instead of the `squarespace-style-analyzer-pro` path.
