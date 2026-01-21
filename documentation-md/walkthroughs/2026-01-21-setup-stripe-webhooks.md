# Guide: How to Setup Stripe Webhooks

This guide explains how to connect Stripe to your Cloudflare Worker so the extension "knows" immediately when a purchase happens.

## Phase 1: Get your Worker URL

1.  Log in to your **Cloudflare Dashboard**.
2.  Go to **Workers & Pages**.
3.  Click on your extension's worker (e.g., `squarespace-extension`).
4.  On the Overview page, look for the **Preview URL** or **Custom Domain** on the right.
    - _Example:_ `https://squarespace-extension.edmass.workers.dev`
5.  **Copy this URL** and add `/webhook` to the end.
    - _Final URL:_ `https://squarespace-extension.edmass.workers.dev/webhook`

## Phase 2: Add Endpoint in Stripe

1.  Log in to your **Stripe Dashboard**.
2.  Make sure you are in **Live Mode** (toggle top-right) if setting up for real users. (Or Test Mode for testing).
3.  Go to **Developers** (top right) -> **Webhooks** (left menu).
4.  Click the **+ Add endpoint** button.
5.  **Endpoint URL**: Paste the URL from Phase 1 (`.../webhook`).
6.  **Select events to listen to**: Click **Select events**.
    - Search for and check: `checkout.session.completed`
    - (Optional but recommended): `customer.subscription.deleted`, `invoice.payment_failed`
7.  Click **Add events**.
8.  Click **Add endpoint** to save.

## Phase 3: Get the Secret & Save to Cloudflare

1.  On the page of the Webhook you just created, look for **Signing secret** (top right area).
2.  Click **Reveal** and copy the key (starts with `whsec_...`).
3.  Go back to **Cloudflare Dashboard** -> Your Worker -> **Settings** -> **Variables and Secrets**.
4.  Click **Add** (or Edit if it exists).
5.  **Variable name**: `STRIPE_WEBHOOK_SECRET`
6.  **Value**: Paste the `whsec_...` key.
7.  Click **Deploy** (or Save and Deploy).

## Verification

To test if it works:

1.  Go to the Webhook page in Stripe.
2.  Click the **Test** tab (or send a test event).
3.  Select event: `checkout.session.completed`.
4.  Click **Send test event**.
5.  You should see a `200 OK` response in the "Webhook attempts" section below.
