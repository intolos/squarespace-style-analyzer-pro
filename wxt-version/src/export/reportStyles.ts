// export/reportStyles.ts
// Shared CSS styles and scripts for HTML reports
// This module provides reusable styling components to ensure consistency across all reports

/**
 * Shared accordion CSS styles
 * Used by: Website Analysis, Mobile Usability, Images, Brand Style Guide reports
 */
export const ACCORDION_STYLES = `
    .accordion-container { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 15px; }
    .accordion-header { padding: 15px; background: #edf2f7; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
    .accordion-header:hover { background: #e2e8f0; }
    .accordion-title { display: flex; align-items: center; gap: 10px; }
    .accordion-icon { font-size: 1.3rem; color: #667eea; transition: transform 0.2s ease; }
    .accordion-container.open .accordion-icon { transform: rotate(90deg); }
    .accordion-count { background: #667eea; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; }
    .accordion-content { display: none; padding: 15px; background: white; }
    .accordion-container.open .accordion-content { display: block; }
`;

/**
 * Shared accordion JavaScript
 * Toggles .open class on accordion containers when header is clicked
 */
export const ACCORDION_SCRIPT = `
  <script>
    // Accordion functionality
    document.addEventListener('click', function(e) {
      const header = e.target.closest('.accordion-header');
      if (header) {
        const container = header.closest('.accordion-container');
        if (container) {
          container.classList.toggle('open');
        }
      }
    });
  </script>
`;

/**
 * Shared section header styles
 * Blue background with white text for major sections
 */
export const SECTION_HEADER_STYLES = `
    .section-header { background: #667eea; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .section-header h2 { margin: 0; color: white; }
    .section-header a { color: white; text-decoration: none; font-size: 1.5rem; }
`;

/**
 * Shared issue item styles
 * Red vertical bar for errors, orange for warnings, hover effect
 */
export const ISSUE_ITEM_STYLES = `
    .issue-item { background: #f8f9fa; padding: 15px 20px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #e53e3e; transition: background 0.2s; }
    .issue-item:hover { background: #e2e8f0; }
    .issue-item.warning { border-left-color: #ed8936; }
`;

/**
 * Shared TOC styles
 * Table of contents styling with blue border
 */
export const TOC_STYLES = `
    .toc { background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 40px; border: 2px solid #667eea; }
    .toc h2 { margin-top: 0; color: #667eea; }
    .toc ul { list-style: none; padding-left: 0; }
    .toc li { margin: 10px 0; }
    .toc a { color: #667eea; text-decoration: none; font-weight: 600; }
    .toc a:hover { text-decoration: underline; }
    .toc-count { background: #667eea; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8rem; margin-left: 8px; }
`;
