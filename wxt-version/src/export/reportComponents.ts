// Shared components for report generation

import { StyleComparisonUtils } from '../utils/styleComparisonUtils';
import type { ReportLocation } from './types';
import { isSqs, platformStrings } from '../utils/platform';

interface RenderOptions {
  sectionId: string;
  nextSectionId?: string | null;
  textMaxLength?: number; // For truncating text in page-by-page report
  showNavigationArrows?: boolean;
}

/**
 * Generates a platform badge string for reports (generic version only).
 * Doubled font size for visibility as requested (1.9rem).
 */
export function generatePlatformBadge(data?: any): string {
  if (isSqs || !data) return '';

  const platform = (data as any).detectedPlatform;
  if (platform && platform.message) {
    return `<p style="font-size: 1.9rem; color: #475569; margin: 10px 0;">${platform.message}</p>`;
  }

  return '';
}

/**
 * Standardized Header for all exported HTML reports.
 * Moves the header closer to the top edge and ensures consistent styling.
 */
export function generateReportHeader(options: {
  title: string;
  domain: string;
  data?: any;
  emoji?: string;
  subtitle?: string;
}): string {
  const { title, domain, data, emoji, subtitle } = options;
  const emojiPrefix = emoji ? `${emoji} ` : '';
  const h1Style =
    'font-size: 2.7rem; margin: 0 0 10px 0; color: #2d3748; font-weight: bold; letter-spacing: normal;';

  const subtitleHtml = subtitle ? `<h1 style="${h1Style}">${subtitle}</h1>` : '';

  return `
    <div class="header" style="text-align: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid #667eea; background: transparent; color: #333;">
      <h1 style="${h1Style}">${emojiPrefix}${domain} ${title}</h1>
      ${subtitleHtml}
      <p style="color: #7180D8; font-size: 1.8rem; margin: 5px 0;">Professional Design Audit by ${platformStrings.productName}</p>
      ${generatePlatformBadge(data)}
      <p style="margin: 10px 0 0 0;"><span style="font-size: 1.2rem;">Generated on ${new Date().toLocaleString()}</span></p>
    </div>
  `;
}

/**
 * Generate a styled element section (Grouped by Baseline/Variations)
 * Shared between Aggregated Report and Page-by-Page Report
 */
export function generateStyledElementSection(
  label: string,
  locations: ReportLocation[],
  escapeHtmlFn: (s: string) => string,
  options: RenderOptions
): string {
  const { sectionId, nextSectionId, textMaxLength = 100, showNavigationArrows = true } = options;

  const styleGroups = StyleComparisonUtils.groupByStyleDefinition(locations);
  const hasVariations = styleGroups.length > 1;
  const baseline = styleGroups.length > 0 ? styleGroups[0].styleWithoutColors : null;

  // Navigation arrows
  const arrows = showNavigationArrows
    ? `
      <div style="flex-shrink: 0;">
        <a href="#agg-toc" style="color: #667eea; text-decoration: none; font-size: 1.1rem; margin-right: 8px;">⬆️</a>
        ${
          nextSectionId
            ? `<a href="#${nextSectionId}" style="color: #667eea; text-decoration: none; font-size: 1.1rem;">⬇️</a>`
            : ''
        }
      </div>
    `
    : '';

  let html = `<div id="${sectionId}" style="margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 5px solid ${
    hasVariations ? '#e53e3e' : '#48bb78'
  };">`;
  html += `<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">`;
  html += `<h3 style="margin: 0; color: #2d3748;">${label} `;
  html += `<span style="font-size: 0.85rem; font-weight: normal; color: ${
    hasVariations ? '#e53e3e' : '#48bb78'
  };">`;

  if (locations.length === 0) {
    html += '(not used)';
  } else {
    html += `(${locations.length} instance${locations.length === 1 ? '' : 's'}`;
    html += hasVariations ? `, ${styleGroups.length} variations)` : ', consistent)';
  }
  html += `</span></h3>`;

  // Only show top/down arrows if requested (usually for aggregated report)
  if (showNavigationArrows) {
    html += arrows;
  }

  html += `</div>`;

  if (locations.length === 0) {
    html += `<p style="color: #718096; margin: 0;">Not used on any analyzed pages.</p>`;
  } else {
    for (let i = 0; i < styleGroups.length; i++) {
      const group = styleGroups[i];
      const isBaseline = i === 0;
      const differences = isBaseline
        ? []
        : StyleComparisonUtils.getStyleDifferences(baseline, group.styleWithoutColors);

      html += `<div class="location accordion-container" style="margin-bottom: 10px;">`;
      html += `<div class="accordion-header">`;
      html += `<div class="accordion-title">`;
      html += `<span class="accordion-label">`;

      if (isBaseline) {
        html += `<span style="background: #48bb78; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-right: 8px;">BASELINE (most common)</span>`;
      } else {
        html += `<span style="background: #e53e3e; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-right: 8px;">VARIATION ${i}</span>`;
      }

      html += `</span>`;
      html += `<span class="accordion-icon">▶</span>`;
      html += `<span class="accordion-count">${group.instances.length} instance${
        group.instances.length === 1 ? '' : 's'
      }</span>`;
      html += `</div>`;

      // Show style (with differences bolded for variations)
      const formattedStyle = isBaseline
        ? StyleComparisonUtils.formatStyleWithoutColors(group.styleDefinition, escapeHtmlFn)
        : StyleComparisonUtils.formatStyleWithDifferences(
            group.styleDefinition,
            differences,
            escapeHtmlFn
          );
      html += `<div class="location-style" style="margin-top: 8px;">Style: ${formattedStyle}</div>`;
      html += `</div>`;

      // Accordion content - list of instances
      html += `<div class="accordion-content">`;
      for (let j = 0; j < group.instances.length; j++) {
        const loc = group.instances[j] as ReportLocation;
        html += `<div class="accordion-item" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 15px;">`;
        html += `<div style="display: flex; gap: 10px; flex: 1;">`;
        html += `<div class="accordion-item-number">#${j + 1}</div>`;
        html += `<div style="flex: 1;">`;

        // Row 1: URL + Locate Button
        html += `<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 5px;">`;

        // URL (wraps if needed)
        html += `<div style="word-break: break-all;">`;
        if (loc.navigationName) {
          html += `<div>📍 ${escapeHtmlFn(loc.navigationName || 'Unknown')} — <a href="${escapeHtmlFn(
            loc.url
          )}" target="_blank" style="color: #667eea; text-decoration: underline;">${escapeHtmlFn(
            loc.url
          )}</a></div>`;
        } else {
          html += `<div><a href="${escapeHtmlFn(
            loc.url
          )}" target="_blank" style="color: #667eea; text-decoration: underline;">${escapeHtmlFn(
            loc.url
          )}</a></div>`;
        }
        html += `</div>`; // End URL container

        // Locate Button (No shrinking, aligns right)
        if (loc.selector) {
          html += `<div style="flex-shrink: 0;">`;
          html += `<a href="${loc.url}#ssa-inspect-selector=${encodeURIComponent(
            loc.selector
          )}" target="_blank" style="display: inline-flex; align-items: center; padding: 4px 8px; background: #667eea; color: white; border-radius: 4px; text-decoration: none; font-size: 0.75rem; font-weight: bold;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Locate</a>`;
          html += `</div>`;
        }
        html += `</div>`; // End Row 1

        if (loc.text) {
          const displayText = escapeHtmlFn(loc.text.substring(0, textMaxLength));
          html += `<div class="location-text">"${displayText}${
            loc.text.length > textMaxLength ? '...' : ''
          }"</div>`;
        }
        html += `</div>`;
        html += `</div>`;
        html += `</div>`;
      }
      html += `</div>`;
      html += `</div>`;
    }
  }

  html += `</div>`;
  return html;
}

/**
 * Generates the standardized "IMPORTANT NOTE" for quality reports.
 * Used by: Website Analysis, Brand Style Guide Colors, and Images Analysis reports.
 */
export function generateImportantNote(): string {
  return `
    <div style="background: #667EEA; padding: 15px; margin-bottom: 20px; border-radius: 8px; color: white; text-align: left;">
      <div class="note-text note-truncated" style="font-size: 0.9rem; line-height: 1.5; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">
        <span style="color: #FFD700; font-weight: bold; margin-right: 5px;">➤</span> <strong>IMPORTANT NOTE:</strong> The "Locate" button that you find in the reports is a tremendous aid in pinpointing the exact location of issues. However, on the "Brand Style Guide Colors" and "Images Analysis" reports it may find situations that it cannot specifically locate. This is caused by a variety of complex coding structures, such as those previously mentioned plus, in the case of images, carousels and other techniques that hide images. In the Images Analysis report, we have also included direct links to the images so you can visually identify them to manually look for them.
      </div>
      <button class="note-toggle" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white; padding: 4px 12px; border-radius: 4px; font-size: 0.8rem; margin-top: 10px; cursor: pointer; font-weight: 600;">Read More</button>
    </div>
  `;
}

/**
 * Generates the specialized "IMPORTANT NOTE" for the Website Analysis Report.
 * Contains extended context about the complexity of auditing code.
 */
export function generateWebsiteAnalysisNote(): string {
  return `
    <div style="background: #667EEA; padding: 15px; margin-bottom: 20px; border-radius: 8px; color: white; text-align: left;">
      <div class="note-text note-truncated" style="font-size: 0.9rem; line-height: 1.5; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">
        <span style="color: #FFD700; font-weight: bold; margin-right: 5px;">➤</span> <strong>IMPORTANT NOTE:</strong> It is commonly known that it is much easier to architect and create website code than to audit and analyze it afterwards. This is due to deciphering the wide variety of disparate coding styles from the large variety of website building platforms, the inherent complexity of tracing deep nesting layers, navigating the intricate web of parent-child dependencies that evolve over time, and more. Our coding in this extension includes numerous situations to try to catch all possibilities and edge cases for the aspects being analyzed. Although it may not be absolutely perfect in all situations it will be extremely close and a huge guide for your understanding.
        <br><br>
        In particular, the "Locate" button that you find in the reports is a tremendous aid in pinpointing the exact location of issues. However, on the "Brand Style Guide Colors" and "Images Analysis" reports it may find situations that it cannot specifically locate. This is caused by a variety of complex coding structures, such as those previously mentioned plus, in the case of images, carousels and other techniques that hide images. In the Images Analysis report, we have also included direct links to the images so you can visually identify them to manually look for them.
      </div>
      <button class="note-toggle" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white; padding: 4px 12px; border-radius: 4px; font-size: 0.8rem; margin-top: 10px; cursor: pointer; font-weight: 600;">Read More</button>
    </div>
  `;
}
