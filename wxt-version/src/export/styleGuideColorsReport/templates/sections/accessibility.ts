// templates/sections/accessibility.ts - Accessibility/contrast section

import type { ColorAnalysis } from '../../types';
import { generateSectionHeader } from '../components';

export function buildAccessibilitySection(
  analysis: ColorAnalysis,
  getNextSection: (id: string) => string | null
): string {
  if (analysis.contrastFailures.length === 0) {
    return `
      ${generateSectionHeader('accessibility-section', 'Accessibility Status', '♿', getNextSection('accessibility-section'))}
      <div class="section">
        <div style="background: #c6f6d5; padding: 20px; border-radius: 8px; color: #22543d;">
          <strong>Excellent!</strong> All text and background color combinations pass WCAG contrast requirements.
        </div>
      </div>
    `;
  }

  return `
    ${generateSectionHeader('accessibility-section', `Accessibility Issues for Text Contrast (${analysis.contrastFailures.length} WCAG contrast failures)`, '♿', getNextSection('accessibility-section'))}
    <p style="margin: 15px 0; font-size: 0.85rem; color: black; line-height: 1.4;">
       <strong>💡 NOTE:</strong> To properly use the Locate link, the item will be identified with a red outline as soon as it appears on the page. For the most accurate placement, it is recommended to let the page finish loading.
    </p>
    <div class="section">
      <div style="background: #f0f4f8; border-left: 4px solid #4a90e2; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
        <p style="color: #1a202c; margin: 0; font-size: 0.95rem; line-height: 1.6;">
          These are text and background combinations that fail WCAG accessibility standards. Due to website design complexities, it is not always possible to detect contrast errors when gradients, filters, or background transparency are present. To test specific colors manually, you can use this
          <a href="javascript:void(0)" onclick="showContrastChecker(); return false;" style="color: #4a90e2; text-decoration: underline; font-weight: 600;">
            Contrast Checker Tool
          </a>
          to find colors with higher contrast that meet WCAG guidelines.
        </p>
      </div>
      <div class="accordion-container">
        <div class="accordion-header" onclick="this.parentElement.classList.toggle('open');">
          <div class="accordion-title">
            <span class="accordion-icon">▶</span>
            <span class="accordion-count">${analysis.contrastFailures.length} issues</span>
          </div>
        </div>
        <div class="accordion-content">
      ${analysis.contrastFailures
        .map(
          failure => `
        <div class="contrast-issue">
          <div class="contrast-header">
            <div class="contrast-colors">
              <div class="contrast-swatch" style="background-color: ${failure.textColor};" title="Text color"></div>
              <div class="contrast-swatch" style="background-color: ${failure.backgroundColor};" title="Background color"></div>
            </div>
            <div class="contrast-info">
              <div class="contrast-ratio">Ratio: ${failure.ratio}:1 (${failure.wcagLevel})</div>
              <div>Text: ${failure.textColor} on Background: ${failure.backgroundColor}</div>
              ${
                failure.elementText && failure.elementText !== 'Unknown'
                  ? `
              <div style="margin-top: 8px; padding: 8px; background: #f7fafc; border-radius: 4px;">
                <strong>Element Text:</strong> "${failure.elementText}"
              </div>
              `
                  : ''
              }
            </div>
            ${
              failure.selector
                ? `
            <div class="contrast-inspect">
              <a href="${failure.page}${failure.page.includes('?') ? '&' : '?'}ssa-inspect-selector=${encodeURIComponent(failure.selector)}" 
                 target="_blank" 
                 style="display: inline-flex; align-items: center; padding: 8px 16px; background: #667eea; color: white; border-radius: 6px; text-decoration: none; font-size: 0.85rem; font-weight: bold; transition: all 0.2s; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.25);"
                 onmouseover="this.style.background='#5a67d8'; this.style.transform='translateY(-1px)';"
                 onmouseout="this.style.background='#667eea'; this.style.transform='translateY(0)';">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                 Locate
              </a>
            </div>
            `
                : ''
            }
          </div>
          <div class="contrast-location">
            <strong>Location:</strong> ${failure.location}<br>
            <strong>Page:</strong> <a href="${failure.page}" target="_blank" style="color: #667eea; text-decoration: underline;">${failure.page}</a><br>
            <strong>Section:</strong> ${failure.section}<br>
            <strong>Block:</strong> ${failure.block}<br>
            <strong>Element:</strong> ${failure.element}
          </div>
        </div>
      `
        )
        .join('')}
        </div>
      </div>
    </div>
  `;
}
