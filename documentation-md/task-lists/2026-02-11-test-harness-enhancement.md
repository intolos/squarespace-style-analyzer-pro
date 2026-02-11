# Task Checklist: Test Harness Enhancement

## Pre-Implementation
- [ ] Review current test harness code
- [ ] Backup current test harness (export CSV of existing tests if any)

## Phase 1: Rename Existing Fast Path
- [ ] Rename `fastPathMethod()` to `fastPathOriginalMethod()`
- [ ] Update `MethodResult` type to include 4 methods
- [ ] Update `TestResult` interface
- [ ] Update all references in the file
- [ ] Test that existing functionality still works

## Phase 2: Create New Fast Path Method
- [ ] Create `fastPathNewMethod()` function
- [ ] Implement pseudo-element checking (`::before`, `::after`)
- [ ] Implement CSS class analysis:
  - [ ] Find classes containing *background*
  - [ ] Find classes containing *bg*
  - [ ] Find classes containing *backdrop*
  - [ ] Exclude .is-style-* patterns
- [ ] Query document.styleSheets for CSS rules
- [ ] Extract background-color from matching CSS rules
- [ ] Implement computed style fallback
- [ ] Add indeterminate message return
- [ ] Add timing measurement

## Phase 3: Add "1 Diff by 1" Calculation
- [ ] Create `calculateOneDiffOne()` helper function
- [ ] Implement hex color normalization (handle #rgb, #rrggbb, rgb(), rgba())
- [ ] Implement character-by-character comparison
- [ ] Implement difference counting:
  - [ ] Count positions with differences
  - [ ] Calculate numeric difference for each position
  - [ ] Apply criteria: exactly 1 position, difference exactly 1
- [ ] Return values: "exact", "yes", "no"

## Phase 4: Update CSV Export
- [ ] Add 4 new column headers:
  - [ ] FastPathOriginal_1diff1
  - [ ] FastPath_1diff1
  - [ ] SmartHybrid_1diff1
  - [ ] FullHybrid_1diff1
- [ ] Calculate 1diff1 for each technique
- [ ] Include in CSV row generation
- [ ] Test CSV export with sample data

## Phase 5: Update Test Form UI
- [ ] Modify `createTestOverlay()` function
- [ ] Update table to show 4 methods (was 3)
- [ ] Rename "Fast Path" → "Fast Path Original"
- [ ] Add row: "Fast Path (New)"
- [ ] Ensure all 4 colors display correctly
- [ ] Ensure timing displays for all 4
- [ ] Test form layout doesn't break

## Phase 6: Build and Test
- [ ] Run `npm run build:generic`
- [ ] Fix any compilation errors
- [ ] Load extension in Chrome
- [ ] Navigate to WordPress.com
- [ ] Run `activateColorTestMode()`
- [ ] Test 10-20 elements
- [ ] Export CSV
- [ ] Verify CSV has correct columns
- [ ] Verify 1diff1 calculations are accurate

## Validation Criteria

**Must Pass:**
- [ ] Fast Path Original produces same results as before rename
- [ ] Fast Path New uses correct detection order
- [ ] 1diff1 column shows "exact" when colors match perfectly
- [ ] 1diff1 column shows "yes" when exactly 1 char differs by 1
- [ ] 1diff1 column shows "no" for all other cases
- [ ] All 4 methods appear in test form
- [ ] CSV export includes all data correctly

**Example Validation:**
- Manual: `#169370`
- Fast Path Original: `#169370` → 1diff1 = "exact"
- Fast Path New: `#179370` → 1diff1 = "yes"
- Smart Hybrid: `#169370` → 1diff1 = "exact"
- Full Hybrid: `#169371` → 1diff1 = "no"

## Post-Implementation
- [ ] Save example CSV showing comparison
- [ ] Document any differences found between Fast Path versions
- [ ] Archive task list

## Notes

- **No production code changes** - test harness only
- **Purpose**: Validate new Fast Path before implementing in production
- **Focus**: Compare accuracy between Fast Path Original vs Fast Path New

## Approval

⏳ **AWAITING USER APPROVAL**

**Created**: 2026-02-11
**Status**: Draft - Pending Review