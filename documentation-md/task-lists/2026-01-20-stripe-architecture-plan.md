# Architecture Redesign: Dynamic & Cross-Product Licensing

## Overview

This plan implements a unified "App Group" logic in the Cloudflare Worker to allow cross-product access between Squarespace and Generic extension versions.

## Goals

1. **Dynamic & Stable**: Avoid hardcoding Stripe Price IDs in the worker.
2. **Cross-Product Access**: Buying Lifetime or Yearly for one app unlocks the other.
3. **Isolation**: Future unrelated apps can use the same infrastructure without cross-unlocking.

## Implementation Details

### 1. App Group Logic

- Modified [createCheckoutSession](file:///Users/edmass/Downloads/Squarespace Style Analyzer Pro/chrome-extension-files-js ver 4.2 3rd Post-Launch Version/squarespace-extension/wxt-version/src/managers/licenseManager.ts#75-115) to include `metadata.app_group = 'style_analyzer'`.
- This metadata is propagated to subscriptions, sessions, and charges.

### 2. Priority-Based Validation (`handleCheckEmail`)

The worker now follows a strict hierarchy to find the "best" license:

1.  **Manual Override**: Checks `customer.metadata.is_lifetime === 'true'`.
2.  **Lifetime Sessions**: Checks Checkout Sessions for `mode: 'payment'` + `status: 'complete'`.
    - _Robustness_: Accepts `amount_total === 0` to support $0 coupons.
3.  **Charges**: Fallback for one-time payments.
4.  **Yearly Subscriptions**: Checks for active subscriptions within the same `app_group`.

### 3. Display Fixes

- **No More Target Dates**: Lifetime records return `expires_at: null`.
- **Frontend Sync**: Popup UI uses presence/absence of `expires_at` to distinguish between "Yearly" and "Lifetime" (fixing the 100-year expiration bug).

## Verification Result

- Verified `eamass@gmail.com` correctly displays "Lifetime" (via Manual Override).
- Verified `edgotravel@gmail.com` logic handles $0 sessions with 10 customer checks.
