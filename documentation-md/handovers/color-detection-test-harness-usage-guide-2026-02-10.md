# Color Detection Test Harness - Usage Guide

## Overview

This test harness allows you to A/B test three color detection methods to determine which provides the best balance of accuracy and performance for WordPress sites.

## Three Methods Tested

### 1. Fast Path
- **Approach**: CSS class analysis + computed styles + pseudo-elements
- **Expected Time**: ~5ms per element
- **Best For**: Quick detection when CSS is reliable

### 2. Smart Hybrid
- **Approach**: Fast Path first, then 16-point canvas verification
- **Expected Time**: ~25ms per element
- **Best For**: Balanced accuracy/performance

### 3. Full Hybrid
- **Approach**: Comprehensive CSS + dense 64-point canvas sampling
- **Expected Time**: ~150-200ms per element
- **Best For**: Maximum accuracy regardless of speed

## How to Use

### Step 1: Activate Test Mode

1. Open your browser's Developer Tools (F12)
2. Go to the Console tab
3. Navigate to any WordPress page you want to test
4. Run:
   ```javascript
   activateColorTestMode()
   ```

You'll see a blue indicator in the top-right corner saying "🎨 Test Mode Active"

### Step 2: Test Elements

1. **Click anywhere on an element** you want to test (text, images, or background - it doesn't matter where you click)
2. The code will automatically walk up the DOM tree to find the container with the actual background
3. A popup overlay will appear showing results from all three methods
4. **Use your color picker tool** to sample the actual background color of the highlighted element
5. **Enter your color picker result** in the input field (e.g., `#f6f7f7` or `rgba(246, 247, 247)`)
6. Click **"Submit Result"**

**Important**: Make sure to click on the **background area** (not text or images) when using your color picker for manual verification.

### Step 3: Repeat for Multiple Elements

Test 50-100 elements across different page types:
- Hero sections
- Content sections
- Sidebars
- Footers
- Different background colors (gray, white, colored, gradients)

### Step 4: View Statistics

Check your progress anytime by running:
```javascript
getTestStats()
```

This shows:
- Total tests completed
- Accuracy percentage for each method
- Average time per method

### Step 5: Export Results

When you're done testing (aim for at least 50 elements), run:
```javascript
exportTestResults()
```

This will:
1. Generate a CSV file with all test data
2. Automatically download it to your computer
3. Include columns for accuracy comparison and timing

## CSV Output Columns

The exported CSV includes:
- **Element**: HTML tag name
- **Selector**: Full CSS selector path
- **Method Colors**: Color detected by each method
- **Method Times**: Time taken by each method (ms)
- **Method Confidences**: High/Medium/Low confidence rating
- **Manual_Verification**: Your color picker result
- **Accuracy Columns**: YES/NO for whether each method matched your manual result
- **Fastest_Accurate_Method**: Which method was both accurate and fastest

## Analyzing Results

Open the CSV in Excel or Google Sheets to determine:

1. **Which method has highest accuracy?**
   - Count "YES" in the accuracy columns

2. **Which method is fastest?**
   - Compare average times

3. **Best accuracy/time ratio?**
   - Calculate: Accuracy% / Time(ms)
   - Higher ratio = more efficient

4. **Edge cases?**
   - Look for elements where methods disagree
   - Check confidence ratings

## Deactivate Test Mode

When finished testing, run:
```javascript
deactivateColorTestMode()
```

Or simply refresh the page.

## Tips for Accurate Testing

1. **Test problematic areas first** - Elements where the current extension shows wrong colors
2. **Vary your selections** - Don't just test one section type
3. **Click on different areas** - Sometimes clicking text vs background can help verify the DOM traversal is working correctly
4. **Be consistent** - Always use the same color picker tool for manual verification
5. **Note edge cases** - If you find an element that breaks all methods, make a note of it

## Expected Test Duration

- 50 elements × 30 seconds each = ~25 minutes
- 100 elements × 30 seconds each = ~50 minutes

Plan accordingly based on your accuracy needs.

## After Testing

Share the CSV results and your judgment on:
1. Which method performed best
2. Whether accuracy or speed matters more for your use case
3. Any edge cases or patterns you noticed

This data will determine which method gets implemented in the production extension.