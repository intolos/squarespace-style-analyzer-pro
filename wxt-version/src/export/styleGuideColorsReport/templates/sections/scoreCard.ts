// templates/sections/scoreCard.ts - Score display section
import type { ColorAnalysis } from '../../types';
import { generateImportantNote } from '../../../reportComponents';

export function buildScoreSection(analysis: ColorAnalysis): string {
  return `
    <div class="quality-score">
      <h2 style="color: white; margin: 0 0 20px 0; font-size: 1.9rem;">Color Consistency Score</h2>
      <div class="score-circle">${analysis.score}/10</div>
      <p>The pages analyzed use ${analysis.totalColors} different colors.</p>

      ${
        analysis.score < 10 && analysis.deductions && analysis.deductions.length > 0
          ? `
      <div style="margin-top: 25px; background: rgba(255,255,255,0.15); padding: 20px; border-radius: 8px; text-align: left;">
        <h3 style="color: white; margin: 0 0 15px 0; font-size: 1.2rem;">Score Deductions</h3>
        <ul style="margin: 0; padding-left: 20px; list-style: none;">
          ${analysis.deductions
            .map(
              d => `
            <li style="color: white; font-size: 1rem; margin-bottom: 8px; line-height: 1.5;">
              <strong>-${d.points.toFixed(1)}</strong> ${d.reason}
            </li>
          `
            )
            .join('')}
        </ul>
      </div>
      `
          : ''
      }
    </div>

    <div class="accordion-container" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-bottom: 30px;">
      <div class="accordion-header" style="background: transparent; color: white;">
        <h3 style="color: white; margin: 0; font-size: 1.5rem;">How the Score is Calculated</h3>
        <span class="accordion-icon" style="color: white;">▶</span>
      </div>
      <div class="accordion-content" style="background: transparent; color: white; padding: 0 30px 30px 30px;">
        <p style="font-size: 1.05rem; line-height: 1.6; margin-bottom: 15px;">
          The Color Consistency Score and Report provide a quick assessment for you to decide where you may be using too many colors.
        </p>
        <p style="font-size: 1.05rem; margin-bottom: 10px;"><strong>The calculation starts at 10.0</strong> and deducts points based on:</p>
        <ul style="font-size: 1rem; line-height: 1.8; margin: 0; padding-left: 25px; list-style-type: disc;">
          <li><strong>Total colors:</strong> -3.0 if &gt;50, -2.0 if &gt;35, -1.0 if &gt;25</li>
          <li><strong>Color variations:</strong> -1.5 per family with &gt;8 variations, -1.0 for &gt;5</li>
          <li><strong>Gray shades:</strong> -1.5 if &gt;12 grays, -1.0 if &gt;8</li>
          <li><strong>Outlier colors:</strong> -2.0 if &gt;10 outliers (used 1-2 times), -1.0 if &gt;5</li>
          <li><strong>WCAG contrast failures:</strong> -1.5 if &gt;5 failures, -0.5 if &gt;2</li>
        </ul>
      </div>
    </div>

    ${generateImportantNote()}
  `;
}
