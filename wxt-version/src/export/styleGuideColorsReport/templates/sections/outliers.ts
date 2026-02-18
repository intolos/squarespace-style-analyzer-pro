// templates/sections/outliers.ts - Outlier colors section

import type { ColorAnalysis, ColorData } from '../../types';
import { generateSectionHeader, generateInstanceCard } from '../components';

/**
 * Deduplicate instances by keeping only the most specific element.
 * When nested DIVs have the same color in the same section/block,
 * only show one instance (the innermost element).
 */
function deduplicateInstances(instances: ColorData['instances']): ColorData['instances'] {
  if (instances.length <= 1) return instances;

  const seen = new Set<string>();
  const result: ColorData['instances'] = [];

  for (const inst of instances) {
    // Create a unique key based on section + block + property
    // This catches nested elements in the same location
    const key = `${inst.section || ''}|||${inst.block || ''}|||${inst.property || ''}|||${inst.element || ''}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      result.push(inst);
    }
  }

  return result;
}

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
            
            // Deduplicate instances to remove nested element duplicates
            const uniqueInstances = deduplicateInstances(colorData.instances);

            // IMPORTANT: Show ALL instances with complete 9-field card format.
            // No drawer for outliers — inline display using instance cards directly.
            const instanceCardsHtml = uniqueInstances
              .map(inst => generateInstanceCard(inst, color))
              .join('');

            return `
            <div class="outlier-item">
              <div class="outlier-header">
                <div class="outlier-swatch" style="background-color: ${color};"></div>
                <div class="outlier-info">
                  <div class="outlier-hex">${color}</div>
                  <div class="variation-count">${uniqueInstances.length} use${uniqueInstances.length > 1 ? 's' : ''}</div>
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
