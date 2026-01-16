// templates/sections/colorFamilies.ts - Color families and variations

import type { ColorAnalysis, ColorData } from '../../types';
import { generateSectionHeader } from '../components';

export function buildColorFamiliesSection(
  analysis: ColorAnalysis,
  colors: Record<string, ColorData>,
  getNextSection: (id: string) => string | null
): string {
  if (analysis.colorGroups.length === 0) return '';

  return `
    ${generateSectionHeader('families-section', 'Color Families & Variations', '👨‍👩‍👧‍👦', getNextSection('families-section'))}
    <div class="section">
      <p style="color: #718096; margin-bottom: 20px;">Similar colors grouped together. Consider consolidating variations within each family.</p>
      ${analysis.colorGroups
        .map(
          group => `
        <div class="color-group">
          <h3>Color Family - ${group.variations.length} variations (${group.totalInstances} total uses)</h3>
          <div class="color-variations">
            ${group.variations
              .map(
                color => `
              <div class="variation-item ${color === group.mainColor ? 'main-color' : ''}">
                <div class="variation-swatch" style="background-color: ${color};"></div>
                <div class="variation-info">
                  <div class="variation-hex">${color}</div>
                  <div class="variation-count">${colors[color].count} uses${color === group.mainColor ? ' (most used)' : ''}</div>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

export function buildNeutralsSection(
  analysis: ColorAnalysis,
  colors: Record<string, ColorData>,
  getNextSection: (id: string) => string | null
): string {
  if (analysis.grays.length === 0) return '';

  return `
    ${generateSectionHeader('neutrals-section', `Neutral Colors (${analysis.grays.length} neutrals found)`, '⚪', getNextSection('neutrals-section'))}
    <div class="section">
      <div class="color-swatch-grid">
        ${analysis.grays
          .map(
            color => `
          <div class="color-swatch">
            <div class="swatch" style="background-color: ${color};"></div>
            <div class="swatch-label">${color}</div>
            <div class="swatch-count">${colors[color].count} uses</div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}
