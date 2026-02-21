# Handover: Squarespace Background Detection & Border-Color Investigation (2026-02-20)

## Current Status

### Completed This Session

1. **Squarespace Background Detection Integration** ✅
   - Integrated `sqsProposedMethod` (Method 6) from test harness into production `squarespaceDetector.ts`
   - Detection order: clicked-element → dom-walk-parent → section-css-var → css-class-rules → pseudo → dom-walk → indeterminate
   - Section CSS variable detection now works for BOTH manual clicks AND automated scanning
   - Uses `--siteBackgroundColor` from `<section>` elements

2. **Indeterminate Message Fix** ✅
   - Changed "Contrast Checker Tool" → "Color Checker Tool" in `baseDetector.ts`
   - Applied to all documentation

3. **Outlier Deduplication** ✅
   - Added `deduplicateInstances()` function in `outliers.ts`
   - Deduplicates by section + block + property + element key

### In Progress

4. **False Border-Color Detection (Squarespace Only)**
   - Problem: Elements like `header-dropshadow`, `header-background-solid` incorrectly tracked as "border-color"
   - Correct border IS detected (`#ededed` for `DIV.header-border`)
   - False positives showing `#f2f4f7` for elements without intentional borders

---

## Next Steps: Debug False Border-Color Detection

### Test Site
- **URL**: launchhappy.co (Squarespace)

### Implementation Plan

**Step 1: Add Temporary Debug Logging**
- File: `wxt-version/src/analyzers/styleExtractor.ts` (after line 78)
- File: `wxt-version/src/analyzers/colorScanner.ts` (after line 171)
- Log format: `[SSA-SQS-BORDER] Element: {selector}, borderTop: {color}, width: {width}, style: {style}, shouldTrackBorder: {true/false}`
- Only log when platform === 'squarespace'

**Step 2: Build and Test**
```bash
cd wxt-version && npm run build:sqs
```

**Step 3: Run Analysis**
- Open browser console on launchhappy.co
- Look for `[SSA-SQS-BORDER]` log entries
- Find entries for: `header-dropshadow`, `header-background-solid`, `header-border`

**Step 4: Analyze Root Cause**
- Compare values between correct and incorrect detections
- Identify which condition in `shouldTrackBorder()` is failing
- Expected root cause: Default/inherited border values being tracked when no explicit border CSS set

**Step 5: Implement Fix**
- Modify `shouldTrackBorder()` in `colors.ts` OR add explicit border check
- ONLY applies to Squarespace platform
- Keep debug logging until fix verified by user

**Step 6: Remove Debug Logging**
- User will confirm when to remove temporary logs

---

## Files Modified This Session

| File | Change |
|------|--------|
| `src/analyzers/backgroundDetectors/baseDetector.ts` | Changed "Contrast" → "Color" in indeterminate message |
| `src/analyzers/backgroundDetectors/types.ts` | Added new DetectionMethod types, clickCoordinates to context |
| `src/analyzers/backgroundDetectors/squarespaceDetector.ts` | Complete rewrite with new detection order + section CSS var |
| `src/export/styleGuideColorsReport/templates/sections/outliers.ts` | Added deduplication logic |
| `documentation-md/architecture/platform-background-detection.md` | Updated detection order |
| `documentation-md/architecture/platform-background-detection-squarespace-specific.md` | Marked integration complete |

---

## Key Code References

- **Border detection**: `styleExtractor.ts:58-99`, `colorScanner.ts:150-192`
- **Border filter**: `colors.ts:677-695` (`shouldTrackBorder` function)
- **Platform check**: `trackColor()` accepts `platform` parameter (line 244)

---

## User Instructions

1. Build: `npm run build:sqs`
2. Test on launchhappy.co
3. Check console for `[SSA-SQS-BORDER]` logs
4. Analyze root cause
5. Confirm when to remove debug logging
