# Implementation Plan: Fixing Cross-Extension Subscription Logic

This plan addresses the issue where subscription end dates were not being correctly identified for users moving between the Squarespace and Website extensions.

## Proposed Changes

### Cloudflare Worker

- **Strict License Matching**: Update `handleCheckEmail` to require a `purchase_type` parameter, preventing yearly subscriptions from satisfying lifetime checks.
- **Support Flexible Billing**: Implement deep subscription ID lookup as a fallback for usage-based/flexible billing cycles where period dates are omitted in list results.
- **Cache Purge (v3)**: Bump the KV cache version to `v3` to invalidate stale records with incorrect or future-dated timestamps.

### Extension Frontend

- **License Type Awareness**: Update `LicenseManager` to pass `purchase_type` ('lifetime' or 'yearly') in all status check requests.
- **Detailed Diagnostic Logging**: Enhanced console output to identify missing date fields in real-time.

## Verification Plan

1. **Health Check**: Confirm worker is running `v4.4.6.3`.
2. **Cross-Extension Test**: Confirm an SQS yearly subscription retrieves a valid `expires_at` date in the Generic extension popup.
3. **Lifetime Validation**: Confirm checkout sessions for lifetime purchases correctly return a "Lifetime" status with no expiration date.
