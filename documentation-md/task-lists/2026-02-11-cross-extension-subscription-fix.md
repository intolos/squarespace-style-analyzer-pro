# Task: Fix Cross-Extension Subscription Retrieval

## Research & Planning

- [x] Analyze contradictory logs (Extension vs Manual) <!-- id: 5 -->
- [x] Draft strict license type validation plan <!-- id: 6 -->

## Execution

- [x] Update worker to enforce `purchase_type` validation <!-- id: 7 -->
- [x] Update `licenseManager.ts` to pass `purchase_type` <!-- id: 8 -->
- [x] Harden worker cache logic and purge stale records (v3 cache) <!-- id: 9 -->
- [x] Ultra-verbose logging for Stripe sub retrieval (Phase 3) <!-- id: 10 -->
- [x] Re-verify with Generic build <!-- id: 11 -->

## Verification

- [x] Confirm "nonsense" ID is gone (Worker should fail if types don't match) <!-- id: 11 -->
- [x] Confirm `expires_at` is correctly populated when yearly sub is requested <!-- id: 12 -->
