#!/usr/bin/env python3
"""
Helper script to complete the styleGuideColorsReport.ts migration.
This script extracts the remaining HTML generation code from the original JS file
and formats it for TypeScript.
"""

import re

def extract_html_body_function():
    """
    Extract and convert the HTML body generation from the original JS file.
    This includes all the report sections.
    """
    
    # Read the original JavaScript file
    js_file = "/Users/edmass/Downloads/Squarespace Style Analyzer Pro/chrome-extension-files-js ver 4.2 3rd Post-Launch Version/squarespace-extension/export-style-guide-colors-report.js"
    
    with open(js_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the main HTML template (starts around line 454)
    # Extract from "const html = `" to the end of the template
    html_start = content.find('const html = `<!DOCTYPE html>')
    html_end = content.find('`;', html_start)
    
    if html_start == -1 or html_end == -1:
        print("Could not find HTML template in original file")
        return None
    
    html_template = content[html_start:html_end + 2]
    
    # Convert to TypeScript function
    ts_function = f"""
/**
 * Build the HTML body with all report sections
 */
function buildHTMLBody(
  domain: string,
  analysis: ColorAnalysis,
  colors: any,
  data: any,
  getNextSection: (id: string) => string | null
): string {{
  const allColors = Object.keys(colors);
  
  return `
  <div class="container">
    <div class="header">
      <h1>🎨 ${{domain}} Brand Style Guide</h1>
      <h1>Colors</h1>
      <h1>Including Accessbility for Text Contrast</h1>
      <p>Professional Design Audit by Squarespace Style Analyzer Pro</p>
      <p><span style="font-size: 1.2rem;">Generated on ${{new Date().toLocaleString()}}</span></p>
    </div>

    <!-- Color Consistency Score -->
    <div class="quality-score">
      <h2 style="color: white; margin: 0 0 20px 0; font-size: 1.9rem;">Color Consistency Score</h2>
      <div class="score-circle">${{analysis.score}}/10</div>
      <p>The pages analyzed use ${{analysis.totalColors}} different colors.</p>

      ${{
        analysis.score < 10 && analysis.deductions && analysis.deductions.length > 0
          ? `
      <div style="margin-top: 25px; background: rgba(255,255,255,0.15); padding: 20px; border-radius: 8px; text-align: left;">
        <h3 style="color: white; margin: 0 0 15px 0; font-size: 1.2rem;">Score Deductions</h3>
        <ul style="margin: 0; padding-left: 20px; list-style: none;">
          ${{analysis.deductions
            .map(
              d => `
            <li style="color: white; font-size: 1rem; margin-bottom: 8px; line-height: 1.5;">
              <strong>-${{d.points.toFixed(1)}}</strong> ${{d.reason}}
            </li>
          `
            )
            .join('')}}
        </ul>
      </div>
      `
          : ''
      }}
    </div>

    <!-- Score Explanation -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
      <h3 style="color: white; margin: 0 0 15px 0; font-size: 1.5rem;">How the Score is Calculated</h3>
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

    <!-- Table of Contents -->
    ${{generateTableOfContents(analysis, colors)}}

    <!-- Issues Section -->
    ${{
      analysis.issues.length > 0
        ? `
    ${{generateSectionHeader('issues-section', 'Issues Detected', '🔴', getNextSection('issues-section'))}}
    <div class="section">
      <ul class="issues-list">
        ${{analysis.issues.map(issue => `<li>${{issue}}</li>`).join('')}}
      </ul>
    </div>
    `
        : ''
    }}

    <!-- Warnings Section -->
    ${{
      analysis.warnings.length > 0
        ? `
    ${{generateSectionHeader('warnings-section', 'Warnings', '⚠️', getNextSection('warnings-section'))}}
    <div class="section">
      <ul class="warnings-list">
        ${{analysis.warnings.map(warning => `<li>${{warning}}</li>`).join('')}}
      </ul>
    </div>
    `
        : ''
    }}

    <!-- All Colors Section -->
    ${{generateSectionHeader('all-colors-section', `All Colors Used (${{allColors.length}} total)`, '🎨', getNextSection('all-colors-section'))}}
    <div class="section">
      ${{generateColorSwatchTable(colors, data.devToolsColorSummary)}}
    </div>

    <!-- Color Families Section -->
    ${{
      analysis.colorGroups.length > 0
        ? `
    ${{generateSectionHeader('families-section', 'Color Families & Variations', '👨‍👩‍👧‍👦', getNextSection('families-section'))}}
    <div class="section">
      <p style="color: #718096; margin-bottom: 20px;">Similar colors grouped together. Consider consolidating variations within each family.</p>
      ${{analysis.colorGroups
        .map(
          group => `
        <div class="color-group">
          <h3>Color Family - ${{group.variations.length}} variations (${{group.totalInstances}} total uses)</h3>
          <div class="color-variations">
            ${{group.variations
              .map(
                color => `
              <div class="variation-item ${{color === group.mainColor ? 'main-color' : ''}}">
                <div class="variation-swatch" style="background-color: ${{color}};"></div>
                <div class="variation-info">
                  <div class="variation-hex">${{color}}</div>
                  <div class="variation-count">${{colors[color].count}} uses${{color === group.mainColor ? ' (most used)' : ''}}</div>
                </div>
              </div>
            `
              )
              .join('')}}
          </div>
        </div>
      `
        )
        .join('')}}
    </div>
    `
        : ''
    }}

    <!-- Neutral Colors Section -->
    ${{
      analysis.grays.length > 0
        ? `
    ${{generateSectionHeader('neutrals-section', `Neutral Colors (${{analysis.grays.length}} neutrals found)`, '⚪', getNextSection('neutrals-section'))}}
    <div class="section">
      <div class="color-swatch-grid">
        ${{analysis.grays
          .map(
            color => `
          <div class="color-swatch">
            <div class="swatch" style="background-color: ${{color}};"></div>
            <div class="swatch-label">${{color}}</div>
            <div class="swatch-count">${{colors[color].count}} uses</div>
          </div>
        `
          )
          .join('')}}
      </div>
    </div>
    `
        : ''
    }}

    <!-- Outlier Colors Section -->
    ${{
      analysis.outliers.length > 0
        ? `
    ${{generateSectionHeader('outliers-section', `Outlier Colors (${{analysis.outliers.length}} found)`, '🚨', getNextSection('outliers-section'))}}
    <div class="section">
      <p style="color: #718096; margin-bottom: 20px;">Colors used only 1-2 times. These may be accidental or inconsistent with your brand.</p>
      <div class="outlier-grid">
        ${{analysis.outliers
          .map(color => {{
            const instances = colors[color].instances;
            const firstInstance = instances[0];
            return `
            <div class="outlier-item">
              <div class="outlier-header">
                <div class="outlier-swatch" style="background-color: ${{color}};"></div>
                <div class="outlier-info">
                  <div class="outlier-hex">${{color}}</div>
                  <div class="variation-count">${{colors[color].count}} use${{colors[color].count > 1 ? 's' : ''}}</div>
                </div>
                ${{
                  firstInstance.selector
                    ? `
                  <div style="margin-left: auto;">
                    <a href="${{firstInstance.page}}${{firstInstance.page.includes('?') ? '&' : '?'}}ssa-inspect-selector=${{encodeURIComponent(firstInstance.selector)}}" 
                       target="_blank" 
                       style="display: inline-block; padding: 6px 10px; background: #667eea; color: white; border-radius: 4px; text-decoration: none; font-size: 0.8rem; font-weight: bold;">
                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Locate
                    </a>
                  </div>`
                    : ''
                }}
              </div>
              <div class="outlier-location">
                <strong>Page:</strong>
                <a href="${{firstInstance.page}}" target="_blank" style="color: #667eea; text-decoration: underline;">
                  ${{firstInstance.page}}
                </a><br>
                <strong>Element:</strong> ${{firstInstance.context}}<br>
                <strong>Section:</strong> ${{firstInstance.section}}<br>
                <strong>Block:</strong> ${{firstInstance.block}}<br>
              </div>
            </div>
          `;
          }})
          .join('')}}
      </div>
    </div>
    `
        : ''
    }}

    <!-- Accessibility Section - TRUNCATED FOR BREVITY -->
    <!-- TODO: Add contrast failures section and contrast checker tool -->
    
    <!-- Page Distribution Section -->
    ${{generatePageBreakdown(data)}}

    <!-- Back to top -->
    <div style="text-align: center; margin-top: 40px; padding: 20px;">
      <a href="#toc" style="color: #667eea; text-decoration: none; font-size: 2rem; display: inline-block;">⬆️</a>
    </div>

  </div>

  <script>
    // Accordion functionality
    document.addEventListener('click', function(e) {{
      const header = e.target.closest('.accordion-header');
      if (header) {{
        const container = header.closest('.accordion-container');
        if (container) {{
          container.classList.toggle('open');
        }}
      }}
    }});
  </script>
  `;
}}
"""
    
    return ts_function

if __name__ == "__main__":
    print("Extracting HTML body function...")
    result = extract_html_body_function()
    if result:
        print("\\nGenerated TypeScript function (partial):")
        print(result[:1000] + "\\n... (truncated)")
        print("\\nNote: The accessibility section with contrast checker needs to be added manually")
        print("due to its size (~500 lines of HTML)")
