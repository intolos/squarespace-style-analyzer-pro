# Squarespace Style Analyzer Pro - Development Principles

## Priority Hierarchy

1. **Accuracy** (non-negotiable)
2. **Code Organization** (maintainability)
3. **Performance** (user experience, but never at expense of accuracy)
4. **Code Style** (consistency)

---

# Part 1: Accuracy-First Principles

## Core Principle

**Accuracy is non-negotiable.** This extension is worthless if users cannot trust its results.

Every feature, every analysis, every measurement MUST use the most accurate method available. Performance is secondary to accuracy. Convenience is secondary to accuracy. Simplicity of implementation is secondary to accuracy.

## Mandatory Requirements for All Features

### 1. Use The Most Accurate Method Available

- Never settle for "good enough" approximations
- If a more accurate technique exists (canvas rendering, pixel sampling, etc.), use it
- Research industry-standard tools (WAVE, Lighthouse, axe-core) and match or exceed their accuracy
- Document why the chosen method is the most accurate available

### 2. Validate Against Known Standards

- Compare results against established tools (Chrome DevTools, WAVE, Lighthouse)
- Test on real websites, not just simple test cases
- Document any discrepancies and explain why they exist

### 3. Handle Edge Cases Correctly

- Background images and gradients
- Overlapping elements
- Transparent layers
- Pseudo-elements (::before, ::after)
- SVG elements
- Shadow DOM
- Dynamically loaded content
- Responsive designs at different viewports

### 4. Fail Loudly, Not Silently

- If detection fails, log warnings
- Never make assumptions that could lead to false negatives
- Provide users with information about limitations
- Better to say "unable to determine" than to report incorrect data

### 5. Continuous Accuracy Audits

- When implementing any new feature, ask: "Is this the most accurate method?"
- When fixing bugs, ask: "Are there other inaccuracies we haven't discovered?"
- Regularly test against competitor tools
- Document any known limitations clearly

## Specific Accuracy Standards

### WCAG Contrast Analysis

- MUST handle background images, gradients, overlapping elements
- MUST match WAVE tool accuracy (within 0.1:1 ratio)
- MUST account for text size and weight correctly
- MUST check all visible text elements

### Color Detection

- MUST distinguish between text, background, border, fill colors
- MUST only track visible colors (width > 0 for borders)
- MUST handle transparent and semi-transparent colors correctly
- MUST deduplicate accurately without losing location information
- MUST track SVG fill/stroke colors

### Typography Analysis

- MUST detect all heading levels (H1-H6)
- MUST identify paragraph styles accurately
- MUST measure font properties from computed styles
- MUST handle custom fonts and web fonts
- MUST track responsive typography changes

### Button Detection

- MUST identify all button types (primary, secondary, tertiary, ghost)
- MUST detect both <button> and <a> elements styled as buttons
- MUST capture all button states (normal, hover, active, disabled)
- MUST track button colors and styles accurately

### Mobile Analysis

- MUST match Google Lighthouse mobile standards exactly
- MUST use Lighthouse's tap target calculation method
- MUST follow WCAG 2.2 mobile guidelines (24px minimum)
- MUST detect viewport configuration correctly
- MUST identify text sizing issues accurately

### Heading Hierarchy

- MUST detect missing H1 tags
- MUST detect multiple H1 tags
- MUST identify skipped heading levels
- MUST track heading order and nesting

### Image Analysis

- MUST detect all img, picture, and background images
- MUST check alt text presence and quality
- MUST identify generic filenames accurately
- MUST measure image dimensions correctly

### Link Analysis

- MUST detect all link types accurately
- MUST identify link styling consistency
- MUST track hover states and focus indicators

## Zero Tolerance for False Negatives and False Positives

False negatives (missing real issues) and false positives (flagging non-issues) are both bad because:

- Users trust the tool and false negatives miss real problems and false positives show problems that don't exist. Both of these destroy trust.
- Undermine the entire value proposition
- Damage credibility and reputation

If there is doubt, err on the side of detecting the issue.

## Performance vs. Accuracy Trade-offs

**Accuracy always wins.** If a feature takes 2 minutes instead of 30 seconds but provides accurate results, do it.

Users will wait for accuracy. They won't forgive inaccuracy.

## Examples of Accuracy-First Thinking

### Wrong Approach

"We'll walk up the DOM tree to find background color. It works most of the time."

### Correct Approach

"We'll use canvas pixel sampling to get the actual visual background color, with DOM walking as a fallback only if canvas fails."

### Wrong Approach

"We'll assume any element with class 'button' is a button."

### Correct Approach

"We'll check element role, tag name, CSS appearance, click handlers, and visual styling to accurately identify all buttons."

### Wrong Approach

"Border width is usually greater than 0, so we'll just track all border colors."

### Correct Approach

"We'll check each border side's width individually and only track colors from borders that are actually visible (width > 0)."

## Final Word on Accuracy

If a user runs this extension and gets different results than WAVE, Lighthouse, or Chrome DevTools, **we are wrong** until proven otherwise.

Match or exceed the accuracy of industry-standard tools. Nothing less is acceptable.

---

# Part 2: Code Organization (Single Responsibility Principle)

## Single Responsibility Principle (SRP)

**CRITICAL: Always follow the Single Responsibility Principle when creating or modifying files.**

### File Organization Rules:

1. **Each file should have ONE clear responsibility**
   - If a file handles multiple concerns, split it into separate files
   - Module names should clearly indicate their single purpose

2. **File Size Guidelines:**
   - If a file exceeds 500 lines, evaluate if it should be split
   - If a file exceeds 700 lines, it MUST be refactored into smaller modules
   - Exception: Generated files or configuration files

3. **Module Separation Examples:**
   - GOOD: `color-analyzer.js` (handles ONLY color analysis)
   - GOOD: `mobile-lighthouse-analyzer.js` (handles ONLY mobile usability checks)
   - BAD: `utils.js` (vague, handles multiple unrelated utilities)
   - BAD: A single file that handles both data fetching AND UI rendering

4. **When to Split a File:**
   - File has multiple distinct sections with different purposes
   - File handles multiple unrelated data transformations
   - File contains both business logic AND presentation logic
   - File has grown beyond 700 lines and handles more than one concern

5. **How to Split:**
   - Extract each responsibility into its own module
   - Use clear, descriptive names that indicate the single purpose
   - Create a coordinator/orchestrator file if needed to combine modules
   - Update imports/exports to maintain functionality

### Current Project Structure:

This extension follows SRP with modules like:

- `color-analyzer.js` - Color conversion, contrast, WCAG compliance
- `content-script-helpers.js` - DOM helpers, section/block detection, color scanning
- `content-script-analyzers.js` - Element analysis (buttons, headings, paragraphs, links, images)
- `content-script-mobile-checks.js` - Mobile-specific checks
- `mobile-lighthouse-analyzer.js` - Lighthouse-based mobile usability analysis
- `sqs-style-analyzer-main.js` - Main coordinator that orchestrates all analyzers

**When modifying or creating files, maintain this level of separation and clarity.**

### File Headers:

- Include a comment at the top of each file describing its single responsibility
- List dependencies if applicable

### Exports:

- Use clear, descriptive names for exported functions/objects
- Group related exports together
- Document the public API

### Testing Considerations:

- SRP makes files easier to test in isolation
- Each module should be independently testable

---

# Part 3: Coding Standards

## Error Handling

### Requirements:

- **Never fail silently** - Always log errors or warnings
- **Validate inputs** at function boundaries
- **Use try-catch** for operations that can fail (canvas rendering, DOM access)
- **Provide fallbacks** with warnings when primary method fails
- **Log meaningful error messages** that help debugging
- \*\*Follow instructions. Do not make stuff up. Do not hallucinate. Do not make assumptions. If there is any question about the way something should be done, ask! Make suggestions and ask.

### Examples:

```javascript
// BAD: Silent failure
function getBackground(element) {
  try {
    return element.getBoundingClientRect();
  } catch (e) {
    return null; // Silent failure - no indication why it failed
  }
}

// GOOD: Loud failure with fallback
function getBackground(element) {
  try {
    return this.getBackgroundFromCanvas(element);
  } catch (e) {
    console.warn('Canvas background detection failed, using DOM fallback:', e);
    return this.getBackgroundFromDOM(element);
  }
}
```

## Testing Requirements

### Mandatory for All Features:

- **Compare against industry tools** (WAVE, Lighthouse, Chrome DevTools)
- **Test on real websites**, not just toy examples
- **Document test results** with actual vs. expected values
- **Test edge cases** (transparent backgrounds, overlapping elements, etc.)
- **Regression tests** for bugs that were fixed

### Test Documentation Format:

```javascript
/*
 * Tested against WAVE on apple.com "Buy" button:
 * - Text: #0066CC, Background: #C7E6F1
 * - Expected ratio: 4.24:1 (FAIL)
 * - Our result: 4.24:1 (FAIL) ✓ MATCHES
 */
```

## Documentation Requirements

### Function Documentation:

```javascript
/**
 * Get the effective background color using canvas pixel sampling.
 * Handles background images, gradients, and overlapping elements.
 *
 * @param {Element} element - The DOM element to check
 * @returns {string|null} RGB/RGBA color string, or null if detection fails
 *
 * Why canvas: Most accurate method, matches WAVE tool behavior.
 * Fallback: DOM tree walking if canvas fails.
 */
getBackgroundColorFromCanvas: function(element) {
  // Implementation
}
```

### File Headers:

```javascript
/**
 * color-analyzer.js
 *
 * Responsibility: Color analysis, conversion, WCAG contrast calculations
 *
 * Dependencies: None (standalone module)
 *
 * Standards: WCAG 2.1, matches WAVE tool accuracy
 */
```

### Limitations Documentation:

- Document known limitations in comments and user-facing reports
- Example: "Canvas rendering may fail in cross-origin iframes"

## Naming Conventions

### Functions:

- **verbNoun** format: `getBackgroundColor`, `calculateContrastRatio`, `trackColor`
- Descriptive and specific: `getEffectiveBackgroundColor` not `getBg`
- Boolean functions: `isTransparent`, `hasDirectText`, `shouldTrackColor`

### Variables:

- **Descriptive nouns**: `effectiveBackground`, `contrastRatio`, `textColor`
- **No single letters** except loop counters (`i`, `j`)
- **No abbreviations** unless universally understood (`bg` → `background`, `el` → `element`)
- **Constants**: `UPPER_SNAKE_CASE` for true constants

### Files:

- Kebab-case: `color-analyzer.js`, `mobile-lighthouse-analyzer.js`
- Name matches single responsibility
- Descriptive, not vague: `color-analyzer.js` not `utils.js`

## Code Quality Standards

### DRY (Don't Repeat Yourself)

- Extract repeated logic into functions
- Create utility functions for common operations
- Share code between modules appropriately

### No Magic Numbers

```javascript
// BAD
if (fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700)) {

// GOOD
const LARGE_TEXT_SIZE = 18;
const LARGE_TEXT_BOLD_SIZE = 14;
const BOLD_WEIGHT_THRESHOLD = 700;

if (fontSize >= LARGE_TEXT_SIZE ||
    (fontSize >= LARGE_TEXT_BOLD_SIZE && fontWeight >= BOLD_WEIGHT_THRESHOLD)) {
```

### Prefer Explicit Over Clever

- Clear code > concise code
- Self-documenting code > comments explaining complex logic
- Straightforward algorithms > clever optimizations (unless profiled)

### Comments Explain "Why", Not "What"

```javascript
// BAD: Comments state the obvious
// Set canvas width to element width
canvas.width = rect.width;

// GOOD: Comments explain reasoning
// Limit canvas size for performance - sampling center pixel is accurate enough
const maxSize = 100;
const scale = Math.min(1, maxSize / Math.max(rect.width, rect.height));
```

## Performance Guidelines

### Primary Rule: Accuracy First

- Never sacrifice accuracy for performance
- Optimize only after ensuring correctness

### When to Optimize:

- **After profiling** - Measure before optimizing
- **Document trade-offs** - Explain why optimization is safe
- **Maintain accuracy** - Prove optimization doesn't reduce accuracy

### Performance Techniques (When Appropriate):

- Cache expensive calculations
- Batch DOM operations
- Limit canvas size while maintaining accuracy
- Use requestAnimationFrame for visual updates

### Example:

```javascript
// Optimized, but maintains accuracy
const maxSize = 100; // Sampling center is accurate enough
const scale = Math.min(1, maxSize / Math.max(rect.width, rect.height));

// Document why this is safe
// "Testing shows center pixel sampling matches full-size rendering 99.9% of the time"
```

---

# Mandatory Planning and Pre-Implementation Checklist

## Before Writing ANY Code, Answer These Questions and follow this first command:

- [ ] **MANDATORY**: I have read `documentation-md/DOCUMENTATION_PROCESSES.md` and understand where to look for architecture vs. history.

- [ ] I will not change items that are working properly. I will not change items that are not working differently than requested.

- [ ] Have I researched how industry-standard tools (WAVE, Lighthouse, axe) implement this?

- [ ] Am I using the MOST accurate method available, not just the easiest?

- [ ] Does this follow SRP? (One file, one responsibility)

- [ ] Have I identified what tests I'll run to validate accuracy?

- [ ] Have I tested against multiple real-world websites?

- [ ] Have I compared my results against established tools?

- [ ] Have I handled all edge cases I can think of?

- [ ] Have I documented my approach and why it's the most accurate?

- [ ] Have I documented any known limitations?

- [ ] Am I following all coding standards? (naming, error handling, documentation)

- [ ] Would I trust these results if I were the user?

- [ ] Have I asked questions to clarify product requirements, technical requirements, engineering principles, and hard constraints?

## Before Writing ANY Fix:

1. **REPRODUCE & OBSERVE**
   - [ ] Can I see the broken behavior myself?
   - [ ] What does the ACTUAL output look like (HTML/DOM/console)?
   - [ ] How does it differ from EXPECTED output?

2. **COMPARE WORKING VS BROKEN**
   - [ ] Is there a working example I can compare against?
   - [ ] What is DIFFERENT between working and broken?
   - [ ] Have I read the actual generated output, not just the source?

3. **DIAGNOSE BEFORE FIXING**
   - [ ] Do I know the ROOT CAUSE, or am I guessing?
   - [ ] Can I explain WHY the bug happens?
   - [ ] Have I verified my diagnosis by reading the actual output?

**IF YOU CANNOT CHECK ALL BOXES: STOP. ASK FOR OUTPUT/EXAMPLES.**

Never implement a fix based on assumptions. Always diagnose first. Never blame the user for not properly generating a new report. Never say that Chrome caches data.

## If You Cannot Check ALL Boxes: STOP

Ask for guidance before proceeding. Never make assumptions.

---

# How to Use This Document

## For Every Task:

1. **Read this entire document** before starting
2. **Reference the checklist** explicitly in your plan
3. **Document which principles apply** to your specific task
4. **Explain your approach** in terms of these principles
5. **If uncertain, ask** - Never assume

## Planning Best Practices:

**Keep Plans Focused and Current**

- Plans should only include work that is **not yet complete**
- Once a task is finished, remove it from the plan file
- Don't include repetitive context or information about completed work
- Each plan should be concise and actionable - focused only on what needs to be done next
- Users don't want to re-read descriptions of work that's already been completed

## Accountability:

If principles are violated:

- User should call it out immediately
- Review why the principle was missed
- Update process to prevent recurrence

## When Principles Conflict:

**Accuracy > Organization > Performance > Style**

Always prioritize higher-level principles.

---

# Examples of Correct Process

## Example 1: Adding WCAG Contrast Feature

### Wrong Process:

1. User asks for contrast checking
2. Implement DOM tree walking
3. Ship it

### Correct Process:

1. User asks for contrast checking
2. **Read DEVELOPMENT_PRINCIPLES.md**
3. **Research**: How does WAVE do this? → Canvas pixel sampling
4. **Checklist**:
   - Most accurate? Yes (canvas)
   - SRP? Add to color-analyzer.js (color analysis responsibility)
   - Tests? Compare against WAVE on apple.com
   - Edge cases? Background images, gradients ✓
   - Documentation? Explain why canvas, document limitations
5. **Implement** canvas-based detection
6. **Test** against WAVE
7. **Document** results and approach

## Example 2: Bug Fix

### Wrong Process:

1. User reports bug
2. Quick fix
3. Ship it

### Correct Process:

1. User reports bug
2. **Understand root cause** - Why did this happen?
3. **Check principles** - Which principle was violated?
4. **Fix properly** using most accurate method
5. **Test** to ensure fix is correct
6. **Audit** - Are there similar bugs elsewhere?
7. **Document** - Add regression test

---

# Living Document

This document should be updated when:

- New accuracy standards are discovered
- Better methods become available
- Principles are refined through experience
- User feedback reveals gaps

**Last Updated:** 2026-01-04
