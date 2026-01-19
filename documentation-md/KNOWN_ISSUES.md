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

## 3. UI/CSS Regressions

### Hiding Sections causes Layout Shift

- **Symptom**: Hiding the `statusSection` makes the entire popup height collapse, causing scroll jumps.
- **Correct Logic**: Use `visibility: hidden` instead of `display: none` if space preservation is needed, OR ensure the container has a minimum height.
- **Current State**: The UI flow is carefully ordered. Be careful reordering "Results" vs "Progress" sections.
