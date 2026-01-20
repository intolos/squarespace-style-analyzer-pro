# License System Architecture

## Overview

The License System manages premium access for the generic and Squarespace-specific extensions. It handles subscription verification, local persistence of license details, and the upgrade flow via Stripe.

## Key Components

- `src/managers/licenseManager.ts`: Core logic for API communication, checking license status, creating checkout sessions, and polling.
- `src/utils/storage.ts`: Handles persistence of user data, including `licenseEmail` and `licenseData`.
- `entrypoints/popup/main.ts`: UI controller that initiates upgrades, displays status, and coordinates with `LicenseManager` and `StorageManager`.
- `src/utils/platform.ts`: Contains the extension-specific Stripe Product/Price IDs and API endpoints.

## Operational Logic

### 1. Upgrade Flow

1.  User clicks "Upgrade" (Yearly or Lifetime) in the popup.
2.  `main.ts` calls `LicenseManager.createCheckoutSession` with the correct Stripe Price ID (sourced from `platform.ts`).
3.  A Stripe Checkout URL is generated and opened in a new tab.
4.  The extension starts polling (`startLicensePolling`) in the background and foreground for payment completion.

### 2. Verification Flow

1.  **Polling**: If polling succeeds, the API returns the license record.
2.  **Manual Check**: User enters email in "Check Status". `LicenseManager.checkLicense(email)` queries the API.
3.  **Validation (Cloudflare Worker)**:
    - **Prioritization**: The worker checks license sources in strict order to ensure the "Best" license wins:
      - **Priority 1: Customer Metadata**: If the Stripe Customer object has `metadata.is_lifetime === 'true'`, access is granted manually via Dashboard.
      - **Priority 2: Checkout Sessions (Lifetime)**: Finds one-time payments (`mode: 'payment'`). Accepts `amount_total === 0` to support 100% off coupons.
      - **Priority 3: Charges**: Fallback for older transactions.
      - **Priority 4: Subscriptions (Yearly)**: Only returns a Yearly result if no Lifetime license is found.
    - **Display Differentiation**: Lifetime records are returned with `expires_at: null`. Yearly records return the Stripe period end date. This allows the popup to distinguish between types without extra fields.
    - **Multi-Customer Handling**: Checks up to 10 Stripe customer records for the same email to avoid "Zombie" account issues during testing.

### 3. Persistence & State

- **Save**: On successful verification, `main.ts` passes the result to `StorageManager.saveUserData`.
- **Important**: `licenseEmail` and `licenseData` (containing `record.expires_at`) **MUST** be saved to `chrome.storage.local` to distinguish between "Yearly" and "Lifetime" status across reloads.
- **Load**: On popup open, `main.ts` calls `StorageManager.loadUserData` to retrieve the cached license info.

## Data Flow

`API (Cloudflare Worker)` -> `LicenseManager` -> `main.ts (UI)` -> `StorageManager` -> `chrome.storage.local`

## Critical Implementation Details

- **Persistence Fields**: `licenseEmail` and `licenseData` are required in `StorageManager`. Do not rely solely on `isPremium` boolean if you want to display specific subscription types.
- **Test Helpers**: `enableYearlyTest()` and `enableLifetimeTest()` in `main.ts` simulate this flow by manually constructing the expected data structure and saving it via `StorageManager`.
- **Stripe IDs**: Defined in `src/utils/platform.ts` and switched based on `isSqs` build flag.
