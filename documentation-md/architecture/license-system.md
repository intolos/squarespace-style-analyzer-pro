# License System Architecture

## Overview

The License System is a robust "Three-Legged" architecture connecting the Chrome Extension, a Cloudflare Worker, and Stripe. It is designed to be **Self-Healing** and **Regression-Resistant**, prioritizing "Lifetime" access above all else.

---

## 🏗️ Core Components (The "Three Legs")

### 1. The Extension (Frontend)

- **Role**: Client interface.
- **Key Files**:
  - `src/managers/licenseManager.ts`: Handles checking status and polling.
  - `entrypoints/popup/main.ts`: UI Controller.
- **Responsibility**: It never talks to Stripe directly. It only talks to the **Worker**.
- **Priority Logic**: The extension manually checks for **Lifetime** access before Yearly access. This prevents a user who has both (or a legacy Yearly sub) from being incorrectly labeled as "Yearly" in the UI.
- **Stricter Lifetime Check**: As of 2026-01-23, the extension strictly validates the specialized **Lifetime Product ID**. It no longer relies on a fallback check for a missing `expires_at` date, which could cause false entries if Yearly subscription data was incomplete.

### 2. The Cloudflare Worker (The Brain)

- **Role**: Backend Logic & Security.
- **File**: `cloudflare/worker.js`
- **Responsibility**: Authenticates with Stripe, validates purchases, prevents abuse, and acts as the "Source of Truth."
- **Endpoints**:
  - `/check-email`: Validate a user. Now requires `purchase_type` ('lifetime' or 'yearly') for strict validation.
  - `/create-checkout-session`: Start a purchase.
  - `/webhook`: Listen for Stripe events.
- **Caching (KV)**: As of 2026-02-11, uses **Cache Version 3** to purge all legacy records with corrupted or future-dated timestamps.

### 3. Stripe (The Vault)

- **Responsibility**: Payment Processor & Database.
- **Responsibility**: Stores Customer objects, Sessions, and Metadata flags:
  - `is_lifetime`: Permanent "true" for lifetime purchases.
  - `is_yearly`: Binary "true"/"false" toggled via webhook based on subscription status.
  - `access_squarespace`: Dedicated column for SQS extension access.
  - `access_website`: Dedicated column for Generic extension access.
  - `app_group`: Set to `style_analyzer` to prevent cross-product pollution.

---

## 🧠 Smart Validation Logic (The "Priority Stack")

When `/check-email` is called, the Worker searches Stripe data in a specific priority order. The first match wins.

### 🥇 Priority 1: Customer Metadata ("The Golden Ticket")

- **Check (Lifetime FIRST)**: Look for `is_lifetime: 'true'` on the Stripe **Customer Object**.
  - **Rationale**: Lifetime is the "superior" status. If true, the system **STOPS** immediately and returns a Lifetime record.
- **Yearly Note**: Yearly subscriptions are **NOT** validated here anymore (as of 2026-02-11). We must check the actual subscription object (Priority 4) to get accurate expiration dates. Metadata flags (`is_yearly`) are only used as hints/stamps.
- **Why**: This ensures we get the real `current_period_end` date from Stripe instead of guessing "Now + 365 days".
- **How it gets there**: The **Webhook** automatically "Stamps" these onto the customer immediately after purchase.

### 🥈 Priority 2: Lifetime Checkout Sessions

- **Check**: Search active `checkout.session` history for `mode: 'payment'` AND (`metadata.is_lifetime` OR `amount=0`).
- **Use Case**: Handles recent purchases before the webhook fires, or older purchases before Auto-Stamping was implemented.

### 🥉 Priority 3: Charges

- **Check**: Fallback search for individual `charge` objects with lifetime metadata.

### 4️⃣ Priority 4: Yearly Subscriptions

- **Check**: Look for `active` subscriptions.
- **Strict Matching**: As of 2026-02-11, the worker requires an explicit `purchase_type=yearly` parameter to return a result from this priority. This prevents yearly subscriptions from being incorrectly validated as Lifetime licenses (fixing the "nonsense Product ID" bug).
- **Flexible Billing Support**: For subscriptions using usage-based or flexible billing (where `current_period_end` may be missing in list results), the worker performs a **deep ID lookup** to fetch the full object. If dates are still absent, it intelligently falls back to the `billing_cycle_anchor` + 365 days.
- **Result**: Returns a "Yearly" license with a reliable expiration date.

---

## 🔄 Lifecycle Scenarios

### 1. First Purchase

- User completes checkout.
- Webhook stamps Customer with `is_lifetime` or `is_yearly`.
- Webhook stamps `original_purchase_extension` and `original_purchase_type` (first purchase only).
- Extension receives success during polling or next "Check Status".

### 2. Yearly Renewal (Automatic or Manual)

- Stripe extends the subscription.
- Webhook (invoice.payment_succeeded) ensures `is_yearly` remains `true`.
- Extension background check (24h) updates local storage with new expiration date.

### 3. Subscription Expiration

- Stripe cancels subscription.
- Webhook (customer.subscription.deleted) resets `is_yearly` to `false`.
- Extension background check detects invalid license and notifies user.

### 4. Yearly to Lifetime Upgrade

- User with active yearly sub purchases lifetime.
- Webhook sets `is_lifetime: true`.
- **Note**: `is_yearly` may still be `true` until the sub expires, but Priority 1 check hits `is_lifetime` first and **STOPS**, ensuring the user immediately sees Lifetime status.

---

## ⚡ The "Auto-Stamping" Mechanism (Self-Healing)

To prevent "Missing Session" bugs and ensure data consistency, the system includes an automated feedback loop:

1.  **Stripe** fires a `checkout.session.completed` webhook.
2.  **Worker** receives the webhook and **extracts naming data** from custom fields.
3.  **Worker** calls Stripe API back to update the Customer Object:
    - Sets `metadata[is_lifetime]: true` (if Lifetime).
    - Sets `metadata[is_yearly]: true` (if Yearly).
    - Sets `metadata[access_squarespace]: true`.
    - Sets `metadata[access_website]: true`.
    - Sets `metadata[original_purchase_extension]` (If not already set).
    - Sets `metadata[original_purchase_type]` (If not already set).

---

## � Background License Verification (24-Hour Cycle)

The extension automatically verifies stored licenses in the background to detect expirations without requiring user action.

### How It Works

1. **Trigger**: Every time the popup opens, `verifyStoredLicenseInBackground()` is called (`main.ts` line 54).
2. **Frequency Check**: The function checks if 24+ hours have passed since `lastLicenseCheck`.
3. **Skip if Recent**: If checked within the last 24 hours, verification is skipped to avoid excessive API calls.
4. **Verification**: If 24+ hours have passed, it calls `checkLicense()` to verify with the Worker/Stripe.
5. **Update Status**:
   - **Valid**: Updates `isPremium: true`, `licenseData`, and `lastLicenseCheck`.
   - **Invalid/Expired**: Sets `isPremium: false` and shows a notification to the user.

### User Notification on Expiration

When a yearly subscription expires and the background check detects it:

- **Notification**: A Chrome notification is displayed with:
  - Title: "Premium Subscription Expired"
  - Message: Instructions to renew or verify license
- **One-Time Alert**: The `licenseExpiredNotificationShown` flag prevents duplicate notifications.
- **Reset on Renewal**: When the user successfully renews, this flag is cleared so they can be notified again if it expires in the future.

### Code Location

- **Background Verification**: `src/managers/licenseManager.ts` lines 166-210
- **Notification Logic**: `src/managers/licenseManager.ts` lines 190-209

---

## 🛠️ Debugging & Tools

### The "Light Switch" (Debug Mode)

You can diagnose any user by visiting the Worker URL directly in your browser with the debug flag:

- **URL**: `https://[your-worker-url]/check-email?email=user@example.com&debug=true`
- **Output**: Returns a JSON object with a `debug_log` array tracing exactly which steps (Priority 1-4) were checked and what Stripe returned for each.

### Required Environment Variables (Cloudflare)

- `STRIPE_SECRET`: Live Secret Key (`sk_live_...`)
- `STRIPE_WEBHOOK_SECRET`: Signing Secret (`whsec_...`) matching the endpoint.
- `DEFAULT_PRODUCT_ID`: ID of the extension (e.g., `squarespace_extension`).

---

## 🔗 Passthrough Architecture (Fixed 2026-01-23)

The client sends `extension_type` and `purchase_type` directly in the checkout request. The worker stores these in session metadata, and the webhook reads them to stamp Customer records.

**Flow:**

1. **Client** (`licenseManager.ts`) → Sends `extension_type: 'squarespace' | 'generic'` and `purchase_type: 'lifetime' | 'yearly'`
2. **Worker** (`handleCreateCheckout`) → Stores in `metadata[extension_type]` and `metadata[purchase_type]`
3. **Webhook** (`checkout.session.completed`) → Reads from `session.metadata.extension_type` and stamps Customer

This design keeps Product IDs defined in **one place only** (`platform.ts`) and eliminates the need for Product ID environment variables in Cloudflare.

---

## 📅 Cross-Product Date Preservation (Fixed 2026-02-11)

When a user purchases a subscription under one extension (e.g., Squarespace Style Analyzer Pro) and checks their premium status in another extension (e.g., Website Style Analyzer Pro), the system now preserves the **original subscription creation date** instead of using the current timestamp.

### How It Works

The worker's `createRecord()` function now accepts an optional `originalCreatedAt` parameter:

```javascript
function createRecord(email, pid, cusId, type, now, sessId, subId, expires, originalCreatedAt) {
  // CRITICAL: Do NOT fall back to 'now' if originalCreatedAt is missing - this would
  // create fake subscription dates for expired subscriptions. Log error instead.
  if (!originalCreatedAt) {
    console.error(
      `CRITICAL: Missing originalCreatedAt for ${type} - email: ${email}, cusId: ${cusId}`
    );
  }

  return {
    // ...
    created_at: originalCreatedAt, // No fallback - fail gracefully if missing
    // ...
  };
}
```

### Date Sources

All four priority checks extract the original creation timestamp from Stripe data:

1. **Priority 1 (Customer Metadata)**: Uses `customer.created`
2. **Priority 2 (Lifetime Sessions)**: Uses `session.created`
3. **Priority 3 (Charges)**: Uses `charge.created`
4. **Priority 4 (Yearly Subscriptions)**: Uses `subscription.created`

### Renewal Handling

When a yearly subscription renews:

- ✅ `subscription.created` remains the **original creation date** (Stripe does not create a new subscription object)
- ✅ Only `current_period_end` (expiration date) gets updated
- ✅ This ensures the subscription start date always reflects the original purchase

### Benefits

- ✅ Consistent subscription start dates across all Style Analyzer Pro extensions
- ✅ Accurate subscription history for users who access multiple extensions
- ✅ Proper expiration date tracking regardless of which extension is used
- ✅ Maintains data integrity in KV cache across product IDs
- ✅ No fake dates for expired subscriptions - fails gracefully instead
