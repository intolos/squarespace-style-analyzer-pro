# Walkthrough: Fixing Eleventy Build Error

## Problem

The Eleventy build for `z-extension-benefits-pages` failed with an `undefined filter: safe` error. This was caused by the root `benefits.html` file being processed as a Liquid template in Eleventy v3, which does not natively support the Nunjucks-style `safe` filter.

Furthermore, my initial attempt to fix this by adding a universal `safe` filter in the configuration inadvertently shadowed the built-in Nunjucks `safe` filter, which was still working fine in your `.njk` templates. This resulted in HTML characters being escaped in the generated output (making the CSS code visible on the page).

## Solution

The correct solution is to ignore the root `benefits.html` file, as it is a redundant or old version of the template already present in `_includes/benefits.njk`. This allows the rest of the project (managed by `master.njk`) to build normally without the Liquid engine error.

### Modified Files

- `eleventy.config.js`:
  - **Removed**: The custom `safe` filter that was causing the HTML escaping issue.
  - **Added**: Explicit ignores for the root `benefits.html` and its backup file to prevent them from being processed.
  ```javascript
  eleventyConfig.ignores.add('benefits.html');
  eleventyConfig.ignores.add('benefits.html~');
  ```

### Modified UI Styles

- `_includes/benefits.njk`:
  - Adjusted `.quality-table thead th` and `table.qc-table thead th` to include `position: sticky` and `top: 60px`.
  - This ensures that table headers remain visible exactly below the 60px fixed top navigation bar during page scrolling.

## Verification

Please run the build command again:

```bash
npx @11ty/eleventy
```

### Expected Results

1. The build should succeed without errors.
2. The folder `_site/benefits/` should no longer be generated.
3. The 27 generated files in your `squarespace-extension` folder should now have:
   - **Correct HTML Rendering**: No more escaped tags or visible CSS code.
   - **Functional Sticky Headers**: Table headers will now stick below the navigation bar correctly.
