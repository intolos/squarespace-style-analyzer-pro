# Refactoring main.ts Checklist

## Phase 0: Preparation

- [x] Create initial git checkpoint using state-manager
- [x] Manual Check: State-manager confirmed clean and checkpointed

## Phase 1: Platform Detection (`src/platforms/index.ts`)

- [x] Move `checkIfSquarespace` logic into `src/platforms/index.ts`
- [x] Export and import the detection script into `main.ts`
- [x] Manual Check: "Not a Squarespace Site" banner triggers on non-SQS sites

## Phase 2: UI Manager Extraction (`src/ui/popupUI.ts`)

- [x] Create `popupUI.ts` and `PopupUIManager` static class
- [x] Move `updateUI`, `resetUpgradeButtons`, `showPlatformBanner`, `setPremiumBenefits`, `repositionMobileSectionForUser` into `PopupUIManager`
- [x] Refactor `main.ts` methods to delegate to `PopupUIManager`
- [x] Manual Check: Layout, locked sections, and banners render correctly

## Phase 3: Event Bindings (`src/ui/eventBindings.ts`)

- [x] Create `src/ui/eventBindings.ts`
- [x] Move `bindEvents` and `bindDomainAnalysisEvents` functions
- [x] Extended `AnalyzerController` interface with all method signatures
- [x] Both sqs and generic builds pass with no errors
- [x] Manual Check 1: Click "Analyze This Page" — analysis starts and spinner appears
- [x] Manual Check 2: While analyzing, click "Cancel" — stops and button reverts
- [x] Manual Check 3: After analysis, click "Export CSV" — file downloads
- [x] Manual Check 4: After analysis, click "Export HTML Report" — file downloads
- [x] Manual Check 5: After analysis, click "Export Style Guide" — file downloads
- [x] Manual Check 6: After analysis, click "Export Mobile Report" — file downloads
- [x] Manual Check 7: Click "Reset" — results clear and start state restores
- [x] Manual Check 8: Click "Check Premium Status" — email prompt opens
- [x] Manual Check 9: Click "Upgrade (Yearly)" — Stripe checkout opens in new tab
- [x] Manual Check 10: Click "Upgrade (Lifetime)" — Stripe checkout opens in new tab
- [x] Manual Check 11: Click "Analyze Entire Domain" — confirmation modal opens
- [x] Manual Check 12: In modal, click "Start Without Mobile" — domain analysis begins
- [x] Manual Check 13: While domain analysis runs, click "Cancel" — stops correctly
- [x] Manual Check 14: Repeat Check 12 with "Start With Mobile" and "Start Mobile Only" buttons for full coverage
- [x] Manual Check 15: Run `enableYearlyTest()` in DevTools — UI switches to premium yearly
- [x] Manual Check 16: Run `enableLifetimeTest()` in DevTools — UI switches to premium lifetime
- [x] Manual Check 17: Run `disablePremiumTest()` in DevTools — UI reverts to free mode

## Phase 4: Premium Logic & Billing (`src/managers/premiumFlowManager.ts`)

- [ ] Create `premiumFlowManager.ts`
- [ ] Extract `checkPremiumStatus`, `handleUpgradeFlow`, and `checkAndShowReviewModal`
- [ ] Refactor `main.ts` methods to delegate to `PremiumFlowManager`
- [ ] Manual Check: Run "Check Premium Status" flow end-to-end with Stripe polling

## Phase 5: State Extraction & Startup Logic (`src/state/popupState.ts`)

- [ ] Create `popupState.ts` and `src/managers/startupManager.ts`
- [ ] Move state variables and `.init()` logic into these files
- [ ] Delete the `SquarespaceAnalyzer` class from `main.ts` completely
- [ ] Clean up imports
- [ ] Final Manual Check: Reload extension, verify state and counters hold
