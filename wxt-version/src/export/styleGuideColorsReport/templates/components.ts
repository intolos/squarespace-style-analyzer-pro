// templates/components.ts - Reusable HTML components

import { platformStrings } from '../../../utils/platform';
import type { ColorAnalysis, ColorData, DevToolsColorSummary } from '../types';

/**
 * Generate section header with navigation arrows
 */
export function generateSectionHeader(
  id: string,
  title: string,
  emoji: string,
  nextSectionId: string | null = null
): string {
  const arrows = nextSectionId
    ? `<div>
          <a href="#toc" style="color: white; text-decoration: none; font-size: 1.5rem; margin-right: 15px;">⬆️</a>
          <a href="#${nextSectionId}" style="color: white; text-decoration: none; font-size: 1.5rem;">⬇️</a>
        </div>`
    : `<a href="#toc" style="color: white; text-decoration: none; font-size: 1.5rem;">⬆️</a>`;

  return `
      <div id="${id}" style="background: #667eea; color: white; padding: 20px; border-radius: 8px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="margin: 0; color: white; border: none; padding: 0;">${emoji} ${title}</h2>
        ${arrows}
      </div>
    `;
}

/**
 * Generate table of contents
 */
export function generateTableOfContents(analysis: ColorAnalysis, totalColors: number): string {
  const tocItems: Array<{ id: string; label: string }> = [];

  if (analysis.issues.length > 0) {
    tocItems.push({ id: 'issues-section', label: '🔴 Issues Detected' });
  }

  if (analysis.warnings.length > 0) {
    tocItems.push({ id: 'warnings-section', label: '⚠️ Warnings' });
  }

  tocItems.push({
    id: 'all-colors-section',
    label: `🎨 All Colors Used (${totalColors})`,
  });

  if (analysis.colorGroups.length > 0) {
    tocItems.push({ id: 'families-section', label: '👨‍👩‍👧‍👦 Color Families & Variations' });
  }

  if (analysis.grays.length > 0) {
    tocItems.push({
      id: 'neutrals-section',
      label: `⚪ Neutral Colors (${analysis.grays.length})`,
    });
  }

  if (analysis.outliers.length > 0) {
    tocItems.push({
      id: 'outliers-section',
      label: `🚨 Outlier Colors (${analysis.outliers.length})`,
    });
  }

  tocItems.push({
    id: 'accessibility-section',
    label:
      analysis.contrastFailures.length > 0
        ? `♿ Accessibility Issues for Text Contrast (${analysis.contrastFailures.length})`
        : '♿ Accessibility Status',
  });

  tocItems.push({ id: 'distribution-section', label: '🌈 Color Distribution Across Pages' });

  return `
      <div id="toc" style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 40px; border: 2px solid #667eea;">
        <h2 style="margin-top: 0; color: #667eea;">📋 Table of Contents</h2>
        <ul style="list-style: none; padding-left: 0;">
          ${tocItems
            .map(
              item => `
            <li style="margin: 10px 0;">
              <a href="#${item.id}" style="color: #667eea; text-decoration: none; font-weight: bold;">${item.label}</a>
            </li>
          `
            )
            .join('')}
        </ul>
      </div>
    `;
}

/**
 * Generate color swatch table using DevTools CSS Overview format
 */
export function generateColorSwatchTable(
  colors: Record<string, ColorData>,
  devToolsSummary: DevToolsColorSummary
): string {
  let html = '';

  const sections = [
    {
      id: 'summary',
      title: '🎨 Summary of All Colors',
      colors: devToolsSummary.summary.colors,
      description:
        'All unique colors found across the entire site excluding social/sharing icons and images ≤64x64px grouping those as icons',
    },
    {
      id: 'background',
      title: '🖼️ Background Colors',
      colors: devToolsSummary.background.colors,
      description: 'Colors used in background-color CSS property (excluding icons ≤64x64px)',
    },
    {
      id: 'text',
      title: '📝 Text Colors',
      colors: devToolsSummary.text.colors,
      description:
        'Colors used in color CSS property for text foreground (excluding icons ≤64x64px)',
    },
    {
      id: 'fill',
      title: '🎭 Fill Colors',
      colors: devToolsSummary.fill.colors,
      description: 'Colors used in SVG fill and stroke properties (excluding icons ≤64x64px)',
    },
    {
      id: 'border',
      title: '🔲 Border Colors',
      colors: devToolsSummary.border.colors,
      description: 'Colors used in border-color CSS property (excluding icons ≤64x64px)',
    },
  ];

  sections.forEach(section => {
    if (section.colors.length === 0) return;

    html += `
        <div class="color-category-section">
          <h3 style="font-size: 1.3rem; margin: 25px 0 15px 0; color: #2d3748;">${section.title} (${section.colors.length})</h3>
          <p style="font-size: 0.9rem; color: #718096; margin-bottom: 15px;">${section.description}</p>
          <div class="color-swatch-grid">
      `;

    section.colors.forEach(color => {
      const colorData = colors[color];
      if (!colorData) return;

      html += `
          <div class="color-swatch">
            <div class="swatch" style="background-color: ${color};" title="${color} - ${colorData.count} uses"></div>
            <div class="swatch-label">${color}</div>
            <div class="swatch-count">${colorData.count} use${colorData.count > 1 ? 's' : ''}</div>
          </div>
        `;
    });

    html += `
          </div>
        </div>
      `;
  });

  return html;
}

/**
 * Generate report header
 */
export function generateHeader(domain: string): string {
  return `
    <div class="header">
      <h1>🎨 ${domain} Brand Style Guide</h1>
      <h1>Colors</h1>
      <h1>Including Accessbility for Text Contrast</h1>
      <p>Professional Design Audit by ${platformStrings.productName}</p>
      <p><span style="font-size: 1.2rem;">Generated on ${new Date().toLocaleString()}</span></p>
    </div>
  `;
}

/**
 * Generate back to top link
 */
export function generateBackToTop(): string {
  return `
    <div style="text-align: center; margin-top: 40px; padding: 20px;">
      <a href="#toc" style="color: #667eea; text-decoration: none; font-size: 2rem; display: inline-block;">⬆️</a>
    </div>
  `;
}
