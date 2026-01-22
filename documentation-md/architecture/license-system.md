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

### 2. The Cloudflare Worker (The Brain)

- **Role**: Backend Logic & Security.
- **File**: `cloudflare/worker.js`
- **Responsibility**: Authenticates with Stripe, validates purchases, prevents abuse, and acts as the "Source of Truth."
- **Endpoints**:
  - `/check-email`: Validate a user.
  - `/create-checkout-session`: Start a purchase.
  - `/webhook`: Listen for Stripe events.

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

- **Check**: Look for `is_lifetime: 'true'` on the Stripe **Customer Object** itself.
- **Check (Yearly Fallback)**: Look for `is_yearly: 'true'` AND product-specific access flags (`access_squarespace` or `access_website`).
- **Why**: This is the fastest and most robust check. It survives session archiving, subscription deletion, and history limits.
- **How it gets there**: The **Webhook** automatically "Stamps" these onto the customer immediately after purchase (see _Auto-Stamping_ below).
- **Expiration Handling**: `is_yearly` is reset to `false` automatically by the webhook if a subscription is deleted or a payment fails.

### 🥈 Priority 2: Lifetime Checkout Sessions

- **Check**: Search active `checkout.session` history for `mode: 'payment'` AND (`metadata.is_lifetime` OR `amount=0`).
- **Use Case**: Handles recent purchases before the webhook fires, or older purchases before Auto-Stamping was implemented.

### 🥉 Priority 3: Charges

- **Check**: Fallback search for individual `charge` objects with lifetime metadata.

### 4️⃣ Priority 4: Yearly Subscriptions

- **Check**: Look for `active` subscriptions.
- **Result**: Returns a "Yearly" license (with an expiration date), unlike the "Lifetime" license (which returns `expires_at: null`).

---

## ✅ Priority Enforcement (Frontend vs Backend)

| Component     | Priority Execution                                        | Rationale                                                                                                       |
| :------------ | :-------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| **Worker**    | Lifetime (Metadata) → Lifetime (Sessions) → Yearly (Subs) | Efficiency & Source of Truth. Stamped metadata is the fastest check.                                            |
| **Extension** | `CHECK_LIFETIME` → `CHECK_YEARLY`                         | **UI Correctness**. Ensures a user with an active Yearly sub but a new Lifetime purchase is labeled "Lifetime". |

---

## ⚡ The "Auto-Stamping" Mechanism (Self-Healing)

To prevent "Missing Session" bugs and ensure data consistency, the system includes an automated feedback loop:

- **Worker Buys Lifetime or Yearly Access** (Filling in fields in Checkout).

2.  **Stripe** fires a `checkout.session.completed` webhook.
3.  **Worker** receives the webhook and **extracts naming data** from custom fields.
4.  **Worker** calls Stripe API back to update the Customer Object:
    - Sets `metadata[is_lifetime]: true` (if Lifetime).
    - Sets `metadata[is_yearly]: true` (if Yearly).
    - Sets `metadata[access_squarespace]: true` (if SQS product).
    - Sets `metadata[access_website]: true` (if Generic product).
    - Sets `name` to `First + Last Name`.
    - Sets `metadata[business_name]` if provided.
5.  **Result**: The user is permanently (or until cancellation) marked with granular access flags. Future checks hit **Priority 1** instantly.
6.  **Cleanup (Webhook Trigger)**: If a `customer.subscription.deleted` or `invoice.payment_failed` event is received, the worker resets `is_yearly` to `false`.

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
