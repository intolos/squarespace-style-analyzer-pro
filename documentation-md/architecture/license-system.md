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

- **Role**: Payment Processor & Database.
- **Responsibility**: Stores Customer objects, Sessions, and Metadata flags (`is_lifetime=true`).

---

## 🧠 Smart Validation Logic (The "Priority Stack")

When `/check-email` is called, the Worker searches Stripe data in a specific priority order. The first match wins.

### 🥇 Priority 1: Customer Metadata ("The Golden Ticket")

- **Check**: Look for `is_lifetime: 'true'` on the Stripe **Customer Object** itself.
- **Why**: This is the fastest and most robust check. It survives session archiving, subscription deletion, and history limits.
- **How it gets there**: The **Webhook** automatically "Stamps" this onto the customer immediately after purchase (see _Auto-Stamping_ below).

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

1.  **User Buys Lifetime Access** (Filling in First Name, Last Name, and Business Name in Checkout).
2.  **Stripe** fires a `checkout.session.completed` webhook.
3.  **Worker** receives the webhook and **extracts naming data** from custom fields.
4.  **Worker** calls Stripe API back to update the Customer Object:
    - Sets `metadata[is_lifetime]: true`.
    - Sets `name` to `First + Last Name`.
    - Sets `metadata[business_name]` if provided.
5.  **Result**: The user is permanently marked as "Lifetime" with their full name correctly displayed in the Stripe Dashboard. Future checks hit **Priority 1** instantly, and local KV records contain the user's name.

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
