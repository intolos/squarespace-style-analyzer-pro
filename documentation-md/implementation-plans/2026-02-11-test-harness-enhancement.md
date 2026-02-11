# Implementation Plan: Test Harness Enhancement - Compare Fast Path Versions

## Objective
Enhance the existing test harness to:
1. Compare "Fast Path Original" vs new "Fast Path" implementation
2. Add precision scoring column ("1 diff by 1" criteria)
3. Validate that both methods produce equivalent results

## Background
The test harness currently has 3 methods (Fast Path, Smart Hybrid, Full Hybrid). We need to:
- Rename existing Fast Path → "Fast Path Original"
- Add new Fast Path method → "Fast Path" (revised implementation)
- Add accuracy comparison column per technique

## Changes Required

### 1. Test Harness File: `colorDetectionTestHarness.ts`

#### A. Rename Existing Fast Path
- Change `fastPathMethod()` → `fastPathOriginalMethod()`
- Update all references and display names

#### B. Add New Fast Path Method
Create new function `fastPathNewMethod()` with:
- **Order**: Pseudo-elements (::before, ::after) → CSS classes (*background*, *bg*, *backdrop*) → Computed style
- **Exclude**: .is-style-* patterns
- **No DOM walking**
- **Return**: Color or indeterminate message

#### C. Add "1 Diff by 1" Accuracy Column
New CSV column format: `{TechniqueName} 1diff1`

**Column Logic for Each Technique:**
```
Compare: Manual Result vs Technique Result
Example: Manual="#169370", Technique="#179370"

Check each character position:
- Position 0: # vs # (match)
- Position 1: 1 vs 1 (match)
- Position 2: 6 vs 7 (diff=1) ← Only 1 position differs
- Position 3: 9 vs 9 (match)
- Position 4: 3 vs 3 (match)
- Position 5: 7 vs 7 (match)
- Position 6: 0 vs 0 (match)

Result: "yes" (exactly 1 position differs by exactly 1)
```

**Decision Tree:**
- If manual == technique → "exact"
- If exactly 1 position has difference of exactly 1 → "yes"
- If more than 1 position differs → "no"
- If 1 position differs by more than 1 → "no"

**Algorithm Steps:**
1. Normalize both colors to same format (hex 6-char)
2. Compare character by character
3. Count positions with differences
4. For differing positions, calculate numeric difference
5. Apply criteria:
   - diffCount === 0 → "exact"
   - diffCount === 1 && diffValue === 1 → "yes"
   - else → "no"

### 2. CSV Export Enhancement

**Current CSV Columns:**
- Element, Selector, Method Colors, Method Times, Method Confidences, Manual_Verification, Accuracy Columns

**New CSV Columns (added):**
- `FastPathOriginal_1diff1`
- `FastPath_1diff1`
- `SmartHybrid_1diff1`
- `FullHybrid_1diff1`

Each contains: "exact", "yes", or "no"

### 3. UI/Form Updates

**Test Result Form:**
- Rename "Fast Path" → "Fast Path Original"
- Add new row: "Fast Path (New)"
- Display all 4 methods in comparison table

### 4. Implementation Steps

**Phase 1: Rename and Refactor**
- [ ] Rename `fastPathMethod()` to `fastPathOriginalMethod()`
- [ ] Update `testResults` interface to include 4th method
- [ ] Update `MethodResult` type if needed

**Phase 2: Create New Fast Path**
- [ ] Create `fastPathNewMethod()` with revised logic
- [ ] Implement CSS class analysis (*background*, *bg*, *backdrop*)
- [ ] Implement pseudo-element checking
- [ ] Implement computed style fallback
- [ ] Add indeterminate message handling

**Phase 3: Add Diff Calculation**
- [ ] Create `calculateOneDiffOne(manual: string, technique: string): string` function
- [ ] Implement hex color normalization
- [ ] Implement character-by-character comparison
- [ ] Implement difference counting logic

**Phase 4: Update CSV Export**
- [ ] Add 4 new columns to CSV header
- [ ] Calculate 1diff1 values for each technique
- [ ] Include in CSV row generation

**Phase 5: Update UI**
- [ ] Modify test overlay to show 4 methods
- [ ] Rename labels: "Fast Path" → "Fast Path Original"
- [ ] Add label: "Fast Path (New)"

**Phase 6: Testing**
- [ ] Build extension
- [ ] Test with colorDetectionTestHarness.ts
- [ ] Run on WordPress.com VIP section
- [ ] Compare results between Fast Path Original vs Fast Path New
- [ ] Verify 1diff1 calculations are correct

### 5. Files to Modify

**Only File:**
- `wxt-version/src/analyzers/colorDetectionTestHarness.ts`

**No Other Files Affected**

### 6. Example Output

**Test Scenario:**
- Manual color picker: `#169370`
- Fast Path Original: `#169370` → 1diff1 = "exact"
- Fast Path New: `#179370` → 1diff1 = "yes" (position 2: 6→7)
- Smart Hybrid: `#169370` → 1diff1 = "exact"
- Full Hybrid: `#169371` → 1diff1 = "no" (position 6: 0→1, diff=1 but let's say this fails other criteria)

### 7. Success Criteria

- [ ] Fast Path Original shows same results as before
- [ ] Fast Path New uses revised detection order
- [ ] 1diff1 column accurately identifies "1 difference by 1" cases
- [ ] CSV export includes all 4 methods + 4 new columns
- [ ] Form UI displays all 4 methods clearly
- [ ] Test harness functions: activate, deactivate, export, stats, clear

## Notes

- **No production code changes** - this is test harness only
- **Validation purpose** - compare Fast Path versions before production implementation
- **Accuracy metrics** - "1 diff by 1" indicates acceptable variance (per earlier discussion)

## Approval

⏳ **AWAITING USER APPROVAL**

**Created**: 2026-02-11
**Author**: AI Implementation Agent
**Status**: Draft - Pending Review