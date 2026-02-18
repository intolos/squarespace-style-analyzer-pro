# Platform Detection Testing Guide

**Date**: 2026-02-15
**Purpose**: Standardized testing procedures for background color detection across different CMS platforms
**Status**: Active
**Related Documents**:
- [Platform Background Detection](./platform-background-detection.md) - Architecture overview
- [Test Harness Usage Guide](./test-harness-usage-guide.md) - How to use the testing tool
- [Squarespace-Specific Detection](./platform-background-detection-squarespace-specific.md) - Squarespace testing specifics

---

## 1. Testing Overview

### 1.1 Why Platform-Specific Testing Matters

Different Content Management Systems (CMS) render backgrounds using fundamentally different approaches:

- **WordPress**: Uses pseudo-elements and CSS classes
- **Squarespace**: Uses CSS variables on section elements
- **Wix/Webflow**: Varies by template, often inline styles
- **Shopify**: Theme-dependent, mix of approaches
- **Generic sites**: Unpredictable, custom implementations

Testing on real sites reveals issues that unit tests cannot catch.

### 1.2 Required Test Sites

Before deploying platform detection changes, test on:

| Platform | Minimum Test Sites | Recommended Sites |
|----------|-------------------|-------------------|
| WordPress | 3 | 5+ different themes |
| Squarespace 7.1 | 3 | 5+ different templates |
| Squarespace 7.0 | 2 | 3+ (limited compatibility) |
| Wix | 2 | 3+ |
| Webflow | 2 | 3+ |
| Shopify | 2 | 3+ different themes |
| Generic | 3 | 5+ custom sites |

### 1.3 Test Criteria

**Minimum Requirements**:
- Test on 3+ distinct areas per site
- Test light backgrounds
- Test dark backgrounds  
- Test areas with and without selectors
- Verify against Chrome DevTools color picker
- Document any discrepancies

---

## 2. Test Site Selection

### 2.1 Finding Test Sites

**Squarespace Sites**:
- Search: `site:.squarespace.com launch` (find recently launched sites)
- Squarespace templates showcase
- Designer portfolios on Squarespace

**WordPress Sites**:
- WordPress.com showcases
- ThemeForest demo sites
- Recent design portfolios

**Other Platforms**:
- Wix Arena showcases
- Webflow showcases
- Shopify store examples

### 2.2 Test Site Characteristics

**Ideal Test Sites Have**:
- Multiple sections with different backgrounds
- Mix of light and dark colors
- Text content over colored backgrounds
- No custom code that might interfere
- Publicly accessible

**Avoid**:
- Sites with heavy JavaScript animations
- Sites with video backgrounds
- Sites with heavy custom CSS
- Sites behind login walls

---

## 3. Testing Procedure

### 3.1 Pre-Test Setup

1. **Build the extension**:
```bash
cd wxt-version && npm run build:generic
```

2. **Load in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `.output/generic/chrome-mv3/`

3. **Open test site** in new tab

### 3.2 Standard Test Sequence

For each platform, follow this sequence:

#### Step 1: Activate Test Mode
```javascript
// In browser console on test site
activateColorTestMode()
```

#### Step 2: Test Area Selection

**Select 3+ distinct areas**:
1. **Hero section** - Large background area, typically first section
2. **Content section** - Text area with different background
3. **Footer/Alternate section** - Different color than hero

**For each area**:
- Click on background (not text/images)
- Record results in overlay
- Manually verify with color picker
- Note selector presence/absence

#### Step 3: Results Documentation

**Capture for each test**:
```
Site: [URL]
Platform: [WordPress/Squarespace/etc]
Test Area: [1/2/3]
Element: [body/div/section/etc]
Selector: [present/absent - if present, copy path]
Detected Color: [hex]
Manual Color: [hex from picker]
Match: [YES/NO - tolerance ±1 hex digit]
Notes: [any issues]
```

### 3.3 Verification Methods

**Primary Verification**:
1. Chrome DevTools Elements tab
2. Computed styles panel
3. Background-color property
4. Color picker tool (eyedropper)

**Secondary Verification**:
1. Screenshot the area
2. Open in image editor
3. Sample color with eyedropper

**Cross-Reference**:
- Compare with WAVE tool
- Compare with Lighthouse
- Manual visual inspection

---

## 4. Platform-Specific Testing

### 4.1 Squarespace 7.1 Testing

**Test Sites**:
- launchhappy.co (current reference)
- [Find additional sites via Google search]

**Key Test Areas**:
1. **Body click** - Should find section via coordinates
2. **Section background** - Should find via selector or closest section
3. **Content inside section** - Should find section via DOM walk

**Expected CSS Variable**: `--siteBackgroundColor`

**Expected Format**: HSLA (`hsla(258,100%,98.04%,1)`)

**See Also**: [Squarespace-Specific Detection Guide](./platform-background-detection-squarespace-specific.md)

### 4.2 WordPress Testing

**Test Sites**:
- Sites using LaunchPad theme
- Popular themes: Astra, Divi, Elementor

**Key Test Areas**:
1. **Button backgrounds** - Often on ::before pseudo-element
2. **Section backgrounds** - May use CSS classes
3. **Header/footer** - Different detection patterns

**Expected Approach**: Pseudo-element detection priority

**See Also**: [WordPress Detector Section](./platform-background-detection.md#52-wordpress-detector)

### 4.3 Generic Sites Testing

**Test Sites**:
- Custom HTML/CSS sites
- Bootstrap sites
- Tailwind CSS sites

**Key Test Areas**:
1. **Inline styles** - style="background-color: #..."
2. **CSS classes** - .bg-blue-500, .bg-primary
3. **Mixed approaches** - unpredictable combinations

**Expected Approach**: Conservative, multi-method fallback

---

## 5. Common Issues and Solutions

### 5.1 Issue: Detection Returns Wrong Color

**Symptoms**:
- Returns white (#FFFFFF) on colored background
- Returns nearby element's color
- Color is off by several hex digits

**Debugging Steps**:
1. Check console for `[SQS Debug]` logs
2. Verify click coordinates are correct
3. Check if element has a selector path
4. Test with DevTools element picker
5. Compare bounding rectangles

**Solutions**:
- Add click coordinate detection
- Check parent sections
- Handle CSS variables
- Add format conversion (HSLA→RGB)

### 5.2 Issue: Works on One Site, Fails on Another

**Symptoms**:
- Same platform, different results
- Theme-specific failures
- Template variations cause issues

**Debugging Steps**:
1. Compare DOM structures
2. Check for custom CSS
3. Verify CSS variable names
4. Test class name patterns

**Solutions**:
- Add theme-specific detection
- Use multiple fallback methods
- Document template differences

### 5.3 Issue: No Selector Path Available

**Symptoms**:
- Clicked element is body
- No parent elements have IDs/classes
- DOM walk finds nothing useful

**Debugging Steps**:
1. Use `document.elementFromPoint(x, y)`
2. Check all sections on page
3. Use bounding rectangles
4. Verify scroll position

**Solutions**:
- Implement coordinate-based detection
- Query all potential containers
- Add section-level detection

---

## 6. Test Results Template

Use this template for documenting test results:

```markdown
## Test Results: [Site Name]

**Date**: [YYYY-MM-DD]
**Tester**: [Name]
**Platform**: [WordPress/Squarespace/Wix/etc]
**Theme/Template**: [Theme name if known]

### Test Area 1: [Description]
- **Location**: [Hero/Content/Footer]
- **Element**: [body/div/section]
- **Selector**: [Path or "none"]
- **Manual Color**: [#RRGGBB]
- **Detected Color**: [#RRGGBB]
- **Match**: [YES/NO ±1 digit]
- **Notes**: [Any issues or observations]

### Test Area 2: [Description]
...

### Test Area 3: [Description]
...

### Summary
- **Success Rate**: [X/3 areas]
- **Issues Found**: [List any problems]
- **Recommendations**: [Suggested fixes]
```

---

## 7. Regression Testing

### 7.1 When to Regression Test

**Required**:
- After any color detection code changes
- After platform detection updates
- Before releases
- After browser updates

### 7.2 Regression Test Suite

**Maintain a list of known-good test sites**:
```
1. launchhappy.co (Squarespace 7.1) - 3 test areas
2. [site2] (WordPress) - 3 test areas
3. [site3] (Generic) - 3 test areas
...
```

**Run full suite**:
- Before releases
- Weekly during active development
- After major refactors

### 7.3 Regression Failure Protocol

If a previously working site fails:

1. **Immediate**:
   - Document the failure
   - Check if site was redesigned
   - Test with previous extension version

2. **Investigation**:
   - Compare DOM structures
   - Check for new CSS patterns
   - Review console errors

3. **Resolution**:
   - Fix detection logic
   - Update documentation
   - Add to regression suite

---

## 8. Continuous Testing

### 8.1 Automated Testing (Future)

**Goal**: Automated testing across multiple sites

**Approach**:
```
1. Playwright E2E tests
2. Screenshot comparison
3. Color sampling validation
4. Cross-browser testing
```

**Status**: Manual testing required until automated suite is built

### 8.2 Community Testing

**Beta Testing**:
- Release beta versions
- Collect user reports
- Test on diverse sites

**Feedback Collection**:
- GitHub issues for failures
- Screenshots of incorrect detections
- Site URLs for testing

---

## 9. Troubleshooting Tools

### 9.1 Essential Console Commands

```javascript
// Check element at click position
document.elementFromPoint(x, y)

// Get all sections
const sections = document.querySelectorAll('section');
sections.forEach((s, i) => console.log(i, s.className));

// Check CSS variable
getComputedStyle(element).getPropertyValue('--siteBackgroundColor')

// Get bounding rect
element.getBoundingClientRect()

// Check background color
getComputedStyle(element).backgroundColor
```

### 9.2 Chrome DevTools Features

**Elements Tab**:
- Inspect element
- Check computed styles
- View CSS variables (hover to see value)

**Console Tab**:
- Run test commands
- Check debug logs
- Test detection functions

**Rendering Tab**:
- Paint flashing (see what's being drawn)
- Layer borders (understand stacking)

---

**Last Updated**: 2026-02-15
**Test Sites Validated**: launchhappy.co
**Platforms Covered**: WordPress, Squarespace, Generic
**Next Review**: After next major platform addition