# Development Principles - Critical (Accuracy & Checklists)

**This document contains the MANDATORY accuracy standards and pre-implementation checklists.**
**For detailed coding standards, naming conventions, and reference material, see [DEVELOPMENT_PRINCIPLES.md](./DEVELOPMENT_PRINCIPLES.md).**

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

# Mandatory Planning and Pre-Implementation Checklist

## Mandatory Validation Protocol

All pre-implementation validations, checklists, and debugging methodologies are strictly enforced via the `pre-implementation-validator` skill.

**Before Writing ANY Code or Fix**, you MUST invoke the skill located at:
`.agent/skills/pre-implementation-validator/SKILL.md`

This skill contains the exact steps to reproduce, diagnose, and validate the most accurate methodology against known issues before any implementation begins. Do not bypass this skill.
