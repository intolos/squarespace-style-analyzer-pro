import { platformStrings } from '../utils/platform';
import { generateReportHeader } from './reportComponents';

export function formatIssueDescription(issue: any): string {
  const typeLabels: Record<string, string> = {
    'viewport-missing': 'Missing viewport meta tag',
    'viewport-improper': 'Improper viewport meta tag',
    'font-size-error': `Font too small: ${issue.details?.actual} (requires ${issue.details?.required})`,
    'font-size-warning': `Font size warning: ${issue.details?.actual} (${issue.details?.required})`,
    'touch-target-too-small': `Touch target too small: ${
      issue.details?.actual
    } (${issue.details?.recommended || 'requires ≥48x48px'})`,
    'horizontal-scroll': 'Page has horizontal scrolling',
    'non-mobile-element': `Non-mobile-friendly element: ${issue.element}`,
    'image-not-responsive': 'Image missing responsive sizing (no srcset)',
    'text-overflow': 'Text overflows container',
    'image-wider-than-viewport': `Image wider than viewport: ${issue.details?.actual}`,
    'input-missing-type': issue.text || 'Form input missing mobile-friendly type',
    'fixed-width-element': `Fixed-width element: ${issue.details?.actual}`,
  };
  return typeLabels[issue.type] || issue.type;
}

function getIssueTypeLabel(type: string): string {
  const labels: Record<string, string> = {};
  for (const check of MOBILE_CHECK_TYPES) {
    labels[check.type] = check.label;
  }
  return labels[type] || type;
}

// Master list of all 17 mobile check types, sorted alphabetically by label
export const MOBILE_CHECK_TYPES = [
  { type: 'content-width', label: 'Content Width Issues' },
  { type: 'fixed-width-element', label: 'Fixed-Width Elements' },
  { type: 'font-size-error', label: 'Font Size: Too Small' },
  { type: 'font-size-warning', label: 'Font Size: Warning' },
  { type: 'input-missing-type', label: 'Form Inputs Missing Mobile Types' },
  { type: 'horizontal-scroll', label: 'Horizontal Scrolling' },
  { type: 'image-oversized', label: 'Image Sizing/Optimization' },
  { type: 'image-not-responsive', label: 'Images Missing Responsive Sizing' },
  { type: 'image-wider-than-viewport', label: 'Images Wider Than Viewport' },
  { type: 'viewport-blocks-zoom', label: 'Mobile Viewport Settings: Blocks Zoom (Accessibility)' },
  { type: 'viewport-limits-zoom', label: 'Mobile Viewport Settings: Limits Zoom (Accessibility)' },
  { type: 'viewport-improper', label: 'Mobile Viewport Settings: Meta Tag Improper' },
  { type: 'viewport-missing', label: 'Mobile Viewport Settings: Page Not Set Up for Mobile' },
  { type: 'non-mobile-element', label: 'Non-Mobile-Friendly Elements' },
  { type: 'text-overflow', label: 'Text Overflow Issues' },
  { type: 'touch-target-spacing', label: 'Touch Target Spacing' },
  { type: 'touch-target-too-small', label: 'Touch Targets Too Small' },
];

function addBreakOpportunities(text: string): string {
  // Insert zero-width space (Unicode U+200B) after HTML entities to allow line breaks
  return text.replace(/(&[a-zA-Z]+;|&#[0-9]+;)/g, '$1\u200B');
}

export function exportMobileReport(
  data: any,
  issues: any[],
  domain: string,
  filenameBrand: string,
  escapeHtmlFn: (text: string) => string,
  downloadFileFn: (content: string, filename: string, mimeType: string) => void
): void {
  // Get pages analyzed
  const pagesAnalyzed = data.metadata?.pagesAnalyzed || [];

  // Group issues by type
  const issuesByType: Record<string, any[]> = {};
  for (const issue of issues) {
    if (!issuesByType[issue.type]) {
      issuesByType[issue.type] = [];
    }
    issuesByType[issue.type].push(issue);
  }

  // Count errors and warnings
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  // Build TOC - use the master list of all checks
  const allCheckTypes = MOBILE_CHECK_TYPES;

  const hasViewportMissing = (issuesByType['viewport-missing']?.length || 0) > 0;
  const viewportTypes = ['viewport-improper', 'viewport-blocks-zoom', 'viewport-limits-zoom'];

  const tocItems: any[] = [];
  allCheckTypes.forEach(checkType => {
    const issues = issuesByType[checkType.type];
    const count = issues ? issues.length : 0;
    const hasIssues = count > 0;

    let passLabel = '✓ Pass, No Issues Found';
    let labelStyle = 'color: #22c55e; font-weight: bold; margin-left: 8px;';

    if (!hasIssues && hasViewportMissing && viewportTypes.includes(checkType.type)) {
      passLabel = 'N/A (Missing Mobile Setup)';
      labelStyle = 'color: #718096; font-style: italic; margin-left: 8px;';
    }

    tocItems.push({
      id: 'mobile-' + checkType.type,
      label: checkType.label,
      count: count,
      hasIssues: hasIssues,
      passLabel: passLabel,
      labelStyle: labelStyle,
    });
  });

  const cleanDomain = domain.replace(/^www\./, '');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${cleanDomain} Mobile Usability</title>
  <link rel="icon" type="image/png" href="${platformStrings.favicon}">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid #667eea; }
    .header h1 { font-size: 2.7rem; margin: 0 0 10px 0; color: #2d3748; }
    .header p { color: #7180D8; font-size: 1.8rem; margin: 5px 0; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
    .summary-card.errors { border-left: 4px solid #e53e3e; }
    .summary-card.warnings { border-left: 4px solid #ed8936; }
    .summary-card.pages { border-left: 4px solid #667eea; }
    .summary-card.total { border-left: 4px solid #4a5568; }
    .summary-number { font-size: 2.5rem; font-weight: bold; color: #2d3748; }
    .summary-label { font-size: 0.9rem; color: #718096; margin-top: 5px; }
    .toc { background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 40px; border: 2px solid #667eea; }
    .toc h2 { margin-top: 0; color: #667eea; }
    .toc ul { list-style: none; padding-left: 0; }
    .toc li { margin: 10px 0; }
    .toc a { color: #667eea; text-decoration: none; font-weight: 600; }
    .toc a:hover { text-decoration: underline; }
    .toc-count { background: #667eea; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8rem; margin-left: 8px; }
    .section { margin-bottom: 40px; }
    .section-header { background: #667eea; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .section-header h2 { margin: 0; color: white; }
    .section-header a { color: white; text-decoration: none; font-size: 1.5rem; }
    .issue-item { background: #f8f9fa; padding: 15px 20px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #e53e3e; transition: background 0.2s; }
    .issue-item:hover { background: #e2e8f0; }
    .issue-item.warning { border-left-color: #ed8936; }
    .issue-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 10px; }
    .issue-severity { padding: 3px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .issue-severity.error { background: #fed7d7; color: #9b2c2c; }
    .issue-severity.warning { background: #feebc8; color: #c05621; }
    .issue-element { font-weight: 600; color: #2d3748; }
    .issue-text { font-style: italic; color: #4a5568; margin: 8px 0; padding: 10px; background: white; border-radius: 4px; }
    .issue-location { font-size: 0.9rem; color: #718096; }
    .issue-location a { color: #667eea; }
    .issue-details { margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 4px; font-size: 0.9rem; }
    .issue-details strong { color: #856404; }
    .accordion-container { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin: 10px 0; }
    .accordion-header { padding: 15px; background: #edf2f7; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 15px; }
    .accordion-header:hover { background: #e2e8f0; }
    .accordion-icon { font-size: 1.3rem; color: #667eea; transition: transform 0.2s ease; }
    .accordion-count { background: #667eea; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; }
    .accordion-container.open .accordion-icon { transform: rotate(90deg); }
    .accordion-content { display: none; padding: 15px; background: white; }
    .accordion-container.open .accordion-content { display: block; }
    @media print { body { margin: 0; } .container { box-shadow: none; } .accordion-content { display: block !important; } }
  </style>
</head>
<body>
  ${generateReportHeader({
    title: 'Mobile Usability',
    domain: cleanDomain,
    data: data,
    emoji: '📱',
  })}
  <div class="container">
    
    <div class="summary">
      <div class="summary-card total">
        <div class="summary-number">${issues.length}</div>
        <div class="summary-label">Total Issues</div>
      </div>
      <div class="summary-card errors">
        <div class="summary-number">${errorCount}</div>
        <div class="summary-label">Errors</div>
      </div>
      <div class="summary-card warnings">
        <div class="summary-number">${warningCount}</div>
        <div class="summary-label">Warnings</div>
      </div>
      <div class="summary-card pages">
        <div class="summary-number">${pagesAnalyzed.length}</div>
        <div class="summary-label">Pages Analyzed</div>
      </div>
    </div>
    
    ${
      issues.length === 0
        ? `
    <div id="no-issues" style="background: #d4edda; border: 2px solid #28a745; border-radius: 8px; padding: 30px; margin: 30px 0; text-align: center;">
      <h2 style="color: #155724; margin: 0 0 15px 0;">✅ No Mobile Usability Issues Found</h2>
      <p style="color: #155724; font-size: 1.1rem; margin: 0 0 20px 0;">
        All ${pagesAnalyzed.length} analyzed page${
          pagesAnalyzed.length === 1 ? '' : 's'
        } passed mobile usability checks using Google Lighthouse standards.
      </p>
      <div style="background: white; border-radius: 6px; padding: 20px; margin-top: 20px;">
        <h3 style="color: #155724; margin: 0 0 15px 0;">Pages Analyzed:</h3>
        <ul style="list-style: none; padding: 0; text-align: left; max-width: 800px; margin: 0 auto;">
          ${pagesAnalyzed
            .map(
              (page: string) => `
            <li style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #2d3748;">
              ${escapeHtmlFn(page === '/' ? 'Home (/)' : page)}
            </li>
          `
            )
            .join('')}
        </ul>
      </div>
    </div>
    `
        : ''
    }
    
    <div class="toc" id="mobile-toc">
      <h2>📋 Table of Contents</h2>
      <ul>
        ${tocItems
          .map(
            item => `
          <li>
            ${
              item.hasIssues
                ? `<a href="#${item.id}">${item.label}</a>
                 <span class="toc-count">${item.count}</span>`
                : `<span style="color: #718096;">${item.label}</span>
                 <span style="${item.labelStyle}">${item.passLabel}</span>`
            }
          </li>
        `
          )
          .join('')}
      </ul>
      
      <div style="border-top: 1px solid #e2e8f0; margin-top: 20px; padding-top: 15px;">
        <p style="font-size: 0.9rem; color: #4a5568; line-height: 1.6; margin: 0;">
          <strong>📊 Image Sizing/Optimization:</strong> Checks if images are appropriately sized for mobile display. Images should not be more than 3× the display size (accounting for retina/high-DPI screens which need 2× resolution). Serving oversized images wastes bandwidth and slows page load, especially on mobile networks.
        </p>
        <p style="font-size: 0.9rem; color: #4a5568; line-height: 1.6; margin: 10px 0 0 0;">
          <strong>Touch Targets Too Small:</strong> We are using the generally accepted minimum font size for links and body text on mobile sites of 16px. If you want to be more strict or need legal compliance, the WCAG 2.2 AA minimum target is 24 x 24 pixels.
        </p>
         <p style="margin-top: 15px; font-size: 0.85rem; color: black; line-height: 1.4;">

         </p>
      </div>
    </div>
    
    ${allCheckTypes
      .filter(checkType => issuesByType[checkType.type])
      .map(checkType => {
        const type = checkType.type;
        const typeIssues = issuesByType[type];
        const typeLabel = checkType.label;

        // Group by page
        const issuesByPage: Record<string, { url: string; issues: any[] }> = {};
        for (const issue of typeIssues) {
          const pageKey = issue.navigationName || issue.url;
          if (!issuesByPage[pageKey]) {
            issuesByPage[pageKey] = { url: issue.url, issues: [] };
          }
          issuesByPage[pageKey].issues.push(issue);
        }

        return `
        <div class="section" id="mobile-${type}">
          <div class="section-header">
            <h2>📱 ${typeLabel} (${typeIssues.length})</h2>
            <a href="#mobile-toc">⬆️</a>
          </div>
          
          ${Object.keys(issuesByPage)
            .map(pageName => {
              const pageData = issuesByPage[pageName];
              const pageIssues = pageData.issues;

              return `
              <div class="accordion-container">
                <div class="accordion-header">
                  <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <span><strong>${escapeHtmlFn(pageName)}</strong> —
                    <a href="${escapeHtmlFn(
                      pageData.url
                    )}" target="_blank" onclick="event.stopPropagation();">${escapeHtmlFn(
                      pageData.url
                    )}</a></span>
                    <span class="accordion-icon">▶</span>
                    <span class="accordion-count">${pageIssues.length} issue${
                      pageIssues.length === 1 ? '' : 's'
                    }</span>
                  </div>
                </div>
                <div class="accordion-content">
                  ${pageIssues
                    .map(
                      (issue, idx) => `
                    <div class="issue-item ${issue.severity}" style="margin-left: 0;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                          ${
                            (issue.type === 'touch-target-too-small' ||
                              issue.type === 'touch-target-spacing') &&
                            issue.text
                              ? `<span class="issue-element">#${
                                  idx + 1
                                } - Link text: ${escapeHtmlFn(issue.text)}</span>`
                              : `<span class="issue-element">#${idx + 1} - ${issue.element}</span>`
                          }
                          <span class="issue-severity ${issue.severity}">${issue.severity}</span>
                        </div>
                        ${
                          issue.selector
                            ? `
                          <div style="margin-left: 15px;">
                            <a href="${issue.url}#ssa-inspect-selector=${encodeURIComponent(issue.selector)}"
                               target="_blank"
                               class="live-inspect-btn"
                               style="display: inline-block; padding: 8px 12px; background: #667eea; color: white; border-radius: 4px; text-decoration: none; font-size: 0.8rem; font-weight: bold; transition: background 0.2s;"
                               onmouseover="this.style.background='#5a67d8'"
                               onmouseout="this.style.background='#667eea'">
                               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Locate
                            </a>
                          </div>
                        `
                            : ''
                        }
                      </div>

                      ${
                        issue.description
                          ? `<div class="issue-text">${escapeHtmlFn(issue.description)}</div>`
                          : ''
                      }
                      ${
                        issue.details?.href
                          ? `<div class="issue-text">Link URL: <a href="${escapeHtmlFn(
                              issue.details.href
                            )}" target="_blank" style="color: #4a90e2; text-decoration: underline;">${escapeHtmlFn(
                              issue.details.href
                            )}</a></div>`
                          : ''
                      }
                      ${
                        issue.details?.src
                          ? `<div class="issue-location">
                             <strong>Image:</strong> <a href="${escapeHtmlFn(
                               issue.details.src
                             )}" target="_blank">${escapeHtmlFn(issue.details.src)}</a>
                           </div>`
                          : issue.details?.imageUrl
                            ? `<div class="issue-location">
                               <strong>Image:</strong> <a href="${escapeHtmlFn(
                                 issue.details.imageUrl
                               )}" target="_blank">${escapeHtmlFn(issue.details.imageUrl)}</a>
                             </div>`
                            : ''
                      }
                      <div class="issue-location">
                        <strong>Section:</strong> ${escapeHtmlFn(
                          issue.section
                        )} | <strong>Block:</strong> ${escapeHtmlFn(issue.block)}
                      </div>
                      ${
                        issue.type === 'image-oversized'
                          ? `<div class="issue-details">
                             <strong>Display Size:</strong> ${escapeHtmlFn(
                               issue.details?.displaySize || 'N/A'
                             )}<br>
                             <strong>Actual Image Size:</strong> ${escapeHtmlFn(
                               issue.details?.naturalSize || 'N/A'
                             )}<br>
                             <strong>Ratio:</strong> ${escapeHtmlFn(
                               issue.details?.ratio || 'N/A'
                             )}<br>
                             <strong>Wasted Pixels:</strong> ${escapeHtmlFn(
                               issue.details?.wastedPixels || 'N/A'
                             )}
                           </div>`
                          : `<div class="issue-details">
                             <strong>Actual:</strong> ${escapeHtmlFn(
                               issue.details?.actual || 'N/A'
                             )}<br>
                             <strong>${
                               issue.details?.recommended ? 'Recommended' : 'Required'
                             }:</strong> ${addBreakOpportunities(
                               escapeHtmlFn(
                                 issue.details?.recommended || issue.details?.required || 'N/A'
                               )
                             )}
                           </div>`
                      }
                    </div>
                  `
                    )
                    .join('')}
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      `;
      })
      .join('')}
    
    <div style="text-align: center; margin-top: 40px; padding: 20px;">
      <a href="#mobile-toc" style="color: #667eea; text-decoration: none; font-size: 2rem;">⬆️</a>
    </div>
  </div>


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
</body>
</html>`;

  const filename = `${cleanDomain}-${filenameBrand}-mobile-usability-report.html`;
  downloadFileFn(filename, html, 'text/html');
}
