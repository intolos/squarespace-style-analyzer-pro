// export/htmlReports.ts
// Main Orchestrator for HTML Reports ("Analysis Report")

import type { ReportData } from './types';
import { generateAggregatedStylesReport, generateAggregatedTOC } from './aggregatedStylesReport';
import { generatePageByPageReport, generatePageByPageTOC } from './pageByPageReport';
import { calculateQualityChecks, type QualityCheckResult } from './qualityChecks';
import { downloadFile, escapeHtml } from './utils';
import { platformStrings } from '../utils/platform';

/**
 * Generate and download a specialized quality check report (e.g., broken heading hierarchy)
 */
export function exportQualityCheckReport(
  data: ReportData,
  checkType: string,
  issues: any[],
  domain: string,
  brand: string
): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${domain}-${platformStrings.filenameVariable}-quality-check-${checkType}-${timestamp}.html`;

  let title = 'Quality Check Detail';
  let issueHtml = '';

  if (checkType === 'brokenHeadingHierarchy') {
    title = 'Broken Heading Hierarchy Report';
    issueHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background: #f8f9fa;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Page</th>
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Issue</th>
          </tr>
        </thead>
        <tbody>
          ${issues
            .map(
              issue => `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #eee;">
                <a href="${issue.url}" target="_blank" style="color: #667eea;">${
                  issue.page || issue.url
                }</a>
              </td>
              <td style="padding: 12px; border-bottom: 1px solid #eee;">
                ${escapeHtml(issue.description || issue.issue || 'Hierarchy issue')}
              </td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${brand} - ${title}</title>
      <link rel="icon" type="image/png" href="${platformStrings.favicon}">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1 { color: #2d3748; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; font-weight: bold; }
        .error { background: #fed7d7; color: #c53030; }
      </style>
    </head>
    <body>
      <h1>${brand} - ${title}</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
      <p>Domain: <a href="https://${domain}" target="_blank">${domain}</a></p>
      ${issueHtml}
    </body>
    </html>
  `;

  downloadFile(filename, html, 'text/html');
}

/**
 * Generate the Quality Checks Scorecard HTML (Legacy Design)
 */
function generateQualityScorecard(score: number, checks: QualityCheckResult['checks']): string {
  // Determine color based on score (Legacy logic)
  const scoreColor = score === 100 ? '#48bb78' : score >= 80 ? '#ed8936' : '#e53e3e';

  let html = `
    <div style="background: white; border-radius: 12px; padding: 30px; margin-bottom: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;">
      <h2 style="margin: 0 0 30px 0; color: #2d3748; font-size: 2rem;">Quality Score</h2>
      
      <div style="width: 150px; height: 150px; border-radius: 50%; background: ${scoreColor}; color: white; display: flex; align-items: center; justify-content: center; font-size: 3rem; font-weight: bold; margin: 0 auto 30px;">
        ${score}%
      </div>

      <div style="text-align: left; max-width: 600px; margin: 0 auto;">
  `;

  for (const check of checks) {
    const statusClass = check.passed ? 'pass' : 'fail';
    const bg = check.passed ? '#c6f6d5' : '#fed7d7';
    const color = check.passed ? '#22543d' : '#9b2c2c';
    const icon = check.passed ? '✔' : '✗';

    html += `
      <div style="padding: 15px 20px; margin: 10px 0; border-radius: 8px; font-size: 1rem; background: ${bg}; color: ${color};">
        <span style="margin-right: 10px; font-weight: bold;">${icon}</span>
        ${check.message}
        
        ${
          check.details && check.details.length > 0
            ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.1); font-size: 0.9rem;">
                ${check.details
                  .map(
                    detail => `
                  <div style="padding: 6px 0;">
                    ${
                      detail.page && detail.page !== 'All Pages' && detail.url
                        ? `<a href="${detail.url}" target="_blank" style="color: #667eea; text-decoration: none; font-weight: 600;">${detail.page}</a> - `
                        : ''
                    }
                    ${detail.description}
                  </div>
                `
                  )
                  .join('')}
               </div>`
            : ''
        }
      </div>
    `;
  }

  html += `
      </div>
      <br />
      <div style="background: #667EEA; padding: 15px; margin-bottom: 20px; border-radius: 8px; color: white; text-align: left;">
        <div id="note-text" class="note-truncated" style="font-size: 0.9rem; line-height: 1.5; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">
          NOTE: The purpose of our Design Audit reports is to reveal the “issues” about your website so you can decide if they are valid by design or if they are oversights. At times, there may be reasons for visual content outside “typical” styling. And at other times, visual content may simply not be adhering to your own standards or multiple people may not be acting in synchronization. We also want you to know that it is much easier to architect and create website code than to audit and analyze it afterwards. This is due to deciphering the wide variety of disparate coding styles, the inherent complexity of tracing deep nesting layers, navigating the intricate web of parent-child dependencies that evolve over time, and more. Our coding in this extension includes numerous situations to catch all possibilities for the aspects being analyzed. Although it may not be absolutely perfect in all situations it will be extremely close and a huge guide for your understanding.
        </div>
        <button id="note-toggle" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white; padding: 4px 12px; border-radius: 4px; font-size: 0.8rem; margin-top: 10px; cursor: pointer; font-weight: 600;">Read More</button>
      </div>
    </div>
  `;

  return html;
}

/**
 * Generate and download the full Analysis Report (HTML)
 */
export function exportAnalysisReport(data: ReportData): void {
  try {
    const domain = data.metadata.domain;
    const cleanDomain = domain.replace(/^www\./, '');
    const brand =
      cleanDomain.split('.')[0].charAt(0).toUpperCase() + cleanDomain.split('.')[0].slice(1);
    const date = new Date().toLocaleDateString();

    // Calculate quality checks using the separate module
    const { score, checks } = calculateQualityChecks(data, brand, exportQualityCheckReport);

    // Generate Aggregated Styles Report content
    const aggregatedStylesHtml = generateAggregatedStylesReport(data, escapeHtml);
    const aggregatedToc = generateAggregatedTOC(data);

    // Generate Page-by-Page Report content
    const pageByPageHtml = generatePageByPageReport(data, escapeHtml);
    const pageByPageToc = generatePageByPageTOC(data, escapeHtml);

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${brand} - ${platformStrings.reportTitle}</title>
        <link rel="icon" type="image/png" href="${platformStrings.favicon}">
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f7fafc; }
          .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
          /* Updated Header to match Images Report */
          .header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 3px solid #667eea; background: transparent; color: #333; box-shadow: none; }
          .header h1 { font-size: 2.7rem; margin: 0 0 10px 0; color: #2d3748; letter-spacing: normal; font-weight: bold; }
          .header p { color: #7180D8; font-size: 1.8rem; margin: 5px 0; }
          
          /* Reports Nav Block */
          .reports-nav { background: linear-gradient(135deg, #5562D8 0%, #764ba2 100%); padding: 25px; border-radius: 12px; margin-bottom: 40px; text-align: center; }
          .reports-nav h3 { color: white; margin: 0 0 25px 0; font-size: 1.8rem; font-weight: 800; }
          .reports-nav-links { display: flex; flex-direction: column; gap: 12px; }
          .reports-nav-link { font-size: 1.3rem; background: rgba(255,255,255,0.10); padding: 15px 20px; border-radius: 8px; text-decoration: none; color: white; font-weight: 600; transition: all 0.2s ease; display: block; text-align: left; }
          .reports-nav-link:hover { transform: translateX(5px); }
          .reports-nav-link span { display: block; font-size: 1.1rem; font-weight: normal; opacity: 0.9; margin-top: 4px; }

          /* Report Titles */
          .report-title { text-align: center; margin: 60px 0 40px 0; }
          .report-title h2 { font-size: 2.2rem; color: #667eea; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px; }
          .report-title h3 { font-size: 2.2rem; color: #667eea; margin: 0; font-weight: 700; letter-spacing: 2px; }
          .report-divider { margin: 80px 0; text-align: center; position: relative; }
          .report-divider::before { content: ''; position: absolute; top: 50%; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, transparent, #667eea, #764ba2, #667eea, transparent); }
          .report-divider-icon { background: #f7fafc; padding: 0 30px; position: relative; font-size: 2.5rem; color: #667eea; }

          /* Metadata */
          .metadata { background: #e9ecef; padding: 25px; border-radius: 8px; margin-bottom: 40px; }
          .metadata h2 { margin-top: 0; color: #2d3748; }
          .metadata-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 20px; }
          .metadata-item { background: white; padding: 15px; border-radius: 6px; }
          .metadata-label { font-weight: 600; color: #4a5568; margin-bottom: 5px; }
          .metadata-value { color: #2d3748; }

          /* Accordion Styles */
          .accordion-container { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background: white; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
          .accordion-header { background: white; padding: 15px; cursor: pointer; transition: background 0.2s; user-select: none; }
          .accordion-header:hover { background: #f8f9fa; }
          .accordion-title { display: flex; align-items: center; justify-content: flex-start; gap: 15px; font-weight: 600; color: #2d3748; }
          .accordion-label { display: flex; align-items: center; }
          .accordion-icon { transition: transform 0.2s ease; margin-left: 10px; color: #a0aec0; font-size: 0.8rem; }
          .accordion-count { background: #edf2f7; color: #718096; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; margin-left: 10px; }
          .accordion-content { display: none; padding: 15px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
          .accordion-container.active .accordion-icon { transform: rotate(90deg); }
          .accordion-container.active .accordion-content { display: block; }

          .accordion-item { padding: 10px; border-bottom: 1px solid #edf2f7; }
          .accordion-item:last-child { border-bottom: none; }
          .accordion-item-number { color: #cbd5e0; font-weight: bold; font-size: 0.9rem; min-width: 30px; }
          
          .note-expanded { -webkit-line-clamp: unset !important; display: block !important; }
          
          footer { text-align: center; color: #718096; font-size: 0.9rem; padding: 40px 0; margin-top: 60px; border-top: 1px solid #edf2f7; }
          
          @media print {
            .accordion-content { display: block !important; }
            .accordion-icon { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔬 ${domain} Website Analysis</h1>
          <p>Professional Design Audit by ${platformStrings.productName}</p>
          <p><span style="font-size: 1.2rem;">Generated on ${new Date().toLocaleString()}</span></p>
        </div>

        <div class="container">
          <!-- Quality Scorecard -->
          ${generateQualityScorecard(score, checks)}

          <div class="metadata">
            <h2>📋 Analysis Summary</h2>
            <div style="margin-top: 20px;">
              <div class="metadata-label">Pages Analyzed:</div>
              <div class="metadata-value">${data.metadata.pagesAnalyzed ? data.metadata.pagesAnalyzed.join(', ') : 'Current Page'}</div>
            </div>
            ${
              data.failedPages && data.failedPages.length > 0
                ? `
            <div style="margin-top: 20px;">
              <div class="metadata-label" style="font-weight: bold; color: #e53e3e;">Pages Not Analyzed:</div>
              <div class="metadata-value" style="font-size: 0.9em; margin-bottom: 8px;">
                <strong>These pages were taking longer than 120 seconds to load so we stopped and moved on. Our analysis process is different than page load times.</strong>
              </div>
              <div class="metadata-value">
                ${data.failedPages
                  .map(
                    fp =>
                      `<div style="margin-bottom: 4px;"><a href="${fp.url}" target="_blank" style="color: #c53030;">${fp.url}</a></div>`
                  )
                  .join('')}
              </div>
            </div>`
                : ''
            }
          </div>

          <!-- Reports Navigation -->
          <div id="reports-nav" class="reports-nav">
            <h3>📊 Typography Style Consistency Reports</h3>
            <div class="reports-nav-links">
              <a href="#aggregated-report" class="reports-nav-link">
                📈 Typography Styles Consistency Audit — Organized by Styles, Aggregated for All Pages
                <span>Compare style variations across your entire site</span>
              </a>
              <a href="#page-report-start" class="reports-nav-link">
                📄 Typography Styles Consistency Audit — Organized by Styles Shown on Each Page
                <span>View styles page-by-page with detailed locations</span>
              </a>
            </div>
          </div>

          <!-- REPORT 1: Aggregated by Styles -->
          <div id="aggregated-report" class="report-title">
            <h2>✨ Typography Styles Consistency Audit ✨</h2>
            <h3>Organized by Styles — Aggregated for All Pages</h3>
          </div>
          
          <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 40px;">
            ${aggregatedToc}
            ${aggregatedStylesHtml}
          </div>

          <!-- DIVIDER -->
          <div class="report-divider">
            <span class="report-divider-icon">◆ ◆ ◆</span>
          </div>

          <!-- REPORT 2: Page by Page -->
          <div id="page-report-start" class="report-title">
             <h2>✨ Typography Styles Consistency Audit ✨</h2>
             <h3>Organized by Styles Shown on Each Page</h3>
          </div>

          <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            ${pageByPageToc}
            ${pageByPageHtml}
          </div>
        </div>

        <footer>
          Generated by ${platformStrings.productName}
        </footer>

        <script>
          // Accordion functionality
          document.addEventListener('DOMContentLoaded', function() {
            const accordions = document.querySelectorAll('.accordion-header');
            accordions.forEach(header => {
              header.addEventListener('click', function() {
                const container = this.parentElement;
                container.classList.toggle('active');
              });
            });

            // NOTE section toggle logic
            const noteToggle = document.getElementById('note-toggle');
            const noteText = document.getElementById('note-text');
            if (noteToggle && noteText) {
              noteToggle.addEventListener('click', function() {
                const isExpanded = noteText.classList.toggle('note-expanded');
                noteToggle.textContent = isExpanded ? 'Read Less' : 'Read More';
              });
            }
          });
        </script>
      </body>
      </html>
    `;

    downloadFile(
      `${data.metadata.domain.replace(/^www\./, '')}-${platformStrings.filenameVariable}-website-analysis-report.html`,
      fullHtml,
      'text/html'
    );
  } catch (error) {
    console.error('Error generating analysis report:', error);
    alert('Failed to generate analysis report. See console for details.');
  }
}
