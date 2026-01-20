# Task: Fix Time Estimate, Subscription Buttons, and Add E2E Tests

## Fixes

- [x] Fix time estimate calculation (2s → 20s per page)
- [x] Fix subscription buttons (add window.open for checkout URL)
- [x] Create E2E tests for new UI logic (analyze buttons, premium check)
- [x] Verify build scripts handle new test file

## Architecture Updates

- [x] Implement App Group Logic in Worker (Cross-Product Access)

## Verification

- [x] Build extension (sqs build succeeded)
- [x] Manual test: time estimate shows ~36 min for 107 pages
- [x] Manual test: subscription buttons open Stripe checkout
- [x] Run E2E tests
