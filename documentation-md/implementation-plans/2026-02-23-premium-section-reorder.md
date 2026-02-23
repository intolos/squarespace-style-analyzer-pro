# Reorder Popup Sections — Premium Users Only

**Goal**: When the popup detects a premium user, reorder the informational sections below the "Modify Premium Details" button. Free users see the original order unchanged.

> [!IMPORTANT]
> This is a **JS-only change**. The HTML source order stays as-is (free-user order). The reorder is applied at runtime, inside the existing `if (this.isPremium)` block.

---

## Section Order

| #                              | Section                         | HTML identifier                    |
| ------------------------------ | ------------------------------- | ---------------------------------- |
| **Free order (HTML as-is)**    |                                 |                                    |
| 1                              | Click to See (benefits link)    | `#uiBenefitsLink` (`<a>`)          |
| 2                              | 🌟 Premium Benefits             | first `.premium-features` div      |
| 3                              | Why Would You Use…? (use-cases) | `.use-cases-section`               |
| 4                              | ❤️ Share this Extension         | second `.premium-features` div     |
| 5                              | Questions, Suggestions, Reviews | third `.premium-features` div      |
| 6                              | Independent Developer…          | `.developer-section` (always last) |
| **Premium order (JS-applied)** |                                 |                                    |
| 1                              | Questions, Suggestions, Reviews | third `.premium-features` div      |
| 2                              | ❤️ Share this Extension         | second `.premium-features` div     |
| 3                              | Why Would You Use…? (use-cases) | `.use-cases-section`               |
| 4                              | Click to See (benefits link)    | `#uiBenefitsLink`                  |
| 5                              | 🌟 Premium Benefits             | first `.premium-features` div      |
| 6                              | Independent Developer…          | `.developer-section` (always last) |

---

## Proposed Changes

### Popup Controller

#### [MODIFY] [main.ts](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/entrypoints/popup/main.ts)

**Change 1 — Add `reorderSectionsForPremium()` method** (after the existing empty `repositionMobileSectionForUser()` method, ~line 326):

```ts
/**
 * IMPORTANT: Reorders the informational sections below the premium buttons
 * for premium users only. Free users retain the default HTML source order.
 * Called once per popup open from inside the if (this.isPremium) block in updateUI().
 */
reorderSectionsForPremium(): void {
  const mainInterface = document.getElementById('mainInterface');
  if (!mainInterface) return;

  // Locate the anchor point — insert our reordered blocks AFTER #premiumButtonsGroup
  const premiumButtonsGroup = document.getElementById('premiumButtonsGroup');
  if (!premiumButtonsGroup) return;

  // Identify all target sections by their unique selectors
  const allPremiumFeatureDivs = Array.from(
    mainInterface.querySelectorAll(':scope > .premium-features')
  );
  // allPremiumFeatureDivs[0] = Premium Benefits
  // allPremiumFeatureDivs[1] = Share this Extension
  // allPremiumFeatureDivs[2] = Questions, Suggestions, Reviews

  const questionsDiv   = allPremiumFeatureDivs[2]; // "Questions, Suggestions, Reviews"
  const shareDiv       = allPremiumFeatureDivs[1]; // "Share this Extension"
  const useCasesDiv    = mainInterface.querySelector(':scope > .use-cases-section');
  const benefitsLink   = document.getElementById('uiBenefitsLink');
  const premiumBenefitsDiv = allPremiumFeatureDivs[0]; // "🌟 Premium Benefits"
  const developerDiv   = mainInterface.querySelector(':scope > .developer-section');

  if (!questionsDiv || !shareDiv || !useCasesDiv || !benefitsLink || !premiumBenefitsDiv || !developerDiv) {
    console.warn('reorderSectionsForPremium: one or more target sections not found');
    return;
  }

  // Re-insert in the desired premium order immediately after #premiumButtonsGroup
  // insertBefore(node, referenceNode) inserts *before* referenceNode.
  // We use developerDiv as the fixed last anchor and insert everything before it.
  const insertBefore = (node: Element) => mainInterface.insertBefore(node, developerDiv);

  insertBefore(questionsDiv);
  insertBefore(shareDiv);
  insertBefore(useCasesDiv);
  insertBefore(benefitsLink);
  insertBefore(premiumBenefitsDiv);
  // developerDiv stays in place as the last child
}
```

**Change 2 — Call the method inside `updateUI()`** (inside the `if (this.isPremium)` block, ~line 214, after the existing `premiumButtonsGroup.classList.add('premium-position')` line):

```ts
// IMPORTANT: Reorder informational sections to surface the most relevant
// content (Questions, Share) at the top for premium users on every popup open.
this.reorderSectionsForPremium();
```

---

## Verification Plan

### Manual Verification

1. Load the extension as unpacked in Chrome.
2. Open DevTools console and run `enableYearlyTest()` (existing test helper in `main.ts`).
3. Confirm sections below "Modify Premium Details" appear in the premium order.
4. Run `disablePremiumTest()` and confirm sections revert to free-user order on next popup open.
5. Repeat with `enableLifetimeTest()`.
