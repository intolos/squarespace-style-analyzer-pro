# Walkthrough: WordPress Extension Integration Fix (2026-03-02)

## Problem

A WordPress lifetime purchase (via coupon) was showing `original_purchase_extension: 'generic'` in the Stripe customer dashboard instead of `'wordpress'`. Additionally, the `access_wp` cross-product access flag was missing entirely from the Stripe customer metadata.

## Root Causes Identified

### Bug 1: Binary Ternary in `licenseManager.ts`

**File**: `wxt-version/src/managers/licenseManager.ts` (line 95)

The `extension_type` field sent to the Cloudflare Worker during checkout was determined by a **binary ternary**:

```js
// BEFORE (broken)
extension_type: isSqs ? 'squarespace' : 'generic',
```

Since `isSqs` is `false` for WP builds, this always sent `'generic'`. The worker then stamped that value as `original_purchase_extension` on the Stripe customer record.

### Bug 2: Missing `access_wp` in Worker Metadata Stamping

**File**: `cloudflare/worker.js` (line 742)

The webhook handler stamped `access_squarespace` and `access_website` on every purchase but never stamped `access_wp`, so there was no cross-product access flag for the WordPress version.

## Fixes Applied

### Fix 1: Three-Way Ternary

```js
// AFTER (correct)
extension_type: isSqs ? 'squarespace' : isWp ? 'wordpress' : 'generic',
```

Also added `isWp` to the import in `licenseManager.ts`.

### Fix 2: Added `access_wp` Flag

```js
// All three flags now stamped on every purchase
updateParams.append('metadata[access_squarespace]', 'true');
updateParams.append('metadata[access_website]', 'true');
updateParams.append('metadata[access_wp]', 'true');
```

## Documentation Updated

- `documentation-md/architecture/wordpress-extension-architecture.md` — Added Stripe metadata stamping table and cross-product access flag spec.
- `documentation-md/KNOWN_ISSUES.md` — Added trap #27 for the binary ternary pattern.

## Git Checkpoints

- `pre-wp-integration-fix-2026-03-02`
- `post-wp-integration-fix-2026-03-02`

## Note on Existing Customers

These fixes apply to **future purchases only**. Existing WP customers who purchased before this fix will still show `original_purchase_extension: 'generic'` in Stripe — they would need to be manually updated via the Stripe dashboard if accurate historical data is needed. Their `access_wp` flag can also be backfilled manually if required.
