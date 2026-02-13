// templates/sections/accessibility.ts - Accessibility/contrast section

import type { ColorAnalysis } from '../../types';
import { generateSectionHeader } from '../components';
import { escapeHtml } from '../../../utils';

function getWcagStatusLine(ratio: number): string {
  const aaNormal = ratio >= 4.5;
  const aaaNormal = ratio >= 7.0;
  const aaLarge = ratio >= 3.0;
  const aaaLarge = ratio >= 4.5;

  const passStyle = 'color: #38a169; font-weight: 600;';
  const failStyle = 'color: #e53e3e; font-weight: 600;';

  return `
    <span style="margin-right: 10px;">AA Normal: <span style="${aaNormal ? passStyle : failStyle}">${aaNormal ? 'Pass' : 'Fail'}</span></span>
    <span style="margin-right: 10px;">AAA Normal: <span style="${aaaNormal ? passStyle : failStyle}">${aaaNormal ? 'Pass' : 'Fail'}</span></span>
    <span style="margin-right: 10px;">AA Large: <span style="${aaLarge ? passStyle : failStyle}">${aaLarge ? 'Pass' : 'Fail'}</span></span>
    <span>AAA Large: <span style="${aaaLarge ? passStyle : failStyle}">${aaaLarge ? 'Pass' : 'Fail'}</span></span>
  `;
}

/**
 * Generates WCAG status lines when font size is undetermined.
 * Uses smart logic to show definitive pass/fail where possible,
 * and "verify manually" only where font size actually matters.
 */
function getWcagStatusLineUndetermined(ratio: number): string {
  const aaNormal = ratio >= 4.5;
  const aaaNormal = ratio >= 7.0;
  const aaLarge = ratio >= 3.0;
  const aaaLarge = ratio >= 4.5;

  const passStyle = 'color: #38a169; font-weight: 600;';
  const failStyle = 'color: #e53e3e; font-weight: 600;';
  const verifyStyle = 'color: #d69e2e; font-weight: 600;';

  // AA Normal and AAA Normal can always be determined from ratio alone
  const aaNormalText = aaNormal ? 'Pass' : 'Fail';
  const aaaNormalText = aaaNormal ? 'Pass' : 'Fail';

  // For Large thresholds: if ratio fails the threshold, it fails regardless of size
  // If ratio passes, we need to verify if text is actually "large"
  let aaLargeText: string;
  let aaLargeStyle: string;
  if (aaLarge) {
    aaLargeText = 'Pass if text ≥18px or ≥14px bold — verify';
    aaLargeStyle = verifyStyle;
  } else {
    aaLargeText = 'Fail regardless of size';
    aaLargeStyle = failStyle;
  }

  let aaaLargeText: string;
  let aaaLargeStyle: string;
  if (aaaLarge) {
    aaaLargeText = 'Pass if text ≥18px or ≥14px bold — verify';
    aaaLargeStyle = verifyStyle;
  } else {
    aaaLargeText = 'Fail regardless of size';
    aaaLargeStyle = failStyle;
  }

  return `
    <div style="margin-top: 8px; padding: 10px; background: #fffbeb; border: 1px solid #f59e0b; border-radius: 6px; font-size: 0.85rem;">
      <div style="margin-bottom: 6px; color: #92400e; font-weight: 600;">⚠️ Font size could not be determined. WCAG status:</div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <span>AA Normal: <span style="${aaNormal ? passStyle : failStyle}">${aaNormalText} (requires ≥4.5:1; ratio: ${ratio}:1)</span></span>
        <span>AAA Normal: <span style="${aaaNormal ? passStyle : failStyle}">${aaaNormalText} (requires ≥7.0:1; ratio: ${ratio}:1)</span></span>
        <span>AA Large: <span style="${aaLargeStyle}">${aaLargeText}</span></span>
        <span>AAA Large: <span style="${aaaLargeStyle}">${aaaLargeText}</span></span>
      </div>
    </div>
  `;
}

export function buildAccessibilitySection(
  analysis: ColorAnalysis,
  getNextSection: (id: string) => string | null
): string {
  if (analysis.contrastFailures.length === 0) {
    return `
      ${generateSectionHeader('accessibility-section', 'Accessibility Status', '♿', getNextSection('accessibility-section'))}
      <div class="section">
        <div style="background: #c6f6d5; padding: 20px; border-radius: 8px; color: #22543d;">
          <strong>Excellent!</strong> All text and background color combinations pass WCAG contrast requirements.
        </div>
      </div>
    `;
  }

  return `
    ${generateSectionHeader('accessibility-section', `Accessibility Issues for Text Contrast (${analysis.contrastFailures.length} WCAG contrast failures)`, '♿', getNextSection('accessibility-section'))}
    <div class="section">
      <div style="background: #f0f4f8; border-left: 4px solid #4a90e2; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
        <p style="color: #1a202c; margin: 0; font-size: 0.95rem; line-height: 1.6;">
          These are text and background combinations that fail WCAG accessibility standards. Due to website design complexities, it is not always possible to detect contrast errors when gradients, filters, or background transparency are present. To test specific colors manually, you can use this
          <a href="javascript:void(0)" onclick="showContrastChecker(); return false;" style="color: #4a90e2; text-decoration: underline; font-weight: 600;">
            Contrast Checker Tool
          </a>
          to find colors with higher contrast that meet WCAG guidelines.
        </p>
      </div>
      
      <!-- Large Text Definition Accordion -->
      <div class="accordion-container" style="margin-bottom: 20px;">
        <div class="accordion-header" onclick="this.parentElement.classList.toggle('open');">
          <div class="accordion-title">
            <span class="accordion-icon">▶</span>
            <span style="font-weight: 600; color: #2d3748;">Large Text Definition</span>
          </div>
        </div>
        <div class="accordion-content">
          <div style="padding: 15px; background: #f8fafc; border-radius: 6px;">
            <h4 style="margin: 0 0 12px 0; color: #2d3748; font-size: 1.1rem;">Large Text</h4>
            <p style="margin: 0 0 12px 0; color: #4a5568; font-size: 0.95rem; line-height: 1.6;">
              Under the Web Content Accessibility Guidelines (WCAG), "large text" (officially called "large-scale text") is defined by two specific thresholds based on font size and weight:
            </p>
            <ul style="margin: 0 0 20px 20px; color: #4a5568; font-size: 0.95rem; line-height: 1.8;">
              <li>At least 18 point (typically equivalent to 24 CSS pixels) for normal weight text.</li>
              <li>At least 14 point (typically equivalent to 18.66 CSS pixels) for bold text.</li>
            </ul>
            
            <h4 style="margin: 0 0 12px 0; color: #2d3748; font-size: 1.05rem;">Why the Distinction Matters</h4>
            <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 0.95rem; line-height: 1.6;">
              WCAG provides different contrast requirements for large text because larger characters with wider strokes are generally easier to read at lower contrast ratios.
            </p>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.9rem;">
              <thead>
                <tr style="background: #edf2f7;">
                  <th style="padding: 10px 12px; text-align: left; border: 1px solid #e2e8f0; color: #2d3748;">Compliance Level</th>
                  <th style="padding: 10px 12px; text-align: left; border: 1px solid #e2e8f0; color: #2d3748;">Normal Text Ratio</th>
                  <th style="padding: 10px 12px; text-align: left; border: 1px solid #e2e8f0; color: #2d3748;">Large Text Ratio</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #4a5568;">Level AA (Minimum)</td>
                  <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #4a5568;">4.5:1</td>
                  <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #4a5568;">3:1</td>
                </tr>
                <tr>
                  <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #4a5568;">Level AAA (Enhanced)</td>
                  <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #4a5568;">7:1</td>
                  <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #4a5568;">4.5:1</td>
                </tr>
              </tbody>
            </table>
            
            <h4 style="margin: 0 0 12px 0; color: #2d3748; font-size: 1.05rem;">Key Technical Notes</h4>
            <ul style="margin: 0 0 0 20px; color: #4a5568; font-size: 0.9rem; line-height: 1.8;">
              <li><strong>Point vs. Pixel:</strong> While the official guideline uses "points," modern web design typically uses pixels. The standard conversion used by <a href="https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html" target="_blank" style="color: #4a90e2;">W3C</a> is 1pt = 1.333px.</li>
              <li><strong>Bold Weight:</strong> In CSS, "bold" refers to a font-weight of 700 or greater.</li>
              <li><strong>Relative Units:</strong> If you use relative units like em or rem, large text is roughly equivalent to 1.5em (regular) or 1.2em (bold), assuming a default body size of 100%.</li>
              <li><strong>Images of Text:</strong> These thresholds also apply to text embedded within images.</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="accordion-container">
        <div class="accordion-header" onclick="this.parentElement.classList.toggle('open');">
          <div class="accordion-title">
            <span class="accordion-icon">▶</span>
            <span class="accordion-count">${analysis.contrastFailures.length} issues</span>
          </div>
        </div>
        <div class="accordion-content">
      ${analysis.contrastFailures
        .map(
          failure => `
        <div class="contrast-issue">
          <div class="contrast-header">
            <div class="contrast-colors">
              <div class="contrast-swatch" style="background-color: ${failure.textColor};" title="Text color"></div>
              <div class="contrast-swatch" style="background-color: ${failure.backgroundColor};" title="Background color"></div>
            </div>
            <div class="contrast-info">
              <div class="contrast-ratio">Ratio: <span style="color: black;">${failure.ratio}:1</span></div>
              <div>Text: ${failure.textColor} on Background: ${failure.backgroundColor}</div>
              ${
                failure.elementText && failure.elementText !== 'Unknown'
                  ? `
              <div style="margin-top: 10px; padding: 10px; background: ${failure.backgroundColor}; border: 1px solid #e2e8f0; border-radius: 4px; line-height: 1.5;">
                <strong style="color: #e53e3e;">Element Text:</strong> 
                <span style="color: ${failure.textColor}; font-weight: 500; font-size: ${failure.fontSize ? failure.fontSize + 'px' : 'inherit'};">${escapeHtml(failure.elementText)}</span>
              </div>
              `
                  : ''
              }
              <div style="margin-top: 5px; font-size: 0.85rem; padding-top: 5px; border-top: 1px dashed #e2e8f0;">
                ${failure.fontSizeUndetermined ? getWcagStatusLineUndetermined(failure.ratio) : getWcagStatusLine(failure.ratio)}
              </div>
            </div>
            ${
              failure.selector
                ? `
            <div class="contrast-inspect">
              <a href="${failure.page}#ssa-inspect-selector=${encodeURIComponent(failure.selector)}" 
                 target="_blank" 
                 style="display: inline-flex; align-items: center; padding: 8px 16px; background: #667eea; color: white; border-radius: 6px; text-decoration: none; font-size: 0.85rem; font-weight: bold; transition: all 0.2s; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.25);"
                 onmouseover="this.style.background='#5a67d8'; this.style.transform='translateY(-1px)';"
                 onmouseout="this.style.background='#667eea'; this.style.transform='translateY(0)';">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                 Locate
              </a>
            </div>
            `
                : ''
            }
          </div>
          <div class="contrast-location">
            <strong>Text Size:</strong> ${failure.fontSizeUndetermined ? '<span style="color: #d69e2e;">⚠️ Could not be determined</span>' : failure.fontSizeString || (failure.fontSize ? failure.fontSize + 'px' : 'Unknown')} ${
              !failure.fontSizeUndetermined && failure.isLargeText
                ? '<span title="Meets Large Text threshold (18pt+ or 14pt+ bold)" style="cursor: help; border-bottom: 1px dotted #718096;">(Large Text)</span>'
                : ''
            }<br>
            <strong>Location:</strong> ${failure.location}<br>
            <strong>Page:</strong> <a href="${failure.page}" target="_blank" style="color: #667eea; text-decoration: underline;">${failure.page}</a><br>
            <strong>Section:</strong> ${failure.section ? failure.section : ''}<br>

            <strong>Block:</strong> ${failure.block}
          </div>
        </div>
      `
        )
        .join('')}
        </div>
      </div>
    </div>
  `;
}
