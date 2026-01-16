// templates/sections/outliers.ts - Outlier colors section

import type { ColorAnalysis, ColorData } from '../../types';
import { generateSectionHeader } from '../components';

export function buildOutliersSection(
  analysis: ColorAnalysis,
  colors: Record<string, ColorData>,
  getNextSection: (id: string) => string | null
): string {
  if (analysis.outliers.length === 0) return '';

  return `
    ${generateSectionHeader('outliers-section', `Outlier Colors (${analysis.outliers.length} found)`, '🚨', getNextSection('outliers-section'))}
    <div class="section">
      <p style="color: #718096; margin-bottom: 20px;">Colors used only 1-2 times. These may be accidental or inconsistent with your brand.</p>
      <div class="outlier-grid">
        ${analysis.outliers
          .map(color => {
            const instances = colors[color].instances;
            const firstInstance = instances[0];
            return `
            <div class="outlier-item">
              <div class="outlier-header">
                <div class="outlier-swatch" style="background-color: ${color};"></div>
                <div class="outlier-info">
                  <div class="outlier-hex">${color}</div>
                  <div class="variation-count">${colors[color].count} use${colors[color].count > 1 ? 's' : ''}</div>
                </div>
                ${
                  firstInstance.selector
                    ? `
                  <div style="margin-left: auto;">
                    <a href="${firstInstance.page}${firstInstance.page.includes('?') ? '&' : '?'}ssa-inspect-selector=${encodeURIComponent(firstInstance.selector)}" 
                       target="_blank" 
                       style="display: inline-block; padding: 6px 10px; background: #667eea; color: white; border-radius: 4px; text-decoration: none; font-size: 0.8rem; font-weight: bold;">
                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Locate
                    </a>
                  </div>`
                    : ''
                }
              </div>
              <div class="outlier-location">
                <strong>Page:</strong>
                <a href="${firstInstance.page}" target="_blank" style="color: #667eea; text-decoration: underline;">
                  ${firstInstance.page}
                </a><br>
                <strong>Element:</strong> ${firstInstance.context}<br>
                <strong>Section:</strong> ${firstInstance.section}<br>
                <strong>Block:</strong> ${firstInstance.block}<br>
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    </div>
  `;
}
