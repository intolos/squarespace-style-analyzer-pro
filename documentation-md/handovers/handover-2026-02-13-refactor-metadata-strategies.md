# Handover: Refactor Metadata Extraction to Strategy Pattern

**Date:** 2026-01-31
**Priority:** High (To replace temporary fixes)
**Owner:** Engineering
**Status:** Planned

---

## 1. Context & Problem

We currently support multiple platforms (Squarespace, WordPress, Wix, Webflow) but our logic for extracting `Section` and `Block` metadata is heavily Squarespace-concentric, with ad-hoc `if/else` checks added for WordPress.

Additionally, our filtering logic for false positives (e.g., typing cursors, button wrappers) is duplicated across `content.ts` (Axe-core) and `colors.ts` (Custom Analyzers). This resulted in regression loops where fixing one analyzer left the other broken.

**Current State (The "Bandaid"):**

- `domHelpers.ts` has a monolithic `getSectionInfo` with mixed platform logic.
- `colors.ts` and `content.ts` both contain regex filters for cursors.

## 2. Proposed Solution: Metadata Strategy Pattern

We need to refactor `domHelpers.ts` to use a **Strategy Pattern**.

### 2.1 Interface Definition

```typescript
interface PlatformStrategy {
  name: string;
  detect(element: Element): boolean; // Is this element part of this platform?
  getSectionInfo(element: Element): string;
  getBlockInfo(element: Element): string;
  shouldIgnore(element: Element): boolean; // Centralized false-positive filtering
}
```

### 2.2 Concrete Strategies

We need to implement specific strategies for all supported platforms:

1.  **SquarespaceStrategy**
    - `detect`: check for `yui` IDs or `static1.squarespace.com` assets.
    - `getSectionInfo`: `data-section-id`, generic fallback.
    - `getBlockInfo`: `data-block-id`, `block-*` IDs.
    - `shouldIgnore`: Squarespace generic loaders.

2.  **WordPressStrategy**
    - `detect`: `wp-block-*` classes, `wp-content` paths.
    - `getSectionInfo`: `wp-block-group`, `wp-block-cover`, `wp-block-columns`.
    - `getBlockInfo`: `wp-block-*` class mapping (e.g. `wp-block-button` -> "Button").
    - `shouldIgnore`: `wp-block-button` (wrapper), `admin-bar`.

3.  **WixStrategy** (Placeholder - To Be Implemented)
    - `detect`: `wix-site`, `data-wix-id`.
    - `getSectionInfo`: `comp-*` IDs.
    - `shouldIgnore`: Wix overlays.

4.  **WebflowStrategy** (Placeholder - To Be Implemented)
    - `detect`: `w-webflow-badge`, `.w-section`.
    - `getSectionInfo`: `.section`, `.container`.

5.  **GenericStrategy** (Fallback)
    - Uses semantic HTML (`<main>`, `<article>`).
    - Uses Class Name fallback (as implemented in recent fix).
    - Catches typing cursors (Regex `|`).

### 2.3 Centralized Validator

Create a `ContentValidator` service that uses the active strategies to determine if an element should be analyzed. This removes the duplicate filters in `content.ts` and `colors.ts`.

## 3. Implementation Steps

1.  Create `src/strategies/PlatformManager.ts`.
2.  Move current `Squarespace` logic to `src/strategies/SquarespaceStrategy.ts`.
3.  Move current `WordPress` logic to `src/strategies/WordPressStrategy.ts`.
4.  Refactor `domHelpers.ts` to delegate to `PlatformManager.currentStrategy`.
5.  Refactor `content.ts` and `colors.ts` to use `PlatformManager.shouldIgnore(element)`.

## 4. Benefits

- **Clean Code:** Removes "spaghetti code" in `domHelpers`.
- **Scalability:** Adding Wix/Webflow support becomes just adding a new file, not checking logic.
- **Robustness:** False positive filters are defined ONCE per platform.
