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
