// templates/components.ts - Reusable HTML components

import { platformStrings } from '../../../utils/platform';
import type { ColorAnalysis, ColorData, ColorInstance, DevToolsColorSummary } from '../types';
import { generateReportHeader } from '../../reportComponents';

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
 * Generate a single instance card with all 9 data fields.
 * IMPORTANT: Locate button code is preserved exactly as-is from the original outliers section.
 */
export function generateInstanceCard(inst: ColorInstance, baseColor: string = ''): string {
  const tag = inst.element || 'Unknown';
  const prop = inst.property || '';
  const section = inst.section || 'N/A';
  const block = inst.block || 'N/A';
  const context = inst.context || 'None';

  // Always show Original and Paired, defaulting if necessary
  // If originalHex is missing, it implies it matched the base color or was not merged
  const original = inst.originalHex || baseColor || 'Same';
  const paired = inst.pairedWith || 'None';

  // Dynamic "Paired" labeling based on context
  let pairedLabel = 'Paired Color';
  if (prop === 'background-color') {
    if (tag === 'BUTTON') {
      pairedLabel = 'Paired: Button Text';
    } else if (tag.startsWith('H') && tag.length <= 2) {
      pairedLabel = 'Paired: Heading Text';
    } else {
      pairedLabel = 'Paired: Text';
    }
  } else if (prop === 'color') {
    pairedLabel = 'Paired: Background';
  }

  // Color purpose label - clearly identifies what this color is used for
  const colorPurpose = (() => {
    switch (prop) {
      case 'color':
        return 'Text Color';
      case 'background-color':
        return 'Background Color';
      case 'fill':
        return 'SVG Fill';
      case 'stroke':
        return 'SVG Stroke';
      case 'border-color':
        return 'Border Color';
      default:
        return 'Purpose Unknown';
    }
  })();

  // Selector popup link (only if selector exists)
  const selectorBtn = inst.selector
    ? `<button class="selector-link" data-selector="${inst.selector.replace(/"/g, '&quot;')}" onclick="showSelectorPopup(event, this)">📋 Selector</button>`
    : `<button class="selector-link" disabled style="opacity: 0.5; cursor: default;">📋 Selector</button>`;

  // Styles popup button
  // IMPORTANT: Encode fontFamily to handle quotes in CSS font names
  const fontFamily = inst.fontFamily ? inst.fontFamily.replace(/"/g, '&quot;') : 'N/A';
  const stylesBtn = `<button class="selector-link" 
    data-prop="${prop}" 
    data-size="${inst.fontSize || 'N/A'}" 
    data-weight="${inst.fontWeight || 'N/A'}" 
    data-family="${fontFamily}" 
    data-lh="${inst.lineHeight || 'N/A'}"
    data-border-radius="${inst.borderRadius || 'N/A'}"
    data-border-style="${inst.borderStyle || 'N/A'}"
    data-border-width="${inst.borderWidth || 'N/A'}"
    data-bg-image="${inst.backgroundImage || 'N/A'}"
    onclick="showStylesPopup(event, this)">🔠 Styles</button>`;

  // IMPORTANT: Locate button — DO NOT change this logic.
  const locateBtn = inst.selector
    ? `<a class="locate-btn" href="${inst.page}#ssa-inspect-selector=${encodeURIComponent(inst.selector)}" target="_blank">🔍 Locate</a>`
    : `<span class="locate-btn" style="opacity: 0.5; cursor: default; background: #cbd5e0;">🔍 Locate</span>`;

  // Determine the display label for the section (cleaned by domHelpers)
  const sectionLabel = section ? `Section: ${section}` : 'Section:';

  // Integrated Badge logic for Outlier cards and instance drawers
  const mergedBadge =
    inst.mergedColors && inst.mergedColors.length > 0 ? generateMergedBadge(inst, baseColor) : '';

  return `
    <div class="instance-card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <span class="instance-card-tag">${tag}</span>
        ${mergedBadge}
      </div>
      
      <div class="instance-card-meta" style="border-top: none; padding-top: 0; margin-top: 2px;">
        <div style="font-weight: 600; color: #667eea;">${colorPurpose}</div>
        <div>Original: ${original}</div>
        <div>${pairedLabel}: ${paired}</div>
      </div>
      
      <div class="instance-card-context" style="margin-top: 4px;">Context: "${context}"</div>
      <div class="instance-card-location" style="margin-top: 4px; margin-bottom: 0;">${sectionLabel} / Block: ${block}</div>
      
      <div class="instance-card-actions" style="margin-top: 8px;">
        ${stylesBtn}
        ${selectorBtn}
        ${locateBtn}
      </div>
    </div>
  `;
}

/**
 * Generate the full instance drawer HTML, grouped by page, 5-column grid.
 */
export function generateInstanceDrawer(
  instances: ColorInstance[],
  drawerId: string,
  baseColor: string
): string {
  if (!instances || instances.length === 0) return '';

  // Group instances by page URL
  const pageGroups = new Map<string, { title: string; instances: ColorInstance[] }>();
  instances.forEach(inst => {
    const key = inst.page || 'Unknown';
    if (!pageGroups.has(key)) {
      pageGroups.set(key, { title: inst.pageTitle || 'Unknown Page', instances: [] });
    }
    pageGroups.get(key)!.instances.push(inst);
  });

  let groupsHtml = '';
  pageGroups.forEach((group, pageUrl) => {
    const cardsHtml = group.instances.map(inst => generateInstanceCard(inst, baseColor)).join('');
    groupsHtml += `
      <div class="instance-page-group">
        <div class="instance-page-header">
          ${group.title}
          <a href="${pageUrl}" target="_blank">${pageUrl}</a>
        </div>
        <div class="instance-grid">
          ${cardsHtml}
        </div>
      </div>
    `;
  });

  return `<div class="instance-drawer" id="${drawerId}">${groupsHtml}</div>`;
}

/**
 * Generate color swatch table using DevTools CSS Overview format.
 * Includes smart grouping badges for fuzzy-matched colors and
 * a clickable swatch that opens an instance drawer with all 9 data fields.
 */
/**
 * Generate the merged color badge with popup breakdown.
 * Handles Set, Array, and Object formats for mergedColors robustly.
 */
export function generateMergedBadge(colorData: any, colorHex: string): string {
  let mergedCount = 0;
  let mergedList: string[] = [];

  try {
    if (colorData.mergedColors) {
      if (colorData.mergedColors instanceof Set) {
        mergedList = Array.from(colorData.mergedColors as Set<string>);
      } else if (Array.isArray(colorData.mergedColors)) {
        mergedList = colorData.mergedColors;
      } else if (typeof colorData.mergedColors === 'object' && colorData.mergedColors !== null) {
        // Handle object with numeric keys or hex keys
        mergedList = Object.keys(colorData.mergedColors);
      }

      // Filter out invalid items and the main color itself if it snuck in
      mergedList = mergedList.filter(m => m && typeof m === 'string' && m !== colorHex);
      mergedCount = mergedList.length;
    }
  } catch (e) {
    console.warn('Error processing mergedColors for', colorHex, e);
  }

  if (mergedCount === 0) return '';

  // Build popup content: main color count + each variation count
  const instances = colorData.instances || [];
  const targetColorLower = colorHex.toLowerCase();

  const mainCount = instances.filter((i: any) => {
    const orig = (i.originalHex || colorHex).toLowerCase();
    return orig === targetColorLower;
  }).length;

  let popupLines = `<div><strong>Main Color (${colorHex}):</strong> ${mainCount} uses</div>`;
  mergedList.forEach(mc => {
    const mcLower = mc.toLowerCase();
    const mcCount = instances.filter(
      (i: any) => (i.originalHex || '').toLowerCase() === mcLower
    ).length;
    popupLines += `<div>${mc}: ${mcCount} use${mcCount !== 1 ? 's' : ''}</div>`;
  });

  return `
    <div class="merged-badge">
      +${mergedCount} similar
      <div class="badge-popup">${popupLines}</div>
    </div>
  `;
}

/**
 * Generate color swatch table using DevTools CSS Overview format.
 * Includes smart grouping badges for fuzzy-matched colors and
 * a clickable swatch that opens an instance drawer with all 9 data fields.
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

  let drawerCounter = 0;

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

      const drawerId = `drawer-${section.id}-${drawerCounter++}`;

      // Use shared helper for merged badge
      const mergedBadge = generateMergedBadge(colorData, color);

      // Instance drawer (hidden by default, shown on swatch click)
      const drawerHtml = generateInstanceDrawer(colorData.instances, drawerId, color);

      html += `
          <div class="color-swatch" data-drawer-id="${drawerId}" onclick="toggleInstanceDrawer(this, '${drawerId}')">
            <div class="swatch" style="background-color: ${color};"></div>
            <div class="swatch-label">${color}</div>
            <div class="swatch-count">${colorData.count} use${colorData.count > 1 ? 's' : ''}</div>
            ${mergedBadge}
          </div>
          ${drawerHtml}
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
export function generateHeader(domain: string, data?: any): string {
  return generateReportHeader({
    title: 'Brand Style Guide',
    domain: domain,
    data: data,
    emoji: '🎨',
    subtitle: 'Colors & Accessibility for Text Contrast',
  });
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
