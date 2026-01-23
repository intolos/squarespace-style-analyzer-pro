# Known Issues & "Gotchas"

This file documents critical implementation details, regression traps, and "anti-patterns" that have caused significant wasted time in the past.

**READ THIS BEFORE FIXING BUGS.**

---

## 1. Premium Activation Flow (License Check)

### The "Scroll Jump" Trap

- **Symptom**: After a successful license check, the popup scrolls to the top, hiding the "Premium Active" button and confusing the user.
- **Root Cause**: Triggering `window.location.reload()` or allowing a `chrome.storage.onChanged` listener to reload the page when the license key is saved.
- **Correct Logic**:
  - **DO NOT** reload the popup page programmatically.
  - **DO NOT** have a storage listener in `main.ts` or `popup.js` that calls `reload()` on license changes.
  - **DO**: Manually update the DOM (hide the input field, show the success message) using explicit UI update functions.
- **Date Fixed**: 2026-01-18

---

## 2. Storage & Quotas

### Resource::kQuotaBytes quota exceeded

- **Symptom**: Analysis fails with a quota error.
- **Root Cause**: Saving massive base64 image strings or huge HTML dumps directly to `chrome.storage.local`.
- **Correct Logic**:
  - Use `chrome.storage.local` only for metadata and small settings.
  - For large reports, generate the Blob/DataURL _temporarily_ in memory effectively, or manage storage cleanup aggressively.
  - _Note: Current solution involves clearing storage before new analysis._

---

## 4. License Persistence

### The "Storage Wrapper Stripping" Trap

- **Symptom**: New license details (like `Yearly` vs `Lifetime`) are lost on popup reload, but the basic `isPremium` status persists.
- **Root Cause**: Updating the schema in `StorageManager.ts` but forgetting to update the `saveUserData()` wrapper in `main.ts` (the UI controller). The wrapper strips unknown fields before passing the object to the storage utility.
- **Correct Logic**: ALWAYS ensure that any fields added to `StorageManager` are also included in the `saveUserData` call within the main application controller.
- **Date Fixed**: 2026-01-19

---

## 3. UI/CSS Regressions

### Hiding Sections causes Layout Shift

- **Symptom**: Hiding the `statusSection` makes the entire popup height collapse, causing scroll jumps.
- **Correct Logic**: Use `visibility: hidden` instead of `display: none` if space preservation is needed, OR ensure the container has a minimum height.

---

## 5. UI Visibility & Flow

### The "Site Info Visibility" Trap

- **Symptom**: The "Current Site" info (`#siteInfo`) remains visible during analysis or after results are loaded, cluttering the UI.
- **Root Cause**: Manual calls to `siteInfo.style.display = 'block'` in success/error/completion callbacks within analysis modules (`DomainAnalysisUI.ts`, `SinglePageAnalysisUI.ts`).
- **Correct Logic**:
  - **NEVER** restore `siteInfo` visibility in analysis step callbacks.
  - `siteInfo` should be hidden when analysis starts.
  - `checkCurrentSite` in `main.ts` should hide it if `accumulatedResults` exists.
  - **ONLY** restore visibility in `resetAnalysis` in `main.ts`.
- **Date Fixed**: 2026-01-19

## 6. UI Specificity & Positioning (Premium Modals)

### The "Select Sections" Modal Position

- **Symptom**: The "Select Sections" modal could appear at the bottom of the popup despite using CSS `order` or `flex` layouts.
- **Root Cause**: Specific DOM nesting or race conditions in element creation often prevent CSS from working reliably across all browser versions.
- **Correct Logic**:
  - **DO**: Use JavaScript to explicitly **prepend** the modal to the parent container (`mainInterface`) using `insertBefore(modal, mainInterface.firstChild)`.
  - **DO NOT**: Rely on CSS `order` or `flex-direction: column-reverse`. Keep JS as the single source of truth for positioning.
- **Date Refined**: 2026-01-20

### The "Analyze With Mobile" Time Estimate

- **Symptom**: The calculated time estimate (e.g., "+ ~4 mins") is calculated but not visible to the user.
- **Correct Logic**:
  - **DO**: Explicitly set `element.style.display = 'inline'` (or `block`) when updating the `textContent` to ensure visibility.
- **Date Fixed**: 2026-01-20

### Custom Modal Layout & Padding

- **Symptom**: Prompt modals (e.g., "Analyze Entire Domain") lacked vertical breathing room above titles.
- **Root Cause**: Brute-force `padding-top` hacks on `h3` elements collided with legacy container constraints.
- **Correct Logic**:
  - **DO**: Use a structured `.modal-header` or `.custom-modal-header` container.
  - **DO**: Use Flexbox inside that header to center content and provide standardized, predictable spacing.
  - **DO NOT**: Use arbitrary `padding-top: 45px !important` values on text elements.
- **Date Refined**: 2026-01-20

---

## 7. Free-Tier Usage Counter (Status Section) Persistence

### The "Zombie Counter" Flicker

- **Symptom**: The "0 of 3 free websites analyzed" counter briefly appears after a premium license is activated.
- **Root Cause**:
  1.  **Flicker on Startup**: Counter was visible in HTML while waiting for JS storage check.
  2.  **Persistence on Activation**: Success block did not trigger an immediate UI refresh.
- **Correct Logic**:
  - **DO**: Hide `#statusSection` by default in `popup.html` using `style="display: none;"`.
  - **DO**: Call `this.updateUI()` immediately after a successful license check/activation.
  - **DO NOT**: Use a `MutationObserver` (The "Nuclear Option") unless architectural fixes fail; explicit state-sync is more performant.
- **Date Refined**: 2026-01-20

---

## 8. Subscription Button Flow

### The "Missing window.open" Trap

- **Symptom**: Clicking "Yearly" or "Lifetime" upgrade buttons shows "Loading..." but never opens the Stripe checkout page.
- **Root Cause**: `handleUpgradeFlow()` in `main.ts` creates a Stripe checkout session and receives a valid URL, but was missing `window.open(session.url, '_blank')`.
- **Correct Logic**:
  - **DO**: Call `window.open(session.url, '_blank')` immediately after receiving a successful session response.
- **Date Fixed**: 2026-01-20

---

## 9. Time Estimate Calculation

### The "Wrong Seconds Per Page" Trap

- **Symptom**: Time estimate shows "~4 minutes" for 107 pages when it should show "~36 minutes".
- **Root Cause**: `updateSelectionSummary()` in `pageSelectionUI.ts` used 2 seconds per page instead of 20 seconds.
- **Correct Logic**:
  - **DO**: Use 20 seconds per page: `Math.ceil((totalPages * 20) / 60)`
  - **DO NOT**: Change mobile time (4s extra per page is correct).
- **Date Fixed**: 2026-01-20

---

## 10. Lifetime vs. Yearly Differentiation

### The "Artificial Date" Trap

- **Symptom**: A lifetime user is correctly validated but the UI shows "Premium Activated - Yearly".
- **Root Cause**: The Cloudflare Worker was returning an artificial `expires_at` date (e.g., 100 years in the future) for lifetime records to indicate they are active. The frontend sees any `expires_at` value as truthy and defaults to "Yearly."
- **Correct Logic**:
  - **DO**: Return `expires_at: null` for lifetime records (Customer Metadata, Lifetime Sessions, Charges).
  - **DO**: Ensure the frontend checks `if (record.expires_at)` to determine the string "Yearly" vs "Lifetime."
- **Date Fixed**: 2026-01-20

---

## 11. $0 Checkout ($100% Off Coupons)

### The "No Payment Intent" Trap

- **Symptom**: User completes a $0 checkout but the extension shows "Not Active."
- **Root Cause**: The worker was only accepting sessions with `payment_status: 'paid'`. $0 orders sometimes return `no_payment_required` AND lack a `payment_intent` object entirely.
- **Correct Logic**:
  - **DO**: Check for `amount_total === 0` as a definitive "Lifetime" signal if the session is `complete`.
  - **DO**: Accept both `'paid'` and `'no_payment_required'` statuses.
  - **DO**: Dig deeper into Stripe customer records (limit=10) to find purchases hidden by "Guest Checkout" duplicates.
- **Date Fixed**: 2026-01-20

---

## 12. Lifetime Access Priority

- **Symptom**: User has both a Yearly and a Lifetime license, but the UI labels them as "Yearly".
- **Root Cause**: Simplistic check logic that prioritizes the first valid response (often Yearly) or assumes `expires_at` truthiness always means Yearly.
- **Correct Logic**:
  - **DO**: Explicitly check for Lifetime Product IDs (`prod_TbiIroZ9oKQ8cT`, `prod_TbiWgdYfr2C63y`).
  - **DO**: Check for Lifetime product _before_ Yearly product in the `LicenseManager`.
  - **Rationale**: Lifetime access is the "ultimate" status and must always override Yearly data for UI labeling.
- **Date Fixed**: 2026-01-21

---

## 13. Case-Sensitive File Duplication (macOS/Git)

- **Symptom**: Infinite rebase conflicts or "unstaged changes" that won't go away after a push/pull.
- **Root Cause**: The remote repository contains both `Index.html` and `index.html`. On macOS (case-insensitive filesystem), these collide into the same physical file, preventing Git from correctly tracking which one is being modified.
- **Correct Logic**:
  - **DO**: Standardize all filenames to lowercase.
  - **DO**: Use `git rm -f [WrongCaseFile]` to manually clean the repository whenever a case collision is detected.
  - **DO NOT**: Manually upload files via the GitHub web interface if they might introduce case casing inconsistencies.
- **Date Fixed**: 2026-01-21

---

## 14. Contrast Audit & Gradients

### The "Shorthand Background" Trap

- **Symptom**: Gradient backgrounds are not detected, causing false positive contrast errors in reports.
- **Root Cause**: Checking only `computedStyle.backgroundImage`. Some browsers/frameworks apply gradients via the `background` shorthand property.
- **Correct Logic**:
  - **DO**: Check both `backgroundImage` AND `background` computed properties.
  - **DO**: Search for specific gradient functions (`linear-gradient`, `radial-gradient`, etc.) including vendor prefixes.
- **Date Fixed**: 2026-01-23

---

## 15. Button Deduplication & Intentional Repetition

### The "N/A Section" Trap

- **Symptom**: On non-Squarespace sites, identical buttons placed intentionally (e.g., "Buy Now" at top and bottom) are deduplicated into a single entry.
- **Root Cause**: Deduplication logic used `text + section + block`. On generic sites, section/block metadata is "N/A", causing collisions for identical text.
- **Correct Logic**:
  - **DO**: Use "Dimension-based Deduplication".
  - **DO**: Round `top` and `left` positions by the element's `height` and `width` to create unique keys.
  - **Rationale**: This distinguishes intentional buttons at different positions while still catching framework-level "accidental" duplicates (at the same position ± sub-pixel differences).
- **Date Fixed**: 2026-01-23

---

## 16. Extension Metadata Capture

- **Symptom**: `original_purchase_extension` and `original_purchase_type` are not captured in Stripe Customer metadata.
- **Root Cause**: The Cloudflare Worker was attempting to compare Product IDs against environment variables (`env.SQS_PRODUCT_ID_YEARLY`, etc.) which were undefined at the edge.
- **Correct Logic**:
  - **DO**: Use a "Passthrough Architecture."
  - **DO**: Have the client send `extension_type` and `purchase_type` directly to the worker.
  - **DO**: Store these in session metadata and read them directly in the webhook, eliminating the need for Product ID environment variables in Cloudflare.
- **Date Fixed**: 2026-01-23

---

## 17. Button Label "Lifetime" for Yearly Users

- **Symptom**: User completes a yearly purchase but the button shows "Premium Activated - Lifetime."
- **Root Cause**: The `/redeem-session` endpoint was returning a `record` object without the explicit `is_lifetime: false` and `is_yearly: true` flags. The frontend checked these flags, found them undefined, and the logic path resulted in incorrect labeling or styling.
- **Correct Logic**:
  - **DO**: Ensure every record-returning endpoint (`/redeem-session`, `/check-email`) explicitly includes the `is_lifetime` and `is_yearly` boolean flags.
- **Date Fixed**: 2026-01-23
