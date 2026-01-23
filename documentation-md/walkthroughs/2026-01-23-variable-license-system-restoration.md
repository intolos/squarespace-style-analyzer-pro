# Variable-Based License System Restoration

**Date**: 2026-01-23  
**Objective**: Restore the original elegant variable-based architecture where `platform.ts` is the single source of truth for Product IDs, and the backend/client use metadata flags for logic and labeling.

---

## Changes Overview

### 1. Cloudflare Worker (`worker.js`)

- **Base Upgrade**: Replaced current worker with `worker-copy2.js` logic.
- **Purely Variable-Based**: Removed all hardcoded Product ID arrays. The worker now uses environment variables (`SQS_PRODUCT_ID_YEARLY`, etc.) for ID comparisons.
- **Enhanced Stamping**: The webhook now stamps ALL critical metadata flags onto the Stripe Customer object immediately after purchase:
  - `is_lifetime`: Permanent access flag.
  - `is_yearly`: Toggled active/inactive status.
  - `access_squarespace` & `access_website`: Cross-product grant flags.
- **Marketing Metadata**: Captures `original_purchase_extension` and `original_purchase_type` on the first sale to track attribution.
- **Self-Healing Webhook**: If a subscription is deleted or payment fails, the webhook now explicitly resets `metadata[is_yearly]` to `false`.
- **Priority Logic**: Updated `handleCheckEmail` to check `is_lifetime` FIRST and **STOP** if true. This ensures lifetime status always takes precedence over active yearly subscriptions.

### 2. Extension Client (`main.ts`)

- **Flag-Based UI**: Removed Product ID string comparisons.
- **Boolean Logic**: The UI now checks `record.is_lifetime === true` and `record.is_yearly === true` returned by the worker.
- **Priority Enforcement**: UI logic checks Lifetime status first, then Yearly.
- **Cleanup**: Removed `reportUnknownId` calls for license types, as the backend now handles classification via metadata flags.

### 3. Workflow & Documentation

- **New Rule**: Added Rule #6 to `CRITICAL-WORKFLOW-RULES.md` to mandate the variable-based worker architecture and forbid hardcoding IDs in `worker.js`.
- **Architecture Update**: Fully updated `license-system.md` with:
  - Detailed priority stack (Lifetime priority).
  - Lifecycle scenarios (Upgrade, Expiration, etc.).
  - Required environment variables list.
  - Marketing metadata explanation.

---

## Lifecycle Scenarios Verified

### Scenario: Lifetime Priority

If a user has both an active yearly sub and a new lifetime purchase:

- **Backend**: Checks `is_lifetime`, finds it, and stops. Returns a Lifetime record.
- **Frontend**: Checks `is_lifetime`, finds it, and stops. Shows "Premium Activated - Lifetime" in Purple.

### Scenario: Subscription Expiration

- **Worker**: Webhook resets `is_yearly` to `false`.
- **Extension**: Background check (24h) or manual "Check Status" sees `is_yearly: false` and `active: false`.
- **Result**: User is notified of expiration and UI reverts to Free tier.

### Scenario: Marketing Attribution

- Customer metadata now contains `original_purchase_extension` (e.g., 'squarespace').
- This allows tracking which extension actually drove the conversion in Stripe reports.

---

## Files Modified

- [`worker.js`](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/chrome-extension-files-js%20ver%204.2%203rd%20Post-Launch%20Version/squarespace-extension/cloudflare/worker.js)
- [`main.ts`](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/chrome-extension-files-js%20ver%204.2%203rd%20Post-Launch%20Version/squarespace-extension/wxt-version/entrypoints/popup/main.ts)
- [`critical-workflow-rules.md`](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/chrome-extension-files-js%20ver%204.2%203rd%20Post-Launch%20Version/squarespace-extension/.agent/rules/critical-workflow-rules.md)
- [`license-system.md`](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/chrome-extension-files-js%20ver%204.2%203rd%20Post-Launch%20Version/squarespace-extension/documentation-md/architecture/license-system.md)

---

## How to Deploy

1. **Stripe**: No changes needed.
2. **Cloudflare**:
   - Copy the new `worker.js` content to your Cloudflare Worker.
   - **IMPORTANT**: Set the 4 new environment variables in the Cloudflare Dashboard:
     - `SQS_PRODUCT_ID_YEARLY`
     - `SQS_PRODUCT_ID_LIFETIME`
     - `GENERIC_PRODUCT_ID_YEARLY`
     - `GENERIC_PRODUCT_ID_LIFETIME`
3. **Extension**: Rebuild and reload the extension.
