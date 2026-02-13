// templates/sections/colorFamilies.ts - Color families and variations

import type { ColorAnalysis, ColorData } from '../../types';
import { generateSectionHeader, generateInstanceDrawer, generateMergedBadge } from '../components';

let familyDrawerCounter = 0;

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
          <div class="color-swatch-grid">
            ${group.variations
              .map(color => {
                const colorData = colors[color];
                if (!colorData) return '';
                const drawerId = `drawer-family-${familyDrawerCounter++}`;
                const mergedBadge = generateMergedBadge(colorData, color);
                const drawerHtml = generateInstanceDrawer(colorData.instances, drawerId, color);
                return `
              <div class="color-swatch" data-drawer-id="${drawerId}" onclick="toggleInstanceDrawer(this, '${drawerId}')">
                <div class="swatch" style="background-color: ${color};"></div>
                <div class="swatch-label">${color}</div>
                <div class="swatch-count">${colorData.count} uses${color === group.mainColor ? ' (most used)' : ''}</div>
                ${mergedBadge}
              </div>
              ${drawerHtml}
            `;
              })
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

  let neutralDrawerCounter = 0;

  return `
    ${generateSectionHeader('neutrals-section', `Neutral Colors (${analysis.grays.length} neutrals found)`, '⚪', getNextSection('neutrals-section'))}
    <div class="section">
      <div class="color-category-section">
        <div class="color-swatch-grid">
          ${analysis.grays
            .map(color => {
              const colorData = colors[color];
              if (!colorData) return '';
              const drawerId = `drawer-neutral-${neutralDrawerCounter++}`;
              const mergedBadge = generateMergedBadge(colorData, color);
              const drawerHtml = generateInstanceDrawer(colorData.instances, drawerId, color);
              return `
            <div class="color-swatch" data-drawer-id="${drawerId}" onclick="toggleInstanceDrawer(this, '${drawerId}')">
              <div class="swatch" style="background-color: ${color};"></div>
              <div class="swatch-label">${color}</div>
              <div class="swatch-count">${colorData.count} uses</div>
              ${mergedBadge}
            </div>
            ${drawerHtml}
          `;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;
}
