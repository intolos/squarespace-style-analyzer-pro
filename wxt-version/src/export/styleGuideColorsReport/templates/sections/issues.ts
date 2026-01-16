// templates/sections/issues.ts - Issues and warnings sections

import type { ColorAnalysis } from '../../types';
import { generateSectionHeader } from '../components';

export function buildIssuesSection(
  analysis: ColorAnalysis,
  getNextSection: (id: string) => string | null
): string {
  if (analysis.issues.length === 0) return '';

  return `
    ${generateSectionHeader('issues-section', 'Issues Detected', '🔴', getNextSection('issues-section'))}
    <div class="section">
      <ul class="issues-list">
        ${analysis.issues.map(issue => `<li>${issue}</li>`).join('')}
      </ul>
    </div>
  `;
}

export function buildWarningsSection(
  analysis: ColorAnalysis,
  getNextSection: (id: string) => string | null
): string {
  if (analysis.warnings.length === 0) return '';

  return `
    ${generateSectionHeader('warnings-section', 'Warnings', '⚠️', getNextSection('warnings-section'))}
    <div class="section">
      <ul class="warnings-list">
        ${analysis.warnings.map(warning => `<li>${warning}</li>`).join('')}
      </ul>
    </div>
  `;
}
