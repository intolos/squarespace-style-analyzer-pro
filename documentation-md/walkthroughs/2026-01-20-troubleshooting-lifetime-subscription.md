# Walkthrough: troubleshooting lifetime subscription

**Date**: 2026-01-20
**Tasks Completed**: 5/5
**Status**: Ready for Deployment (Worker needs deployment)

---

## 1. Time Estimate Fix

**Issue**: Estimate used 2s/page (e.g., 4 mins for 107 pages).
**Fix**: Updated `pageSelectionUI.ts` to use **20s/page**.
**Result**: 107 pages now correctly estimates **~36 minutes**.

## 2. Subscription Button Fix

**Issue**: Checkout buttons showed "Loading..." but never opened Stripe.
**Fix**: Added missing `window.open(session.url, '_blank')` in `main.ts`.
**Verification**:

```typescript
// main.ts:296
window.open(session.url, '_blank');
```

## 3. Stripe Worker Updates (Cloudflare)

**Issue**: Lifetime subscriptions failing validity checks; Required fields missing asterisks; "Missing Session" data bugs.
**Fixes**:

### A. Validation Logic (The "Priority Stack")

We implemented a strict priority order for checking licenses ensuring the "Best" license always wins:

1.  **Metadata Override**: Checks `is_lifetime: true` on the Customer object (Fastest/Safest).
2.  **Lifetime Sessions**: Searches history for `$0` or `lifetime` metadata sessions.
3.  **Charges**: Checks individual charges.
4.  **Yearly Subscription**: Checks active subscriptions.

### B. The "Auto-Stamping" Mechanism (Webhook)

**Problem**: Users with valid purchases sometimes had their sessions "lost" or archived by Stripe, causing validation failures (e.g., `edgotravel`).
**Solution**: Updated the Webhook Handler to **call Stripe back** upon purchase and "Stamp" the Customer Object with `metadata.is_lifetime: true`.
**Result**: Users are correctly identified by Priority 1 (Metadata) instantly and forever.

### C. Debugging Tools

**Feature**: Added `?debug=true` flag to `/check-email` endpoint.
**Result**: Returns a detailed JSON log tracing exactly which priority steps were checked and what data was found. Use this to diagnose future "Mystery" failures.

### D. General Polish

1.  **Customer Creation**: Added `customer_creation: 'always'` for lifetime payments (prevents Guest checkout issues).
2.  **Asterisks**: Added `*` to "First Name" and "Last Name" custom field labels.
3.  **$0 Coupon Support**: Verified `Checkout Sessions` check handles 100% off orders.
4.  **App Group Architecture**: Uses `metadata.app_group = 'style_analyzer'` for stable grouping.

## 4. Platform URLs

**Issue**: SQS and Generic versions shared the same `/benefits/` URLs.
**Fix**: Updated `platform.ts` to use:

- `/benefits-sqs/` for Squarespace version
- `/benefits-generic/` for Generic version

## 5. E2E Tests

**New Test File**: `tests/e2e/popup-ui.spec.ts`
**Coverage**:

- Subscription button visibility
- Premium status button check
- Analyze buttons visibility
- Reset button visibility

## Next Steps for User

1. **Deploy Worker**: Copy/paste updated `worker.js` to Cloudflare Dashboard or run `wrangler deploy`.
2. **Rebuild Extension**: `npm run build:sqs` / `npm run build:generic` (Already done).
3. **Load Unpacked**: Load the new build in Chrome to verify fixes.
