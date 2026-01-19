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

- **Symptom**: The "Select Sections" modal appears *below* other elements (like headers, status text, or other containers) despite using CSS `order: -1` and `flex` layouts.
- **Root Cause**: Specific DOM nesting or race conditions in element creation often prevent CSS `order` from working as expected within the complex popup structure.
- **Correct Logic**:
  - **DO**: Use JavaScript to explicitly **prepend** the modal to the parent container (`mainInterface`) using `insertBefore(modal, mainInterface.firstChild)`.
  - **DO NOT**: Rely solely on CSS `order`.
- **Date Fixed**: 2026-01-20

### The "Analyze With Mobile" Time Estimate

- **Symptom**: The calculated time estimate (e.g., "+ ~4 mins") is calculated but not visible to the user.
- **Root Cause**: The container element was either hidden by default or empty.
- **Correct Logic**:
  - **DO**: Explicitly set `element.style.display = 'inline'` (or `block`) when updating the `textContent`.
  - **DO NOT**: Assume the element is visible just because it exists in the DOM.
- **Date Fixed**: 2026-01-20

### The Custom Modal Title Padding

- **Symptom**: The title of the custom prompt (e.g., "Analyze Entire Domain") has no space above it, making it look cramped.
- **Root Cause**: The default modal styles had `margin: 0` and no `padding-top` on the `h3` or the specific title ID.
- **Correct Logic**:
  - **DO**: Target the specific ID `#customModalTitle` and the class `.custom-modal h3` and apply a large `padding-top` (e.g., `45px`) with `!important`.
  - **DO**: Ensure the element is set to `display: block !important` to respect the padding.
- **Date Fixed**: 2026-01-20

## 7. Free-Tier Usage Counter (Status Section) Persistence

### The "Zombie Counter" Flicker

- **Symptom**: The "0 of 3 free websites analyzed" counter briefly appears or persists after a premium license is activated.
- **Root Cause**: Two main factors:
  1.  **Flicker on Startup**: The counter was visible by default in the HTML, and would only be hidden once the JavaScript local storage check completed.
  2.  **Persistence on Activation**: The `checkPremiumStatus` success block updated the storage but did not trigger a UI refresh (`updateUI()`), meaning the counter stayed visible until the popup was closed and reopened.
- **Correct Logic**:
  - **DO**: Hide `#statusSection` by default in `popup.html` using `style="display: none;"`.
  - **DO**: Call `this.updateUI()` immediately after a successful license check/activation.
  - **DO**: Use a `MutationObserver` in `main.ts` (The "Nuclear Option") to detect and remove the element if any other script or re-render tries to bring it back while in premium mode.
- **Date Fixed**: 2026-01-20
