# Code Review Instructions

Use this document as a guide when performing code reviews on the Squarespace Style Analyzer Pro extension.

## Review Categories

### 1. Unused Code Detection

- **Exported but never imported** - Functions exposed via `return {}` or `window.X` but never called
- **Dead code paths** - Conditional branches that can never execute
- **Commented-out code** - Old code left in comments (should be removed, Git has history)
- **Unused variables** - Declared but never read
- **Unused dependencies** - Items in `package.json` not actually used in production code

### 2. Spaghetti Code Identification

- **Functions > 100 lines** - Flag for potential extraction
- **Deep nesting > 4 levels** - Indicates complex logic needing refactoring
- **Circular dependencies** - File A imports B which imports A
- **God functions** - Single functions doing too many unrelated things
- **Duplicate code blocks** - Same logic repeated in multiple places (DRY violations)
- **Inconsistent patterns** - Same task done differently in different places

### 3. Optimization Opportunities

- **DOM queries in loops** - Should be cached outside loop
- **Repeated `getComputedStyle()` calls** - Expensive, should be cached
- **Large data structures in storage** - Could be compressed or chunked
- **Synchronous operations** - Could be async for better UX
- **Memory leaks** - Event listeners not cleaned up, growing arrays

### 4. Code Quality Checks

- **Missing error handling** - Try/catch where needed
- **Magic numbers/strings** - Should be constants
- **Console.log statements** - Debug code left in production
- **Inconsistent naming** - camelCase vs snake_case mixtures
- **Missing JSDoc comments** - On public API functions

---

## File-by-File Review Checklist

For each JavaScript file, check:

```
[ ] Size appropriate? (flag if > 500 lines)
[ ] Single responsibility? (does one thing well)
[ ] All exports used?
[ ] No duplicate logic with other files?
[ ] Error handling present?
[ ] Reasonable function sizes? (< 100 lines each)
[ ] Console.logs appropriate? (not excessive debug output)
```

---

## Priority Files to Review

Based on size and complexity, review in this order:

1. **`domain-analyzer.js`** (1,199 lines) - Highest priority, largest file
2. **`export-style-guide-colors-report.js`** (50,951 bytes) - Large export logic
3. **`export-html-reports.js`** (49,424 bytes) - Large export logic
4. **`domain-analysis-ui.js`** (664 lines) - UI coordination
5. **`content-script-analyzers.js`** (973 lines) - Analysis logic
6. **`content-script-helpers.js`** (28,088 bytes) - Shared utilities
7. **`sqs-style-analyzer-main.js`** (633 lines) - Main coordinator
8. **`background.js`** (656 lines) - Service worker
9. **`popup.js`** (495 lines) - Popup controller
10. **`color-analyzer.js`** (25,095 bytes) - Color analysis

---

## Known Areas Needing Investigation

### Potentially Unused Code

- `analyzeListItems` - Defined but not in public API export (line 524-608 in `content-script-analyzers.js`)
- `checkUrlForInspection` - Live inspector feature, verify if still active

### Large Functions to Consider Splitting

- `analyzePageInBackground` in `domain-analyzer.js` (~460 lines)
- `mergeAllResults` in `domain-analyzer.js` (~340 lines)

### Potential DRY Violations

- Parent-walking DOM traversal loops appear in multiple analyzers
- HTML generation patterns repeated across export files
- Error handling patterns could be standardized

---

## Output Format

When conducting a review, produce findings in this format:

```markdown
## [Filename]

### Unused Code

- Line X-Y: `functionName` - Reason it appears unused

### Spaghetti / Complexity

- Line X-Y: `functionName` (N lines) - Suggestion for improvement

### Optimization

- Line X: Issue description - Suggested fix

### Quick Wins

- Line X: Easy improvement opportunity
```

---

## Review Commands

Useful grep patterns to find common issues:

```bash
# Find console.log statements
grep -rn "console.log" --include="*.js" .

# Find TODO/FIXME comments
grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.js" .

# Find functions over 100 lines (manual check needed)
# Look for function declarations and count to closing brace

# Find duplicate string literals
grep -rn "'[^']{20,}'" --include="*.js" . | sort | uniq -d
```

---

## Post-Review Actions

After completing a review:

1. **Document findings** in a `code-review-findings.md` file
2. **Prioritize issues** - Critical, High, Medium, Low
3. **Estimate effort** - Quick fix, Half-day, Multi-day
4. **Create issues/tasks** for approved changes
5. **Do NOT make changes** until discussed with owner
