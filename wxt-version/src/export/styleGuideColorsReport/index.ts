// index.ts - Main export function for color style guide report

import { platformStrings } from '../../utils/platform';
import type { ReportData } from './types';
import { analyzeColorConsistency, ensureDevToolsSummary } from './analysis';
import { COLOR_REPORT_STYLES, REPORT_SCRIPTS } from './templates/styles';
import {
  generateHeader,
  generateTableOfContents,
  generateColorSwatchTable,
  generateSectionHeader,
  generateBackToTop,
} from './templates/components';
import { buildScoreSection } from './templates/sections/scoreCard';
import { buildIssuesSection, buildWarningsSection } from './templates/sections/issues';
import {
  buildColorFamiliesSection,
  buildNeutralsSection,
} from './templates/sections/colorFamilies';
import { buildOutliersSection } from './templates/sections/outliers';
import { buildAccessibilitySection } from './templates/sections/accessibility';
import { buildDistributionSection } from './templates/sections/distribution';
import { getContrastCheckerScript } from './templates/contrastChecker';

/**
 * Main export function for color style guide report
 */
export function exportStyleGuideColorsReport(
  data: ReportData,
  filenameBrand: string,
  showSuccess: (msg: string) => void,
  downloadFile: (filename: string, content: string, mimeType: string) => void
): void {
  if (!data || !data.colorData) {
    alert('No color data available to export.');
    return;
  }

  const domain = data.metadata.domain.replace(/^www\./, '');

  // Analyze color consistency
  const analysis = analyzeColorConsistency(data);

  // Ensure devToolsColorSummary exists and matches refined keys
  ensureDevToolsSummary(data);
  const colors = data.colorData.colors;
  const allColors = Object.keys(colors);

  // Build dynamic section order based on what data exists
  try {
    const sectionOrder: string[] = [];
    if (analysis.issues.length > 0) sectionOrder.push('issues-section');
    if (analysis.warnings.length > 0) sectionOrder.push('warnings-section');
    sectionOrder.push('all-colors-section');
    if (analysis.colorGroups.length > 0) sectionOrder.push('families-section');
    if (analysis.grays.length > 0) sectionOrder.push('neutrals-section');
    if (analysis.outliers.length > 0) sectionOrder.push('outliers-section');
    sectionOrder.push('accessibility-section');
    sectionOrder.push('distribution-section');

    // Helper to get next section ID
    const getNextSection = (currentId: string): string | null => {
      const idx = sectionOrder.indexOf(currentId);
      if (idx >= 0 && idx < sectionOrder.length - 1) {
        return sectionOrder[idx + 1];
      }
      return null;
    };

    // Build all sections
    const sections = [
      buildScoreSection(analysis),
      generateTableOfContents(analysis, allColors.length),
      buildIssuesSection(analysis, getNextSection),
      buildWarningsSection(analysis, getNextSection),
      buildAllColorsSection(allColors, colors, data, getNextSection),
      buildColorFamiliesSection(analysis, colors, getNextSection),
      buildNeutralsSection(analysis, colors, getNextSection),
      buildOutliersSection(analysis, colors, getNextSection),
      buildAccessibilitySection(analysis, getNextSection),
      buildDistributionSection(data),
      generateBackToTop(),
    ]
      .filter(Boolean)
      .join('\n');

    // Compose final HTML
    const html = `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${domain} Brand Style Guide Colors Including Accessbility for Text Contrast</title>
    <link rel="icon" type="image/png" href="${platformStrings.favicon}">
    <style>
  ${COLOR_REPORT_STYLES}
    </style>
  </head>
  <body>
    ${generateHeader(domain, data)}
    <div class="container">
      ${sections}
    </div>
    ${getContrastCheckerScript()}
    <script>
      // --- Instance Drawer Toggle ---
      // IMPORTANT: Positions the upward triangle to align with the clicked swatch
      function toggleInstanceDrawer(swatchEl, drawerId) {
        // Prevent badge click from toggling drawer
        if (event && event.target.closest('.merged-badge')) return;

        var drawer = document.getElementById(drawerId);
        if (!drawer) return;

        var isOpen = drawer.classList.contains('drawer-open');

        // Close all other open drawers first
        document.querySelectorAll('.instance-drawer.drawer-open').forEach(function(d) {
          d.classList.remove('drawer-open');
        });
        document.querySelectorAll('.color-swatch.swatch-active').forEach(function(s) {
          s.classList.remove('swatch-active');
        });

        if (!isOpen) {
          drawer.classList.add('drawer-open');
          swatchEl.classList.add('swatch-active');

          // Position the triangle under the clicked swatch
          var grid = swatchEl.parentElement;
          var swatchRect = swatchEl.getBoundingClientRect();
          var gridRect = grid.getBoundingClientRect();
          var triangleLeft = (swatchRect.left - gridRect.left) + (swatchRect.width / 2) - 10;
          drawer.style.setProperty('--triangle-left', triangleLeft + 'px');
        }
      }

      // --- Selector Popup ---
      var activeSelectorPopup = null;
      var activeSelectorBtn = null;

      function showSelectorPopup(e, btn) {
        e.stopPropagation();
        
        var wasAlreadyOpen = (activeSelectorPopup && activeSelectorBtn === btn);

        // Always close if something is open
        if (activeSelectorPopup) {
          closeSelectorPopup();
        }

        // If it was the same button, we just closed it and we're done (toggle off)
        if (wasAlreadyOpen) return;

        var selector = btn.getAttribute('data-selector');
        if (!selector) return;

        var popup = document.createElement('div');
        popup.className = 'selector-popup popup-visible';
        popup.innerHTML = '<div>' + selector + '</div>' +
          '<button class="selector-popup-copy" onclick="copySelectorText(event, this)">📋 Copy</button>';

        document.body.appendChild(popup);
        activeSelectorPopup = popup;
        activeSelectorBtn = btn;

        // Position near the button
        var rect = btn.getBoundingClientRect();
        popup.style.top = (rect.bottom + 8) + 'px';
        popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 520)) + 'px';

        // Close on outside click
        setTimeout(function() {
          document.addEventListener('click', closeSelectorPopup, { once: true });
        }, 0);
      }

      function closeSelectorPopup() {
        if (activeSelectorPopup) {
          activeSelectorPopup.remove();
          activeSelectorPopup = null;
          activeSelectorBtn = null;
          document.removeEventListener('click', closeSelectorPopup);
        }
      }

      function copySelectorText(e, btn) {
        e.stopPropagation();
        var text = btn.previousElementSibling.textContent;
        navigator.clipboard.writeText(text).then(function() {
          btn.textContent = '✅ Copied!';
          setTimeout(function() { btn.textContent = '📋 Copy'; }, 1500);
        });
      }

      // --- Styles Popup ---
      var activeStylesPopup = null;
      var activeStylesBtn = null;

      function showStylesPopup(e, btn) {
        e.stopPropagation();
        
        var wasAlreadyOpen = (activeStylesPopup && activeStylesBtn === btn);

        if (activeStylesPopup) {
          closeStylesPopup();
        }

        if (wasAlreadyOpen) return;

        var prop = btn.getAttribute('data-prop') || 'N/A';
        var size = btn.getAttribute('data-size') || 'N/A';
        var weight = btn.getAttribute('data-weight') || 'N/A';
        var family = (btn.getAttribute('data-family') || 'N/A').replace(/&quot;/g, '"');
        var lh = btn.getAttribute('data-lh') || 'N/A';
        var borderRadius = btn.getAttribute('data-border-radius') || 'N/A';
        var borderStyle = btn.getAttribute('data-border-style') || 'N/A';
        var borderWidth = btn.getAttribute('data-border-width') || 'N/A';
        var bgImage = btn.getAttribute('data-bg-image') || 'N/A';

        var popup = document.createElement('div');
        popup.className = 'styles-popup popup-visible';
        
        var html = '<div style="font-weight:bold; margin-bottom:10px; border-bottom:2px solid #667eea; padding-bottom:5px; color:#2d3748;">🔠 Visual Styles</div>';
        
        function addRow(label, value, shouldShow) {
          if (shouldShow === false) return '';
          return '<div class="styles-row"><span class="styles-label">' + label + ':</span> <div class="styles-value">' + value + '</div></div>';
        }

        const isText = (prop === 'color');
        const isBackground = (prop === 'background-color');
        const isBorder = (prop === 'border-color');
        
        // Use more descriptive label for the top
        const mainLabel = isText ? 'Text Color' : (isBackground ? 'Background Color' : 'Border Color');
        html += '<div style="font-size:0.9rem; font-weight:600; color:#4a5568; margin-bottom:12px;">' + mainLabel + '</div>';

        // Text Color metadata
        html += addRow('Font Size', size, isText);
        html += addRow('Weight', weight, isText);
        html += addRow('Family', family, isText);
        html += addRow('Line Height', lh, isText);
        
        // Background Color metadata
        html += addRow('Border Radius', borderRadius, isBackground);
        html += addRow('Background Image', bgImage === 'N/A' ? 'None' : 'Yes', isBackground);
        
        // Border Color metadata
        html += addRow('Border Style', borderStyle, isBorder);
        html += addRow('Border Width', borderWidth, isBorder);
        html += addRow('Border Radius', borderRadius, isBorder);

        popup.innerHTML = html;
        document.body.appendChild(popup);
        activeStylesPopup = popup;
        activeStylesBtn = btn;

        // Position near the button
        var rect = btn.getBoundingClientRect();
        popup.style.top = (rect.bottom + 8) + 'px';
        popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 340)) + 'px';

        // Close on outside click
        setTimeout(function() {
          document.addEventListener(\'click\', closeStylesPopup, { once: true });
        }, 0);
      }

      function closeStylesPopup() {
        if (activeStylesPopup) {
          activeStylesPopup.remove();
          activeStylesPopup = null;
          activeStylesBtn = null;
          document.removeEventListener(\'click\', closeStylesPopup);
        }
      }
    </script>
    ${REPORT_SCRIPTS}
  </body>
  </html>`;

    const filename = `${domain}-${filenameBrand}-brand-style-guide-colors.html`;
    downloadFile(filename, html, 'text/html');
    showSuccess('Brand Style Guides for Typography and Colors generated successfully!');
  } catch (err: any) {
    console.error('Failed to generate color report:', err);
    alert(`Failed to generate color report: ${err.message}`);
  }
}

/**
 * Build the "All Colors" section
 */
function buildAllColorsSection(
  allColors: string[],
  colors: any,
  data: ReportData,
  getNextSection: (id: string) => string | null
): string {
  return `
    ${generateSectionHeader('all-colors-section', `All Colors Used (${allColors.length} total)`, '🎨', getNextSection('all-colors-section'))}
    <div class="section">
      ${generateColorSwatchTable(colors, data.devToolsColorSummary!)}
    </div>
  `;
}
