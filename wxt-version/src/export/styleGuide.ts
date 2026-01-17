// styleGuide.ts - Typography Style Guide Export
// Migrated from export-style-guide.js

import { exportStyleGuideColorsReport } from './styleGuideColorsReport';
import { platformStrings } from '../utils/platform';

interface ThemeStyles {
  colors?: {
    styleDefinition: string;
  };
}

interface SquarespaceThemeStyles {
  miscFont?: string;
  miscFontStyle?: string;
  headingStyles?: Record<string, string>;
  paragraphStyles?: Record<string, string>;
}

interface HeadingData {
  locations: Array<{
    styleDefinition?: string;
    [key: string]: any;
  }>;
}

interface ButtonData {
  locations: Array<{
    text: string;
    styleDefinition?: string;
    [key: string]: any;
  }>;
}

interface StyleGuideData {
  metadata: {
    domain: string;
  };
  themeStyles?: ThemeStyles;
  squarespaceThemeStyles?: SquarespaceThemeStyles;
  headings: Record<string, HeadingData>;
  paragraphs: Record<string, HeadingData>;
  buttons: Record<string, ButtonData>;
}

/**
 * Export typography style guide
 */
export function exportStyleGuide(
  accumulatedResults: StyleGuideData,
  filenameBrand: string,
  showSuccess: (msg: string) => void,
  downloadFile: (content: string, filename: string, mimeType: string) => void
): void {
  if (!accumulatedResults) {
    alert('No data to export. Please analyze a page first.');
    return;
  }

  const data = accumulatedResults;
  const domain = data.metadata.domain.replace(/^www\./, '');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${domain} Brand Style Guide Typography</title>
  <link rel="icon" type="image/png" href="${platformStrings.favicon}">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 3px solid #667eea; }
    .header h1 { font-size: 2.7rem; margin: 0 0 10px 0; color: #2d3748; }
    .header p { color: #7180D8; font-size: 1.8rem; }
    .section { margin-bottom: 50px; page-break-inside: avoid; }
    .section-title { font-size: 2rem; color: #2d3748; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0; }
    .style-group { margin-bottom: 30px; }
    .style-label { font-weight: 600; color: #4a5568; margin-bottom: 10px; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.5px; }
    .style-value { padding: 15px; background: #f7fafc; border-radius: 6px; font-family: 'Courier New', monospace; color: #2d3748; border-left: 4px solid #667eea; font-size: 0.95rem; line-height: 1.6; }
    .typography-sample { margin: 20px 0; padding: 20px; background: #f7fafc; border-radius: 8px; border-left: 4px solid #667eea; }
    .typography-sample h3 { margin: 0 0 10px 0; color: #2d3748; font-size: 1.1rem; }
    .typography-sample p { margin: 0; color: #4a5568; font-size: 0.95rem; line-height: 1.6; font-family: 'Courier New', monospace; }
    @media print { body { padding: 20px; } .container { box-shadow: none; padding: 30px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 ${domain} Brand Style Guide</h1>
			<h1>Typography</h1>
      <p>Professional Design Audit by ${platformStrings.productName}</p>
      <p><span style="font-size: 1.2rem;">Generated on ${new Date().toLocaleString()}<span></p>
    </div>

    <div class="section">
      <h2 class="section-title">✏️ Typography</h2>
      <p style="color: #4a5568; font-size: 1.1rem; line-height: 1.6; margin-bottom: 30px;">
        The purpose of this report is to show the <strong><em>most commonly used</em></strong> styles for the analyzed pages for each heading, paragraph, and button, as an indication of your intended "Style Guide".
      </p>
    </div>
    
    <div class="section">
      ${generateTypographyStyles(data)}
    </div>

    <div class="section">
      <h2 class="section-title" style="font-weight: bold;">🔘 BUTTONS</h2>
      ${generateButtonStylesForGuide(data)}
    </div>
  </div>
</body>
</html>`;

  const filename = `${domain} ${filenameBrand} brand style guide typography.html`;
  downloadFile(html, filename, 'text/html');

  // Automatically generate colors report with a delay to avoid collision
  setTimeout(() => {
    exportStyleGuideColorsReport(
      accumulatedResults as any,
      filenameBrand,
      showSuccess,
      downloadFile
    );
  }, 1500);
}

/**
 * Generate typography styles section
 */
function generateTypographyStyles(data: StyleGuideData): string {
  let html = '';

  if (data.themeStyles?.colors?.styleDefinition) {
    html += '<div class="style-group"><div class="style-label">Theme Colors</div>';
    html += `<div class="style-value">${data.themeStyles.colors.styleDefinition}</div>`;
    html += '</div>';
  }

  if (data.squarespaceThemeStyles?.miscFont) {
    html += '<div class="style-group"><div class="style-label">Miscellaneous Font</div>';
    const miscStyle =
      data.squarespaceThemeStyles.miscFontStyle ||
      'font-family: ' + data.squarespaceThemeStyles.miscFont;
    html += `<div class="style-value">${miscStyle}</div>`;
    html += '</div>';
  }

  html +=
    '<h3 style="font-size: 2rem; color: #2d3748; margin-bottom: 30px; margin-top: 40px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0; font-weight: bold;">📝 HEADING STYLES</h3>';

  const headingTypes = [
    'heading-1',
    'heading-2',
    'heading-3',
    'heading-4',
    'heading-5',
    'heading-6',
  ];

  for (const type of headingTypes) {
    let styleDefinition = 'Not used on the pages analyzed';

    if (data.headings[type]?.locations?.length > 0) {
      const styleMap: Record<string, number> = {};
      for (const loc of data.headings[type].locations) {
        const style = loc.styleDefinition || '';
        if (style) {
          styleMap[style] = (styleMap[style] || 0) + 1;
        }
      }

      let maxCount = 0;
      for (const [style, count] of Object.entries(styleMap)) {
        if (count > maxCount) {
          maxCount = count;
          styleDefinition = style;
        }
      }
    } else if (data.squarespaceThemeStyles?.headingStyles?.[type]) {
      const themeStyle = data.squarespaceThemeStyles.headingStyles[type];
      if (themeStyle !== 'Not used on the pages analyzed') {
        styleDefinition = themeStyle;
      }
    }

    html += `<div class="typography-sample">
        <h3>${type.toUpperCase().replace(/-/g, ' ')}</h3>
        <p>${styleDefinition}</p>
      </div>`;
  }

  html +=
    '<h3 style="font-size: 2rem; color: #2d3748; margin-bottom: 30px; margin-top: 40px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0; font-weight: bold;">📄 PARAGRAPH STYLES</h3>';

  const paragraphTypes = ['paragraph-1', 'paragraph-2', 'paragraph-3'];
  for (const type of paragraphTypes) {
    let styleDefinition = 'Not used on the pages analyzed';

    if (data.paragraphs[type]?.locations?.length > 0) {
      const styleMap: Record<string, number> = {};
      for (const loc of data.paragraphs[type].locations) {
        const style = loc.styleDefinition || '';
        if (style) {
          styleMap[style] = (styleMap[style] || 0) + 1;
        }
      }

      let maxCount = 0;
      for (const [style, count] of Object.entries(styleMap)) {
        if (count > maxCount) {
          maxCount = count;
          styleDefinition = style;
        }
      }
    } else if (data.squarespaceThemeStyles?.paragraphStyles?.[type]) {
      const themeStyle = data.squarespaceThemeStyles.paragraphStyles[type];
      if (themeStyle !== 'Not used on the pages analyzed') {
        styleDefinition = themeStyle;
      }
    }

    html += `<div class="typography-sample">
        <h3>${type.toUpperCase().replace(/-/g, ' ')}</h3>
        <p>${styleDefinition}</p>
      </div>`;
  }

  return html;
}

/**
 * Generate button styles section
 */
function generateButtonStylesForGuide(data: StyleGuideData): string {
  let html = '';

  const buttonTypes = ['primary', 'secondary', 'tertiary', 'other'];
  const processedButtonTexts = new Set<string>();

  for (const type of buttonTypes) {
    if (data.buttons[type]?.locations?.length > 0) {
      const uniqueButtons = data.buttons[type].locations.filter(loc => {
        const key = loc.text + loc.styleDefinition;
        if (processedButtonTexts.has(key)) {
          return false;
        }
        processedButtonTexts.add(key);
        return true;
      });

      if (uniqueButtons.length > 0) {
        const styleMap: Record<string, number> = {};
        for (const loc of uniqueButtons) {
          const style = loc.styleDefinition || 'No style definition';
          styleMap[style] = (styleMap[style] || 0) + 1;
        }

        let mostCommonStyle = 'No style definition';
        let maxCount = 0;
        for (const [style, count] of Object.entries(styleMap)) {
          if (count > maxCount) {
            maxCount = count;
            mostCommonStyle = style;
          }
        }

        html += `<div class="style-group">
            <div class="style-label">${type.toUpperCase()} Button</div>
            <div class="style-value">${mostCommonStyle}</div>
          </div>`;
      }
    }
  }

  return html || '<p>No button styles found.</p>';
}
