// templates/sections/outliers.ts - Outlier colors section

import type { ColorAnalysis, ColorData } from '../../types';
import { generateSectionHeader, generateInstanceCard } from '../components';

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
            const colorData = colors[color];
            if (!colorData) return '';
            const instances = colorData.instances;

            // IMPORTANT: Show ALL instances with complete 9-field card format.
            // No drawer for outliers — inline display using instance cards directly.
            const instanceCardsHtml = instances
              .map(inst => generateInstanceCard(inst, color))
              .join('');

            return `
            <div class="outlier-item">
              <div class="outlier-header">
                <div class="outlier-swatch" style="background-color: ${color};"></div>
                <div class="outlier-info">
                  <div class="outlier-hex">${color}</div>
                  <div class="variation-count">${colorData.count} use${colorData.count > 1 ? 's' : ''}</div>
                </div>
              </div>
              <div style="margin-top: 10px;">
                ${instanceCardsHtml}
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    </div>
  `;
}
