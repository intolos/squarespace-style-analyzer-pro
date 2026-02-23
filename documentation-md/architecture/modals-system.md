# Modals System Architecture

## Overview

The extension uses a centralized "Custom Modal" system to provide a premium, non-blocking UI for alerts, confirmations, and specialized user interactions (like reviews and domain file selection). This system replaces native browser `alert()`, `confirm()`, and `prompt()` calls, which are jarring and inconsistent across platforms.

## Key Components

- **`index.html`**: Defines the shared `#customModalOverlay` and its internal structure (`#customModalTitle`, `#customModalMessage`, `#customModalButtons`).
- **`uiHelpers.ts`**: Contains the core logic for injecting content and resolving Promises for `customAlert`, `customConfirm`, and `customPrompt`.
- **`style.css`**: Manages the visual layout, centering, and responsive behavior of the modals.

## Modal Types

### 1. Standard Utilities (`customAlert`, `customConfirm`, `customPrompt`)

- **Location**: `src/utils/uiHelpers.ts`
- **Behavior**: Uses a Promise-based flow. Content is injected as `textContent` (for safety) or simple `innerHTML`.
- **Styling**: Uses standard `.custom-modal-alert` class.

### 2. Review Request Modal

- **Location**: `src/utils/uiHelpers.ts` (`showReviewModal`)
- **Behavior**: A specialized modal with an "Success Story" message and a "Do not show again" checkbox.
- **Critical Detail**: Uses `<p>` tags for content. `white-space` is set to `normal` to strip code-indentation spaces from JS template literals.

### 3. License Failure Modal

- **Location**: Triggered in `entrypoints/popup/main.ts` via `customAlert`.
- **Behavior**: Tags the overlay with `.license-failure-modal` before calling `customAlert`.
- **Styling**: Provides exactly **24px** of total vertical gap (12px margin + 12px padding) between the support email and the "OK" button.

### 4. Domain Analysis / File Selection Modals

- **Location**: `src/ui/domainAnalysisUI.ts` and `src/ui/pageSelectionUI.ts`
- **Behavior**: High-density modals for handling large lists of URLs or complex configuration steps.

---

## 🛠️ Critical Spacing & Layout Logic (The "Trap" History)

### 1. The `white-space: pre-line` Conflict

- **The Problem**: Standard alerts use `white-space: pre-line` to respect `\n` characters in plain-text messages (like license errors).
- **The Failure**: When using multi-line backticks (template literals) in JavaScript for HTML-based modals (like the Review Modal), `pre-line` renders the **indentation and newlines of the code itself** as literal visual spaces. This makes CSS margins appear ineffective or "random."
- **The Solution**: For HTML-intensive modals, the CSS must force `white-space: normal !important`.

### 2. Isolation via CSS `:has()`

- **The Problem**: Changes to the global `.modal-container` or `.custom-modal-alert` classes bleed into every modal in the extension.
- **The Solution**: Use the `:has()` selector to apply specific layout fixes to only the modal containing a unique element.
- **Example**: `.modal-container:has(#reviewModalCheckbox)` targets ONLY the review modal.

### 3. The "No Change" Illusion

- **The Problem**: When a user requests "12px of padding" and the developer sets `margin-bottom: 12px`, the UI often looks identical because the global baseline was already `12px`.
- **The Solution**: Always verify the current global margin/padding. If a visual change is needed, the new value must be the **Old Baseline + Requested Padding**. For the License Failure modal, this resulted in a total **24px** gap.

## Operational Logic

1.  **Injection**: The helper function grabs the shared `#customModalOverlay`.
2.  **Tagging**: (Optional) UI-specific classes (like `.license-failure-modal`) are added to the overlay.
3.  **Display**: Overlay is set to `display: flex`.
4.  **Interaction**: Event listeners are attached to injected buttons.
5.  **Cleanup**: Upon resolve/reject, classes are removed and innerHTML is cleared to prevent "style bleed" or content flashing in the next modal.

## Do Not Change

- **Overlay CSS**: The `.custom-modal-overlay` uses a high-contrast `#657DE9` color. Do not use semi-transparent black as it creates "muddy" borders (see KNOWN_ISSUES.md).
- **Reset Logic**: Never remove the `.innerHTML = ''` and class removal code in the `.onclick` handlers; failure to do so results in persistent state bugs.
