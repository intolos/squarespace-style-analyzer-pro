// index.ts - Main export function for color style guide report

import { platformStrings } from '../../utils/platform';
import type { ReportData } from './types';
import { analyzeColorConsistency, ensureDevToolsSummary } from './analysis';
import { COLOR_REPORT_STYLES, ACCORDION_SCRIPT } from './templates/styles';
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
  downloadFile: (content: string, filename: string, mimeType: string) => void
): void {
  if (!data || !data.colorData) {
    alert('No color data available to export.');
    return;
  }

  const domain = data.metadata.domain.replace(/^www\./, '');

  // Ensure devToolsColorSummary exists
  ensureDevToolsSummary(data);

  // Analyze color consistency
  const analysis = analyzeColorConsistency(data);
  const colors = data.colorData.colors;
  const allColors = Object.keys(colors);

  // Build dynamic section order based on what data exists
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
  <div class="container">
    ${generateHeader(domain)}
    ${sections}
  </div>
  ${getContrastCheckerScript()}
  ${ACCORDION_SCRIPT}
</body>
</html>`;

  const filename = `${domain} ${filenameBrand} brand style guide colors.html`;
  downloadFile(html, filename, 'text/html');
  showSuccess('Brand Style Guides for Typography and Colors generated successfully!');
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
