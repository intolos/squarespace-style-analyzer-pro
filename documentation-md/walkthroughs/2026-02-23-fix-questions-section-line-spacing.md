# Fix: Line Spacing in "Questions, Suggestions, Reviews" Section

**Date**: 2026-02-23  
**File Changed**: `wxt-version/entrypoints/popup/index.html`

## Problem

The first paragraph in the "Questions, Suggestions, Reviews" section of the popup had `line-height: 1.6`, while all other content blocks in the same section used `line-height: 1.2`. This made the first paragraph appear visually over-spaced compared to the rest.

## Root Cause

Inline style mismatch: the `<p>` at line 337 had `line-height: 1.6` while the adjacent `<div>` at line 341 correctly had `line-height: 1.2`.

## Fix Applied

Changed `line-height: 1.6` → `line-height: 1.2` on the first `<p>` tag in the section (line 337).

```diff
-  <p style="color: #0c4a6e; font-size: 0.9rem; line-height: 1.6; margin: 10px 0 0 0; text-align: center;">
+  <p style="color: #0c4a6e; font-size: 0.9rem; line-height: 1.2; margin: 10px 0 0 0; text-align: center;">
```

## Verification

Visual: all paragraphs in the "Questions, Suggestions, Reviews" section now have consistent line spacing (`1.2`).

No architectural changes. No known issue regressions.
