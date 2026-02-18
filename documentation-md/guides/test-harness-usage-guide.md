# Color Detection Test Harness Usage Guide

**Date**: 2026-02-15
**Purpose**: Complete guide to using the color detection test harness for A/B testing and validation
**Status**: Active
**Location**: `wxt-version/src/analyzers/colorDetectionTestHarness.ts`
**Related Documents**:
- [Platform Detection Testing Guide](./platform-detection-testing-guide.md) - Testing procedures
- [Color Format Handling Guide](./color-format-handling-guide.md) - Understanding color outputs
- [Squarespace Troubleshooting](../walkthroughs/platform-background-detection-squarespace-specific-details.md) - Real example

---

## 1. Overview

### 1.1 What is the Test Harness?

The Color Detection Test Harness is an **A/B testing framework** built into the extension that allows you to:

- Test multiple color detection methods simultaneously
- Compare results against manual verification
- Export data for analysis
- Validate fixes before production

### 1.2 Why Use It?

**Before the test harness**:
- Manual testing on each site
- No way to compare methods
- Difficult to track improvements

**With the test harness**:
- Automated multi-method testing
- Side-by-side comparison
- CSV export for analysis
- Historical tracking

### 1.3 When to Use

**Use the test harness when**:
- Developing new detection methods
- Debugging color detection issues
- Validating platform-specific fixes
- Testing on new sites
- Before releasing changes

---

## 2. Quick Start

### 2.1 Activation

1. **Load the extension** in Chrome (Developer mode)
2. **Navigate to test site** (e.g., launchhappy.co)
3. **Open browser console** (F12 → Console tab)
4. **Activate test mode**:

```javascript
activateColorTestMode()
```

**Expected output**:
```
🎨 Color Detection Test Mode Activated
Currently have X test results stored
Click on any element to test color detection methods
Click on the BACKGROUND area (not text/images)
Run exportTestResults() when done to get your data
Run clearTestResults() to start fresh
```

### 2.2 Running a Test

1. **Click on a background area** (avoid text, images, buttons)
2. **View results overlay** - Shows all 6 methods
3. **Enter manual verification** - Use color picker tool
4. **Click Submit** - Stores the result

### 2.3 Exporting Results

```javascript
exportTestResults()
```

**Downloads a CSV file** with all test data.

---

## 3. Detailed Usage

### 3.1 Available Commands

**Activate/Deactivate**:
```javascript
activateColorTestMode()     // Start testing
deactivateTestMode()        // Stop testing
```

**Data Management**:
```javascript
exportTestResults()         // Download CSV
clearTestResults()          // Clear all data
```

**Debug Info**:
```javascript
// Check stored results
testResults.length          // Number of stored results
testResults[0]              // View first result
```

### 3.2 Understanding the Results Overlay

When you click, an overlay appears showing:

```
🎨 Color Detection Test Results

Method                    Color       Time     Confidence
────────────────────────────────────────────────────────
Fast Path Original       #FFFFFF      0.5ms    medium
Fast Path               #FFFFFF      0.3ms    medium
Smart Hybrid            #FFFFFF      2.1ms    low
Full Hybrid             #FFFFFF      3.5ms    low
SQS Current             #FFFFFF      1.2ms    high
SQS Proposed            #F8F5FF      1.8ms    high  ← Working!

Manual Verification: [________] [Submit] [Skip]
```

**Columns**:
- **Method**: Detection algorithm used
- **Color**: Hex color returned
- **Time**: Execution time in milliseconds
- **Confidence**: high/medium/low based on detection certainty

### 3.3 Entering Manual Verification

**Using Chrome DevTools**:

1. **Open DevTools** (F12)
2. **Click Elements tab**
3. **Use element picker** (top-left icon)
4. **Click the background area**
5. **Look at Computed styles** (right panel)
6. **Find "background-color"**
7. **Copy the hex value** (e.g., `#F9F5FF`)

**Alternative: Color Picker Extension**:
- Install color picker extension
- Click on background
- Copy hex value

**Enter in overlay**:
- Type hex color in text box
- Click "Submit" to save
- Or click "Skip" to test without verification

---

## 4. Test Results Format

### 4.1 CSV Export Columns

The exported CSV contains:

| Column | Description | Example |
|--------|-------------|---------|
| Element | HTML tag name | `body`, `div`, `section` |
| Classes | CSS classes | `tweak-blog-alternating...` |
| Selector | CSS selector path | `div#siteWrapper > main...` |
| Fast_Path_Original_Color | Method result | `#FFFFFF` |
| Fast_Path_Original_Time | Execution time | `0.52` |
| Fast_Path_Original_Confidence | Confidence level | `medium` |
| ... | (repeated for all 6 methods) | ... |
| Manual_Verification | Your input | `#F9F5FF` |
| Fast_Path_Original_Accurate | Exact match? | `YES`/`NO` |
| ... | (repeated for all methods) | ... |
| Fastest_Accurate_Method | Best performer | `SQS_Proposed` |

### 4.2 Analyzing Results

**Open CSV in Excel/Google Sheets**:

1. **Filter by accuracy**:
   - Column: `*_Accurate`
   - Filter: Only show `YES`

2. **Compare times**:
   - Sort by `*_Time` columns
   - Find fastest accurate method

3. **Identify patterns**:
   - Which methods fail consistently?
   - Which methods are most accurate?
   - Does presence of selector affect accuracy?

### 4.3 Sample Analysis

**From launchhappy.co testing**:

| Test Area | Selector | SQS_Proposed | Manual | Match |
|-----------|----------|--------------|---------|-------|
| Area 1 | none | `#F8F5FF` | `#F9F5FF` | YES |
| Area 2 | none | `#42307D` | `#422F7C` | YES |
| Area 3 | present | `#F8F5FF` | `#F9F5FF` | YES |

**Conclusion**: SQS_Proposed works for all scenarios.

---

## 5. Advanced Usage

### 5.1 Testing Multiple Methods

The test harness automatically tests 6 methods:

1. **Fast Path Original** - Legacy fast detection
2. **Fast Path** - Optimized fast detection
3. **Smart Hybrid** - Smart fallback logic
4. **Full Hybrid** - Full feature detection
5. **SQS Current** - Current production method
6. **SQS Proposed** - New experimental method

**Comparing Methods**:
- All run simultaneously
- Results shown side-by-side
- Easy to identify best performer

### 5.2 Debugging with Console Logs

When `SQS_Proposed` method runs, it outputs debug logs:

```javascript
// In browser console
[SQS Debug] Clicked element: BODY tweak-blog-alternating...
[SQS Debug] Found via clicked element: #FFFFFF
[SQS Debug] Body has white, skipping to section detection
[SQS Debug] Using click coordinates: {x: 500, y: 900}
[SQS Debug] Checking all sections by bounding rect...
[SQS Debug] Section 1: top=800, bottom=1600, inRect=true
[SQS Debug] Found section by rect
[SQS Debug] Section CSS var: hsla(258,100%,98.04%,1)
[SQS Debug] Converted to hex: #F8F5FF
```

**Reading the logs**:
- Shows each step of detection
- Reveals where failures occur
- Helps identify the issue

### 5.3 Custom Testing

**Test specific scenarios**:

```javascript
// Test only body clicks
// Click 3 different areas, all on body background

// Test only content areas
// Click 3 different text elements

// Test edge cases
// Click on section borders
// Click on overlapping elements
```

### 5.4 Regression Testing

**Before releases**:

1. Clear old results: `clearTestResults()`
2. Test on known sites (launchhappy.co, etc.)
3. Run `exportTestResults()`
4. Compare with previous results
5. Verify no regressions

**Document changes**:
- Note which methods improved
- Note any new failures
- Update test documentation

---

## 6. Troubleshooting

### 6.1 Test Mode Won't Activate

**Symptoms**:
- `activateColorTestMode()` returns undefined
- No overlay appears
- No console messages

**Solutions**:
1. Check extension is loaded in `chrome://extensions/`
2. Refresh the page
3. Check console for errors
4. Rebuild extension: `npm run build:generic`

### 6.2 Results Not Saving

**Symptoms**:
- Click Submit but no data stored
- `exportTestResults()` returns empty

**Solutions**:
1. Check for JavaScript errors in console
2. Verify storage permissions in manifest
3. Try refreshing the page
4. Check `testResults.length` in console

### 6.3 Wrong Colors Detected

**Symptoms**:
- All methods return white (#FFFFFF)
- Colors don't match manual verification

**Debugging**:
1. Check console for `[SQS Debug]` logs
2. Verify click coordinates are correct
3. Test with DevTools element picker
4. Compare bounding rectangles

**Solutions**:
- Review detection method implementation
- Check CSS variable names
- Verify color format handling
- See: [Squarespace Troubleshooting](../walkthroughs/platform-background-detection-squarespace-specific-details.md)

### 6.4 Overlay Not Appearing

**Symptoms**:
- Click on element, no overlay shown
- No test results recorded

**Solutions**:
1. Check if click was on overlay itself (ignored)
2. Verify test mode is active
3. Check z-index issues (overlay should be on top)
4. Try clicking on different element

---

## 7. Best Practices

### 7.1 Testing Strategy

**Test systematically**:
1. Test 3+ areas per site
2. Mix light and dark backgrounds
3. Test with and without selectors
4. Document any anomalies

**Be consistent**:
- Use same color picker tool
- Click on pure background (not text)
- Record same information each time

### 7.2 Data Management

**Regular exports**:
- Export after each testing session
- Name files with date: `test-results-2026-02-15.csv`
- Store in version control

**Clear when needed**:
- Clear before new testing round
- Clear if data seems corrupted
- Clear after successful validation

### 7.3 Collaboration

**Share results**:
- Export CSV and share with team
- Include screenshots of failures
- Document which methods work best

**Track improvements**:
- Compare results over time
- Note which fixes worked
- Update documentation

---

## 8. Integration with Development

### 8.1 Adding New Detection Methods

**To add a new method**:

1. **Create method function** in `colorDetectionTestHarness.ts`:
```typescript
async function newMethodName(element: Element): Promise<MethodResult> {
  const startTime = performance.now();
  
  // Your detection logic here
  const color = detectColorSomehow(element);
  
  return {
    color: color,
    timeMs: Math.round((performance.now() - startTime) * 100) / 100,
    confidence: 'high',
    details: 'Method description'
  };
}
```

2. **Add to test execution** in `runTestOnElement()`:
```typescript
const [fastPathOriginal, fastPath, smartHybrid, fullHybrid, sqsCurrent, sqsProposed, newMethod] = await Promise.all([
  // ... existing methods ...
  newMethodName(backgroundContainer)  // Add new method
]);
```

3. **Update CSV export** to include new columns

4. **Update overlay UI** to display new method

### 8.2 Testing Before Production

**Validation checklist**:
- [ ] Test on 3+ different sites
- [ ] Test light and dark backgrounds
- [ ] Test with and without selectors
- [ ] Verify accuracy against manual checks
- [ ] Check execution time (should be fast)
- [ ] Export results and review
- [ ] Document any limitations

### 8.3 Moving to Production

**From test harness to production**:

1. **Copy working method** to production detector file
2. **Remove debug logs** (or reduce verbosity)
3. **Add error handling**
4. **Update documentation**
5. **Remove from test harness** (optional)

---

## 9. Real-World Example

### 9.1 The Squarespace Breakthrough

**Problem**: Detection failing on launchhappy.co

**Testing process**:
1. Activated test mode
2. Clicked 3 test areas
3. Noticed all methods returned white
4. Added debug logging to SQS_Proposed
5. Discovered CSS variable format issue
6. Fixed HSLA parsing
7. Re-tested - all areas working

**Results**:
- Before: 0/3 areas working
- After: 3/3 areas working
- Method: SQS_Proposed with coordinate detection

**Documentation**: [Squarespace Troubleshooting Walkthrough](../walkthroughs/platform-background-detection-squarespace-specific-details.md)

### 9.2 Time Investment

**Typical testing session**:
- Setup: 5 minutes
- Testing: 15-30 minutes
- Analysis: 10 minutes
- Documentation: 20 minutes
- **Total: ~1 hour per platform**

**But worth it**:
- Prevents production bugs
- Validates fixes
- Documents edge cases
- Builds knowledge base

---

**Last Updated**: 2026-02-15
**Test Harness Version**: Current (as of 2026-02-15)
**Methods Tested**: 6 (Fast Path Original, Fast Path, Smart Hybrid, Full Hybrid, SQS Current, SQS Proposed)
**Tested Sites**: launchhappy.co (Squarespace 7.1)