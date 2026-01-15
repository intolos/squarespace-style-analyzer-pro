# Product Strategy: Dual Extension Architecture

**Last Updated**: January 15, 2026  
**Status**: Planning (Pre-WXT Migration)

---

## Vision

Maintain **two Chrome extensions** from a **single codebase**, differentiated by branding but sharing core functionality with platform-adaptive behavior.

---

## The Two Extensions

### 1. Squarespace Style Analyzer Pro

| Attribute         | Value                                       |
| ----------------- | ------------------------------------------- |
| **Target Market** | Squarespace developers, designers, agencies |
| **Branding**      | Squarespace-specific naming and messaging   |
| **Purpose**       | Niche marketing to SQS community            |
| **Reports**       | Include "Squarespace" in product name       |
| **Selectors**     | SQS-optimized selectors prioritized         |

### 2. Website Style Analyzer Pro

| Attribute         | Value                                                                               |
| ----------------- | ----------------------------------------------------------------------------------- |
| **Target Market** | All website developers (WordPress, Wix, static sites, etc.)                         |
| **Branding**      | Platform-neutral (no "Squarespace" wording)                                         |
| **Purpose**       | Broad appeal without alienating non-SQS users                                       |
| **Reports**       | Generic product name                                                                |
| **Selectors**     | Generic selectors prioritized, but **includes all platform-specific functionality** |

---

## Key Principle: Platform-Adaptive Functionality

> The generic version will analyze Squarespace sites too. When it does, it should use all available SQS-specific element detection - just without SQS branding.

### How This Works

```
Website Style Analyzer Pro
         │
         ▼
    ┌─────────────────┐
    │ Platform        │
    │ Detection       │
    └────────┬────────┘
             │
    ┌────────┴────────┐
    ▼                 ▼
[Squarespace]    [Other/Unknown]
    │                 │
    ▼                 ▼
Use SQS-specific   Use generic
selectors +        selectors
data attributes
    │                 │
    └────────┬────────┘
             ▼
    Same reports, same quality,
    no SQS branding shown
```

### Platform Detection (Auto)

```javascript
// Runs on every analyzed page
const platform = detectPlatform(); // 'squarespace' | 'wordpress' | 'wix' | 'generic'

// Functionality adapts, branding stays constant (based on build)
```

### Platform Detection Messaging (Generic Version Only)

> [!TIP]
> **Marketing Opportunity**: When the generic version detects a specific platform, display a bonus message to highlight the added value.

**Example Message for Squarespace Detection:**

```
🎯 We have detected a Squarespace website. We have automatically included
15 Squarespace-specific elements into our analysis which are automatically
reflected in our reports. That's a bonus for using our extension!
```

**Implementation:**

| Platform Detected | Message                                     | Element Count |
| ----------------- | ------------------------------------------- | ------------- |
| Squarespace       | "We have detected a Squarespace website..." | 15+ elements  |
| WordPress         | "We have detected a WordPress website..."   | TBD           |
| Wix               | "We have detected a Wix website..."         | TBD           |
| Webflow           | "We have detected a Webflow website..."     | TBD           |

**Where to Display:**

- Popup UI (after analysis starts)
- Report header (brief mention)
- Analysis summary section

**Variables:**

```javascript
const PLATFORM_MESSAGES = {
  squarespace: {
    detected: true,
    elementCount: 15, // Update as we finalize the count
    message: `We have detected a Squarespace website. We have automatically 
              included ${elementCount} Squarespace-specific elements into our 
              analysis which are automatically reflected in our reports. 
              That's a bonus for using our extension!`,
  },
  wordpress: { detected: false, elementCount: 0, message: '' },
  // etc.
};
```

---

## Build Configuration

| Config Key              | SQS Version                      | Generic Version              |
| ----------------------- | -------------------------------- | ---------------------------- |
| `PRODUCT_NAME`          | "Squarespace Style Analyzer Pro" | "Website Style Analyzer Pro" |
| `SHOW_SQS_BRANDING`     | `true`                           | `false`                      |
| `USE_SQS_FUNCTIONALITY` | Always                           | When SQS detected            |
| `API_ENDPOINT`          | SQS-specific                     | Generic                      |
| `PRODUCT_ID`            | `squarespace-style-analyzer`     | `website-style-analyzer`     |

---

## Future Expansion: Platform-Specific Modules

As demand is found, add platform-specific enhancements:

| Platform        | Priority | Rationale               |
| --------------- | -------- | ----------------------- |
| **Squarespace** | ✅ Done  | Already implemented     |
| **WordPress**   | High     | ~43% of all websites    |
| **Wix**         | Medium   | Large user base         |
| **Webflow**     | Medium   | Growing designer market |
| **Shopify**     | Medium   | E-commerce niche        |

### Module Structure (Post-WXT)

```
/src
  /platforms
    squarespace/
      selectors.ts
      dataAttributes.ts
      themeCapture.ts
    wordpress/
      selectors.ts      # wp-block-*, wp-content, etc.
      themeCapture.ts
    wix/
      selectors.ts
    generic/
      selectors.ts      # Fallback for unknown platforms
  /core
    platformDetector.ts
    analyzer.ts
```

---

## WXT Migration Goals

1. **Single codebase** with build-time configuration
2. **Two separate builds** outputting distinct extensions
3. **Shared core functionality** with platform detection
4. **Modular platform support** for future expansion
5. **TypeScript** for better maintainability

---

## Summary

| Aspect                | Squarespace Version              | Generic Version              |
| --------------------- | -------------------------------- | ---------------------------- |
| **Branding**          | SQS-specific text                | Platform-neutral             |
| **Target**            | SQS developers                   | All developers               |
| **SQS Detection**     | Always on                        | Auto-detected                |
| **SQS Functionality** | Always used                      | Used when SQS detected       |
| **Reports**           | "Squarespace Style Analyzer Pro" | "Website Style Analyzer Pro" |
| **Codebase**          | Shared                           | Shared                       |
| **Build**             | `npm run build:sqs`              | `npm run build:generic`      |
