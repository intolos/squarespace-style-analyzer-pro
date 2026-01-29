# Contact Email Mapping

This document tracks all locations where contact email addresses appear within the Squarespace Style Analyzer Pro codebase and its associated hosted pages. This is critical for maintaining consistency between the Squarespace (SQS) and Generic (Website) versions of the extension.

## Dynamic Mapping Logic

To accommodate both extension versions (Squarespace and Generic), a dynamic mapping is implemented in the core project source.

### [Platform Configuration](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/src/utils/platform.ts)

The `questionsEmail` property in `platformStrings` is determined at build-time/run-time based on the `isSqs` flag:

```typescript
// wxt-version/src/utils/platform.ts
export const questionsEmail = isSqs
  ? 'webbyinsights+squarespace@gmail.com'
  : 'webbyinsights+website@gmail.com';
```

## Implementation Locations

### 1. Extension Popup UI

- **File**: [wxt-version/entrypoints/popup/index.html](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/entrypoints/popup/index.html)
  - **Element**: `<a id="uiContactEmail">`
  - **Behavior**: The link is dynamically updated by the `SquarespaceAnalyzer` class on initialization. The surrounding text leads directly into the link (e.g., "...please Contact Us by Email").
- **File**: [wxt-version/entrypoints/popup/main.ts](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/entrypoints/popup/main.ts)
  - **Logic**: `updatePlatformBranding()` sets the `href` and text for `#uiContactEmail`.
  - **Logic**: `checkPremiumStatus()` uses `questionsEmail` in the error alert message.

### 2. Extension Welcome Pages

These are internal extension assets stored in the `public` directory.

- **Squarespace**: [wxt-version/public-sqs/welcome.html](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/public-sqs/welcome.html)
  - **Email**: `webbyinsights+squarespace@gmail.com`
- **Generic**: [wxt-version/public-generic/welcome.html](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/public-generic/welcome.html)
  - **Email**: `webbyinsights+website@gmail.com`

## External/Hosted Pages (Static)

> [!IMPORTANT]
> These folders contain static HTML versions of the benefits and success pages hosted on GitHub Pages. They should generally NOT be modified by automated scripts unless a full site-wide branding update is required.

### 1. [benefits-sqs/](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/benefits-sqs/)

- `cancel.html`
- `index.html`
- `privacy-policy.html`
- `success-lifetime.html`
- `success-yearly.html`
- `terms-of-service.html`
- `welcome.html`

### 2. [benefits-generic/](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/benefits-generic/)

- `cancel.html`
- `index.html`
- `privacy-policy.html`
- `success-lifetime.html`
- `success-yearly.html`
- `terms-of-service.html`
- `welcome.html`

## Legacy Records (Do Not Modify)

### [legacy-extension/](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/legacy-extension/)

Contains historical references such as `squarespacetools@gmail.com` and `webbyinsights@gmail.com`. These are kept for reference and should remain untouched.
