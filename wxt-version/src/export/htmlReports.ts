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
  const filename = `${brand}-${platformStrings.filenameVariable}-quality-check-${checkType}-${timestamp}.html`;

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
 * Generate the Quality Checks Scorecard HTML
 */
function generateQualityScorecard(score: number, checks: QualityCheckResult['checks']): string {
  let scoreColor = '#48bb78'; // Green
  if (score < 50)
    scoreColor = '#e53e3e'; // Red
  else if (score < 80) scoreColor = '#ecc94b'; // Yellow

  let html = `
    <div style="background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 40px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #edf2f7; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #2d3748; font-size: 1.8rem;">✅ Quality Checks</h2>
        <div style="text-align: right;">
          <div style="font-size: 3rem; font-weight: bold; color: ${scoreColor}; line-height: 1;">${score}%</div>
          <div style="color: #718096; font-size: 0.9rem; margin-top: 5px;">OVERALL SCORE</div>
        </div>
      </div>
      
      <div style="display: grid; gap: 15px;">
  `;

  for (const check of checks) {
    const icon = check.passed ? '✅' : '❌';
    const bg = check.passed ? '#f0fff4' : '#fff5f5';
    const border = check.passed ? '#c6f6d5' : '#fed7d7';

    html += `
      <div style="background: ${bg}; border: 1px solid ${border}; border-radius: 6px; padding: 15px;">
        <div style="display: flex; align-items: flex-start;">
          <div style="font-size: 1.2rem; margin-right: 15px; margin-top: 2px;">${icon}</div>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #2d3748; margin-bottom: ${
              check.details.length > 0 ? '10px' : '0'
            };">
              ${check.message}
            </div>
            
            ${
              check.details.length > 0
                ? `<div style="font-size: 0.9rem; color: #4a5568; background: rgba(255,255,255,0.5); padding: 10px; border-radius: 4px;">
                    <ul style="margin: 0; padding-left: 20px;">
                      ${check.details
                        .map(
                          detail => `
                        <li style="margin-bottom: 4px;">
                          ${
                            detail.url
                              ? `<a href="${detail.url}" target="_blank" style="color: #667eea; text-decoration: underline;">${
                                  detail.page || 'Link'
                                }</a>: `
                              : ''
                          }
                          ${detail.description}
                        </li>
                      `
                        )
                        .join('')}
                    </ul>
                  </div>`
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  html += `
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
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f7fafc; }
          .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 60px 0; margin-bottom: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header-content { max-width: 1200px; margin: 0 auto; padding: 0 20px; text-align: center; }
          h1 { margin: 0; font-size: 2.5rem; font-weight: 800; letter-spacing: -1px; }
          .subtitle { opacity: 0.9; font-size: 1.1rem; margin-top: 10px; }
          
          /* Accordion Styles */
          .accordion-container { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background: white; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
          .accordion-header { background: white; padding: 15px; cursor: pointer; transition: background 0.2s; user-select: none; }
          .accordion-header:hover { background: #f8f9fa; }
          .accordion-title { display: flex; align-items: center; justify-content: space-between; font-weight: 600; color: #2d3748; }
          .accordion-label { display: flex; align-items: center; }
          .accordion-icon { transition: transform 0.2s ease; margin-left: 10px; color: #a0aec0; font-size: 0.8rem; }
          .accordion-count { background: #edf2f7; color: #718096; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; margin-left: 10px; }
          .accordion-content { display: none; padding: 15px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
          .accordion-container.active .accordion-icon { transform: rotate(90deg); }
          .accordion-container.active .accordion-content { display: block; }

          .accordion-item { padding: 10px; border-bottom: 1px solid #edf2f7; }
          .accordion-item:last-child { border-bottom: none; }
          .accordion-item-number { color: #cbd5e0; font-weight: bold; font-size: 0.9rem; min-width: 30px; }
          
          footer { text-align: center; color: #718096; font-size: 0.9rem; padding: 40px 0; margin-top: 60px; border-top: 1px solid #edf2f7; }
          
          @media print {
            .accordion-content { display: block !important; }
            .accordion-icon { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-content">
            <h1>${brand} - ${platformStrings.reportTitle}</h1>
            <div class="subtitle">Generated on ${date} • ${cleanDomain}</div>
          </div>
        </div>

        <div class="container">
          <!-- Quality Scorecard -->
          ${generateQualityScorecard(score, checks)}

          <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 40px;">
            <h2 style="margin-top: 0; color: #2d3748; font-size: 1.8rem; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #edf2f7;">📊 Aggregated Styles Report</h2>
            
            ${aggregatedToc}
            
            ${aggregatedStylesHtml}
          </div>

          <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="margin-top: 0; color: #2d3748; font-size: 1.8rem; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #edf2f7;">📄 Page-by-Page Breakdown</h2>
            
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
          });
        </script>
      </body>
      </html>
    `;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadFile(
      `${brand}-${platformStrings.filenameVariable}-full-analysis-${timestamp}.html`,
      fullHtml,
      'text/html'
    );
  } catch (error) {
    console.error('Error generating analysis report:', error);
    alert('Failed to generate analysis report. See console for details.');
  }
}
