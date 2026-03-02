# Refactoring `entrypoints/popup/main.ts` under the Single Responsibility Principle

This implementation plan details the strategy for refactoring the 1,120-line `main.ts` file in the Squarespace Style Analyzer Pro extension. The current file suffers from "God Object" anti-patterns where a single `SquarespaceAnalyzer` class orchestrates DOM manipulation, state management, Stripe session generation, local storage, API calls, and event listeners.

## User Review Required

> [!WARNING]
> This is a high-risk structural refactoring of the popup entrypoint. No logic or features will be added or removed, but the code will be heavily decoupled. Please review the proposed separation of concerns below.

## Proposed Changes

We will dismantle `entrypoints/popup/main.ts` and redistribute its responsibilities into specific domain managers within `wxt-version/src/`.

### State Management

This layer will solely be responsible for holding mutable variables and saving/loading them from Chrome storage.

#### [NEW] `src/state/popupState.ts`

- **Responsibility**: The central source of truth for the popup's data.

### Business Logic & Billing

#### [NEW] `src/managers/premiumFlowManager.ts`

- **Responsibility**: Orchestrating upgrading, checking status, and triggering review modals.

### UI & Presentation Layer

#### [NEW] `src/ui/popupUI.ts`

- **Responsibility**: All DOM updates and platform branding injection. (Note: Empty, unused methods like `repositionMobileSectionForUser` will be deleted during this extraction rather than ported).

### Platform Detection Extraction

#### [MODIFY] `src/platforms/index.ts`

- **Responsibility**: Centralizing all platform detection logic.
- **Methods Migrated**: `checkIfSquarespace()` will be moved here.

### Orchestration & Initialization

#### [NEW] `src/ui/eventBindings.ts`

- **Responsibility**: A single file that selects DOM elements and adds their event listeners, linking them directly to the appropriate managers.

#### [NEW] `src/managers/startupManager.ts`

- **Responsibility**: Handles the complex logic of reading the active tab on popup opening and injecting content scripts for detection.

#### [MODIFY] `entrypoints/popup/main.ts`

- **Responsibility**: The `SquarespaceAnalyzer` class will be deleted. The file will become a lightweight (~50 lines) startup script.

---

## Step-by-Step Refactoring Process & Verification Plan

Given the critical nature of this file, we will execute the refactoring in sequenced, isolated phases to prevent total regression, creating a Git state checkpoint before proceeding.

### Phase 0: Preparation

1.  **State Checkpoint**: Invoke the `.agent/skills/state-manager/SKILL.md` skill to create a full git commit/tag checkpoint. This ensures any subsequent failures can be reverted safely to a known working state.
    - _Manual Check_: Do not proceed until the `state-manager` confirms the repository is clean and checkpointed.

### Phase 1: Platform Detection (`src/platforms/index.ts`) [Lowest Risk]

1.  Move `checkIfSquarespace()` from `main.ts` to `src/platforms/index.ts`.
2.  Update `main.ts` to import and call the externalized `checkIfSquarespace` function.
    - _Manual Check_: Open the popup on a Squarespace site and a non-Squarespace site to verify the warning banner appears correctly.

### Phase 2: UI Manager Extraction (`src/ui/popupUI.ts`) [Low Risk]

1.  Create `popupUI.ts`.
2.  Move all DOM toggling methods (e.g., `updateUI`, `resetUpgradeButtons`, `showPlatformBanner`, `setPremiumBenefits`) out of the monolithic class.
3.  Update the monolithic class to delegate to `PopupUIManager`.
    - _Manual Check_: Open the popup on a free account. Is the "Upgrade Required" lock rendering properly? Is the layout correct? Do not proceed until verified.

### Phase 3: Event Bindings (`src/ui/eventBindings.ts`) [Moderate Risk]

1.  Create `src/ui/eventBindings.ts`.
2.  Extract the `bindEvents()` and `bindDomainAnalysisEvents()` logic out of `main.ts`.
    - _Manual Check_: Click the "Analyze This Page" button. Verify that the click is captured and the analysis successfully begins.

### Phase 4: Premium Logic & Billing (`src/managers/premiumFlowManager.ts`) [High Risk]

1.  Create `premiumFlowManager.ts`.
2.  Move `checkPremiumStatus`, `handleUpgradeFlow`, and `checkAndShowReviewModal` logic here.
    - _Manual Check_: Click the "Check Premium Status" button. Does the prompt correctly open, validate, and style the UI properly without skipping steps?

### Phase 5: State Extraction & Startup Logic (`src/state/popupState.ts`) [Highest Risk]

1.  Create `popupState.ts` and `src/managers/startupManager.ts`.
2.  Extract the core state variables (`isPremium`, `licenseData`, etc.) and the initialization logic from what remains of the `SquarespaceAnalyzer` class.
3.  Delete `SquarespaceAnalyzer` and convert `main.ts` into a lightweight script.
    - _Manual Check_: Reload the extension. Does it correctly load your user data and display the accurate premium status?

### Phase 5: Final Cleanup

1.  Verify the `SquarespaceAnalyzer` "God Object" class has been successfully annihilated and `main.ts` is just a clean import file indexing the managers.
2.  Run the automated linting/formatting tests (`pnpm run build` or equivalent).
3.  Commit the final structure via the User's slash commands to push to remote.
