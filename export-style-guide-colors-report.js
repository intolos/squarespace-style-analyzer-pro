// export-style-guide-colors-report.js - Color Analysis and Report Generation

class ExportStyleGuideColorsReport {
  
  // Analyze color consistency and generate score
  static analyzeColorConsistency(data) {
    const colorData = data.colorData;
    const colors = colorData.colors;
    const allColors = Object.keys(colors);
    const totalColors = allColors.length;

    let score = 10.0;
    const issues = [];
    const warnings = [];
    const deductions = []; // Track all score deductions

    // 1. Count total colors
    if (totalColors > 50) {
      const deduction = 3.0;
      score -= deduction;
      deductions.push({ reason: `Excessive colors: ${totalColors} total (recommend 10-15)`, points: deduction });
      issues.push(`Excessive colors detected: ${totalColors} colors found (professional sites typically use 10-15)`);
    } else if (totalColors > 35) {
      const deduction = 2.0;
      score -= deduction;
      deductions.push({ reason: `Too many colors: ${totalColors} total (recommend 10-15)`, points: deduction });
    } else if (totalColors > 25) {
      const deduction = 1.0;
      score -= deduction;
      deductions.push({ reason: `High color count: ${totalColors} total (recommend 10-15)`, points: deduction });
    }

    // 2. Group similar colors and detect variations
    const colorGroups = this.groupSimilarColors(colors);
    let excessiveVariations = 0;

    colorGroups.forEach(group => {
      if (group.variations.length > 8) {
        const deduction = 1.5;
        score -= deduction;
        excessiveVariations++;
        deductions.push({ reason: `Color family with ${group.variations.length} variations (consolidate similar shades)`, points: deduction });
        issues.push(`Color family has ${group.variations.length} variations`);
      } else if (group.variations.length > 5) {
        const deduction = 1.0;
        score -= deduction;
        excessiveVariations++;
        deductions.push({ reason: `Color family with ${group.variations.length} variations`, points: deduction });
      }
    });

    // 3. Detect grays/neutrals
    const grays = this.identifyGrays(allColors);
    if (grays.length > 12) {
      const deduction = 1.5;
      score -= deduction;
      deductions.push({ reason: `Too many gray shades: ${grays.length} (recommend 3-5)`, points: deduction });
      issues.push(`Too many gray shades: ${grays.length}`);
    } else if (grays.length > 8) {
      const deduction = 1.0;
      score -= deduction;
      deductions.push({ reason: `Many gray shades: ${grays.length} (recommend 3-5)`, points: deduction });
    }

    // 4. Detect outliers (colors used 1-2 times)
    const outliers = allColors.filter(color => colors[color].count <= 2);
    if (outliers.length > 10) {
      const deduction = 2.0;
      score -= deduction;
      deductions.push({ reason: `${outliers.length} outlier colors (may be accidental)`, points: deduction });
      issues.push(`${outliers.length} outlier colors detected (may be accidental)`);
    } else if (outliers.length > 5) {
      const deduction = 1.0;
      score -= deduction;
      deductions.push({ reason: `${outliers.length} outlier colors`, points: deduction });
    }

    // 5. Check contrast failures - deduplicate by exact location
    const seenFailures = new Set();
    const contrastFailures = colorData.contrastPairs.filter(pair => {
      if (pair.passes) return false;

      // Create unique key for this specific element instance
      const key = pair.page + '|' + pair.section + '|' + pair.block + '|' + pair.location;

      if (seenFailures.has(key)) {
        return false;
      }
      seenFailures.add(key);
      return true;
    });
    if (contrastFailures.length > 5) {
      const deduction = 1.5;
      score -= deduction;
      deductions.push({ reason: `${contrastFailures.length} WCAG contrast failures`, points: deduction });
      issues.push(`${contrastFailures.length} accessibility contrast failures (WCAG)`);
    } else if (contrastFailures.length > 2) {
      const deduction = 0.5;
      score -= deduction;
      deductions.push({ reason: `${contrastFailures.length} WCAG contrast issues`, points: deduction });
      warnings.push(`${contrastFailures.length} accessibility contrast issues`);
    }

    // Ensure score is between 0 and 10
    score = Math.max(0, Math.min(10, score));

    return {
      score: Math.round(score * 10) / 10,
      totalColors: totalColors,
      colorGroups: colorGroups,
      grays: grays,
      outliers: outliers,
      contrastFailures: contrastFailures,
      issues: issues,
      warnings: warnings,
      deductions: deductions // List of all score deductions
    };
  }
  
  // Group similar colors using RGB distance
  static groupSimilarColors(colors) {
    const allColors = Object.keys(colors);
    const groups = [];
    const processed = new Set();
    
    // Similarity threshold (15% of max RGB distance)
    const threshold = 441 * 0.15; // sqrt(255^2 + 255^2 + 255^2) * 0.15
    
    allColors.forEach(color1 => {
      if (processed.has(color1)) return;
      
      const group = {
        mainColor: color1,
        mainCount: colors[color1].count,
        variations: [color1],
        totalInstances: colors[color1].count
      };
      
      allColors.forEach(color2 => {
        if (color1 === color2 || processed.has(color2)) return;
        
        const distance = this.calculateColorDistance(color1, color2);
        if (distance < threshold) {
          group.variations.push(color2);
          group.totalInstances += colors[color2].count;
          processed.add(color2);
          
          // Update main color to most frequently used
          if (colors[color2].count > group.mainCount) {
            group.mainColor = color2;
            group.mainCount = colors[color2].count;
          }
        }
      });
      
      processed.add(color1);
      
      // Only add groups with multiple variations
      if (group.variations.length > 1) {
        groups.push(group);
      }
    });
    
    return groups;
  }
  
  // Calculate Euclidean distance between two colors
  static calculateColorDistance(hex1, hex2) {
    const rgb1 = this.hexToRgb(hex1);
    const rgb2 = this.hexToRgb(hex2);
    
    const rDiff = rgb1.r - rgb2.r;
    const gDiff = rgb1.g - rgb2.g;
    const bDiff = rgb1.b - rgb2.b;
    
    return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
  }
  
  // Convert hex to RGB
  static hexToRgb(hex) {
    hex = hex.replace('#', '');
    return {
      r: parseInt(hex.substr(0, 2), 16),
      g: parseInt(hex.substr(2, 2), 16),
      b: parseInt(hex.substr(4, 2), 16)
    };
  }
  
  // Identify gray colors
  static identifyGrays(colors) {
    return colors.filter(color => {
      const rgb = this.hexToRgb(color);
      // Gray if R, G, B are within 15 of each other
      const max = Math.max(rgb.r, rgb.g, rgb.b);
      const min = Math.min(rgb.r, rgb.g, rgb.b);
      return (max - min) < 15;
    });
  }
  
  // Generate color swatch table using DevTools CSS Overview format
  static generateColorSwatchTable(colors, devToolsSummary) {
    let html = '';

    // DevTools CSS Overview format - 5 sections
    const sections = [
      {
        id: 'summary',
        title: '🎨 Summary of All Colors',
        colors: devToolsSummary.summary.colors,
        description: 'All unique colors found across the entire site excluding social/sharing icons and images ≤64x64px grouping those as icons'
      },
      {
        id: 'background',
        title: '🖼️ Background Colors',
        colors: devToolsSummary.background.colors,
        description: 'Colors used in background-color CSS property (excluding icons ≤64x64px)'
      },
      {
        id: 'text',
        title: '📝 Text Colors',
        colors: devToolsSummary.text.colors,
        description: 'Colors used in color CSS property for text foreground (excluding icons ≤64x64px)'
      },
      {
        id: 'fill',
        title: '🎭 Fill Colors',
        colors: devToolsSummary.fill.colors,
        description: 'Colors used in SVG fill and stroke properties (excluding icons ≤64x64px)'
      },
      {
        id: 'border',
        title: '🔲 Border Colors',
        colors: devToolsSummary.border.colors,
        description: 'Colors used in border-color CSS property (excluding icons ≤64x64px)'
      }
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

  // Generate section header with up arrow and optional down arrow
  static generateSectionHeader(id, title, emoji, nextSectionId = null) {
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

  // Generate Table of Contents
  static generateTableOfContents(analysis, colors) {
    const tocItems = [];
    
    if (analysis.issues.length > 0) {
      tocItems.push({ id: 'issues-section', label: '🔴 Issues Detected' });
    }
    
    if (analysis.warnings.length > 0) {
      tocItems.push({ id: 'warnings-section', label: '⚠️ Warnings' });
    }
    
    tocItems.push({ id: 'all-colors-section', label: `🎨 All Colors Used (${Object.keys(colors).length})` });
    
    if (analysis.colorGroups.length > 0) {
      tocItems.push({ id: 'families-section', label: '👨‍👩‍👧‍👦 Color Families & Variations' });
    }
    
    if (analysis.grays.length > 0) {
      tocItems.push({ id: 'neutrals-section', label: `⚪ Neutral Colors (${analysis.grays.length})` });
    }
    
    if (analysis.outliers.length > 0) {
      tocItems.push({ id: 'outliers-section', label: `🚨 Outlier Colors (${analysis.outliers.length})` });
    }
    
    tocItems.push({ id: 'accessibility-section', label: analysis.contrastFailures.length > 0 
      ? `♿ Accessibility Issues for Text Contrast (${analysis.contrastFailures.length})` 
      : '♿ Accessibility Status' });
    
    tocItems.push({ id: 'distribution-section', label: '🌈 Color Distribution Across Pages' });
    
    return `
      <div id="toc" style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 40px; border: 2px solid #667eea;">
        <h2 style="margin-top: 0; color: #667eea;">📋 Table of Contents</h2>
        <ul style="list-style: none; padding-left: 0;">
          ${tocItems.map(item => `
            <li style="margin: 10px 0;">
              <a href="#${item.id}" style="color: #667eea; text-decoration: none; font-weight: bold;">${item.label}</a>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }
  
  // Main export function
  static export(data, filenameBrand, showSuccess, downloadFile) {
    if (!data || !data.colorData) {
      alert('No color data available to export.');
      return;
    }
    
    const domain = data.metadata.domain.replace(/^www\./, '');
    const analysis = this.analyzeColorConsistency(data);
    const colors = data.colorData.colors;
    const allColors = Object.keys(colors);
    
    // Build dynamic section order based on what data exists
    const sectionOrder = [];
    if (analysis.issues.length > 0) sectionOrder.push('issues-section');
    if (analysis.warnings.length > 0) sectionOrder.push('warnings-section');
    sectionOrder.push('all-colors-section');
    if (analysis.colorGroups.length > 0) sectionOrder.push('families-section');
    if (analysis.grays.length > 0) sectionOrder.push('neutrals-section');
    if (analysis.outliers.length > 0) sectionOrder.push('outliers-section');
    sectionOrder.push('accessibility-section');
    sectionOrder.push('distribution-section');
    
    // Helper to get next section ID
    const getNextSection = (currentId) => {
      const idx = sectionOrder.indexOf(currentId);
      if (idx >= 0 && idx < sectionOrder.length - 1) {
        return sectionOrder[idx + 1];
      }
      return null;
    };
    
    // Generate HTML report
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${domain} Brand Style Guide Colors Including Accessbility for Text Contrast</title>
  <link rel="icon" type="image/png" href="https://intolos.github.io/squarespace-style-analyzer-pro/icon32.png">
  <style>
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #2d3748;
      background: #f8fafc;
      margin: 0px;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    .header {
      text-align: center;
      margin-bottom: 50px;
      padding-bottom: 10px;
      border-bottom: 3px solid #667eea;
    }
    
    .header h1 {
      font-size: 2.7rem;
      color: #2d3748;
      margin: 0 0 10px 0;
    }
    
    .header p {
      color: #7180D8;
      font-size: 1.8rem;
    }

    .quality-score {
      background: #667eea;
      color: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
      text-align: center;
    }
    
    .quality-score h2 {
      font-size: 1.9rem;
      margin-bottom: 20px;
    }
    
    .score-circle {
      font-size: 3rem;
      font-weight: bold;
      margin: 20px 0;
    }
    
    .quality-score p {
      font-size: 1.1rem;
      margin: 10px 0;
      opacity: 0.95;
    }
    
    .section {
      margin-bottom: 40px;
    }
    
    .section h2 {
      font-size: 1.8rem;
      color: #2d3748;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .color-swatch-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    
    .color-swatch {
      text-align: center;
    }
    
    .swatch {
      width: 100%;
      height: 80px;
      border-radius: 8px;
      border: 2px solid #e2e8f0;
      margin-bottom: 8px;
      cursor: pointer;
      transition: transform 0.2s;
    }
    
    .swatch:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    
    .swatch-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #2d3748;
      font-family: monospace;
    }
    
    .swatch-count {
      font-size: 0.75rem;
      color: #718096;
    }
    
    .color-group {
      background: #f7fafc;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      border-left: 4px solid #667eea;
    }
    
    .color-group h3 {
      font-size: 1.3rem;
      margin-bottom: 15px;
      color: #2d3748;
    }
    
    .color-variations {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
    }
    
    .variation-item {
      display: flex;
      align-items: center;
      gap: 8px;
      background: white;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    
    .variation-swatch {
      width: 30px;
      height: 30px;
      border-radius: 4px;
      border: 1px solid #cbd5e0;
    }
    
    .variation-info {
      font-size: 0.85rem;
    }
    
    .variation-hex {
      font-family: monospace;
      font-weight: 600;
      color: #2d3748;
    }
    
    .variation-count {
      color: #718096;
    }
    
    .outlier-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    
    .outlier-item {
      background: #fff5f5;
      padding: 15px;
      border-radius: 6px;
      border-left: 3px solid #e53e3e;
    }
    
    .outlier-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    
    .outlier-swatch {
      width: 40px;
      height: 40px;
      border-radius: 4px;
      border: 1px solid #cbd5e0;
    }
    
    .outlier-info {
      font-size: 0.9rem;
    }
    
    .outlier-hex {
      font-family: monospace;
      font-weight: 600;
      color: #2d3748;
    }
    
    .outlier-location {
      font-size: 0.85rem;
      color: #718096;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #fed7d7;
    }
    
    .contrast-issue {
      background: #fff5f5;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 15px;
      border-left: 4px solid #e53e3e;
    }
    
    .contrast-header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 10px;
    }
    
    .contrast-colors {
      display: flex;
      gap: 5px;
    }
    
    .contrast-swatch {
      width: 50px;
      height: 50px;
      border-radius: 4px;
      border: 1px solid #cbd5e0;
    }
    
    .contrast-info {
      flex: 1;
    }
    
    .contrast-ratio {
      font-size: 1.1rem;
      font-weight: 600;
      color: #e53e3e;
    }
    
    .contrast-location {
      font-size: 0.85rem;
      color: #718096;
      margin-top: 8px;
    }
    
    .page-breakdown {
      background: #f7fafc;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 15px;
    }
    
    .page-breakdown h3 {
      font-size: 1.2rem;
      color: #2d3748;
      margin-bottom: 10px;
    }
    
    .page-url {
      font-size: 0.85rem;
      color: #718096;
      margin-bottom: 15px;
      word-break: break-all;
    }
    
    .page-colors {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .page-color-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: white;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    
    .page-color-swatch {
      width: 20px;
      height: 20px;
      border-radius: 3px;
      border: 1px solid #cbd5e0;
    }
    
    .accordion-container { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 15px; }
    .accordion-header { padding: 15px; background: #edf2f7; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
    .accordion-header:hover { background: #e2e8f0; }
    .accordion-title { display: flex; align-items: center; gap: 10px; }
    .accordion-icon { font-size: 1.3rem; color: #667eea; transition: transform 0.2s ease; }
    .accordion-container.open .accordion-icon { transform: rotate(90deg); }
    .accordion-count { background: #667eea; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; }
    .accordion-content { display: none; padding: 15px; background: white; }
    .accordion-container.open .accordion-content { display: block; }
    
    .issues-list {
      list-style: none;
      padding: 0;
    }
    
    .issues-list li {
      background: #fff5f5;
      padding: 12px 15px;
      margin-bottom: 10px;
      border-radius: 6px;
      border-left: 4px solid #e53e3e;
      color: #742a2a;
    }
    
    .warnings-list {
      list-style: none;
      padding: 0;
    }
    
    .warnings-list li {
      background: #fffaf0;
      padding: 12px 15px;
      margin-bottom: 10px;
      border-radius: 6px;
      border-left: 4px solid #ed8936;
      color: #7c2d12;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎨 ${domain} Brand Style Guide</h1>
      <h1>Colors</h1>
      <h1>Including Accessbility for Text Contrast</h1>
      <p>Professional Design Audit by Squarespace Style Analyzer Pro</p>
      <p><span style="font-size: 1.2rem;">Generated on ${new Date().toLocaleString()}</span></p>
    </div>

    <!-- Color Consistency Score (before TOC) -->
    <div class="quality-score">
      <h2 style="color: white; margin: 0 0 20px 0; font-size: 1.9rem;">Color Consistency Score</h2>
      <div class="score-circle">${analysis.score}/10</div>
      <p>The pages analyzed use ${analysis.totalColors} different colors.</p>

      ${analysis.score < 10 && analysis.deductions && analysis.deductions.length > 0 ? `
      <div style="margin-top: 25px; background: rgba(255,255,255,0.15); padding: 20px; border-radius: 8px; text-align: left;">
        <h3 style="color: white; margin: 0 0 15px 0; font-size: 1.2rem;">Score Deductions</h3>
        <ul style="margin: 0; padding-left: 20px; list-style: none;">
          ${analysis.deductions.map(d => `
            <li style="color: white; font-size: 1rem; margin-bottom: 8px; line-height: 1.5;">
              <strong>-${d.points.toFixed(1)}</strong> ${d.reason}
            </li>
          `).join('')}
        </ul>
      </div>
      ` : ''}
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
    ${this.generateTableOfContents(analysis, colors)}

    <!-- Issues Detected -->
    ${analysis.issues.length > 0 ? `
    ${this.generateSectionHeader('issues-section', 'Issues Detected', '🔴', getNextSection('issues-section'))}
    <div class="section">
      <ul class="issues-list">
        ${analysis.issues.map(issue => `<li>${issue}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    <!-- Warnings -->
    ${analysis.warnings.length > 0 ? `
    ${this.generateSectionHeader('warnings-section', 'Warnings', '⚠️', getNextSection('warnings-section'))}
    <div class="section">
      <ul class="warnings-list">
        ${analysis.warnings.map(warning => `<li>${warning}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    <!-- All Colors with Swatches (DevTools CSS Overview Format) -->
    ${this.generateSectionHeader('all-colors-section', `All Colors Used (${allColors.length} total)`, '🎨', getNextSection('all-colors-section'))}
    <div class="section">
      ${this.generateColorSwatchTable(colors, data.devToolsColorSummary)}
    </div>

    <!-- Color Groups and Variations -->
    ${analysis.colorGroups.length > 0 ? `
    ${this.generateSectionHeader('families-section', 'Color Families & Variations', '👨‍👩‍👧‍👦', getNextSection('families-section'))}
    <div class="section">
      <p style="color: #718096; margin-bottom: 20px;">Similar colors grouped together. Consider consolidating variations within each family.</p>
      ${analysis.colorGroups.map(group => `
        <div class="color-group">
          <h3>Color Family - ${group.variations.length} variations (${group.totalInstances} total uses)</h3>
          <div class="color-variations">
            ${group.variations.map(color => `
              <div class="variation-item ${color === group.mainColor ? 'main-color' : ''}">
                <div class="variation-swatch" style="background-color: ${color};"></div>
                <div class="variation-info">
                  <div class="variation-hex">${color}</div>
                  <div class="variation-count">${colors[color].count} uses${color === group.mainColor ? ' (most used)' : ''}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- Neutral Colors (Grays) -->
    ${analysis.grays.length > 0 ? `
    ${this.generateSectionHeader('neutrals-section', `Neutral Colors (${analysis.grays.length} neutrals found)`, '⚪', getNextSection('neutrals-section'))}
    <div class="section">
      <div class="color-swatch-grid">
        ${analysis.grays.map(color => `
          <div class="color-swatch">
            <div class="swatch" style="background-color: ${color};"></div>
            <div class="swatch-label">${color}</div>
            <div class="swatch-count">${colors[color].count} uses</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Outlier Colors -->
    ${analysis.outliers.length > 0 ? `
    ${this.generateSectionHeader('outliers-section', `Outlier Colors (${analysis.outliers.length} found)`, '◯', getNextSection('outliers-section'))}
    <div class="section">
      <p style="color: #718096; margin-bottom: 20px;">Colors used only 1-2 times. These may be accidental or inconsistent with your brand.</p>
      <div class="outlier-grid">
        ${analysis.outliers.map(color => {
          const instances = colors[color].instances;
          const firstInstance = instances[0];
          return `
            <div class="outlier-item">
              <div class="outlier-header">
                <div class="outlier-swatch" style="background-color: ${color};"></div>
                <div class="outlier-info">
                  <div class="outlier-hex">${color}</div>
                  <div class="variation-count">${colors[color].count} use${colors[color].count > 1 ? 's' : ''}</div>
                </div>
              </div>
              <div class="outlier-location">
                <strong>Page:</strong>
                <a href="${firstInstance.page}" target="_blank" style="color: #667eea; text-decoration: underline;">
                  ${firstInstance.page}
                </a><br>
                <strong>Element:</strong> ${firstInstance.context}<br>
                <strong>Section:</strong> ${firstInstance.section}<br>
                <strong>Block:</strong> ${firstInstance.block}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Accessibility Issues -->
    ${analysis.contrastFailures.length > 0 ? `
    ${this.generateSectionHeader('accessibility-section', `Accessibility Issues for Text Contrast (${analysis.contrastFailures.length} WCAG contrast failures)`, '♿', getNextSection('accessibility-section'))}
    <div class="section">
      <p style="color: #718096; margin-bottom: 20px;">Text and background combinations that fail WCAG accessibility standards. Suggestion: Use an online WCAG text contrast checker to find colors with higher contrast that meet WCAG guidelines.</p>
      <div class="accordion-container">
        <div class="accordion-header" onclick="this.parentElement.classList.toggle('open')">
          <div class="accordion-title">
            <span class="accordion-icon">▶</span>
            <span class="accordion-count">${analysis.contrastFailures.length} issues</span>
          </div>
        </div>
        <div class="accordion-content">
      ${analysis.contrastFailures.map(failure => `
        <div class="contrast-issue">
          <div class="contrast-header">
            <div class="contrast-colors">
              <div class="contrast-swatch" style="background-color: ${failure.textColor};" title="Text color"></div>
              <div class="contrast-swatch" style="background-color: ${failure.backgroundColor};" title="Background color"></div>
            </div>
            <div class="contrast-info">
              <div class="contrast-ratio">Ratio: ${failure.ratio}:1 (${failure.wcagLevel})</div>
              <div>Text: ${failure.textColor} on Background: ${failure.backgroundColor}</div>
            </div>
          </div>
          <div class="contrast-location">
            <strong>Location:</strong> ${failure.location}<br>
            <strong>Page:</strong> <a href="${failure.page}" target="_blank" style="color: #667eea; text-decoration: underline;">${failure.page}</a><br>
            <strong>Section:</strong> ${failure.section}<br>
            <strong>Block:</strong> ${failure.block}<br>
            <strong>Element:</strong> ${failure.element}
          </div>
        </div>
      `).join('')}
        </div>
      </div>
    </div>
    ` : `
    ${this.generateSectionHeader('accessibility-section', 'Accessibility Status', '♿', getNextSection('accessibility-section'))}
    <div class="section">
      <div style="background: #c6f6d5; padding: 20px; border-radius: 8px; color: #22543d;">
        <strong>Excellent!</strong> All text and background color combinations pass WCAG contrast requirements.
      </div>
    </div>
    `}

    <!-- Page-by-Page Color Distribution -->
    ${this.generateSectionHeader('distribution-section', 'Color Distribution Across Pages', '🌈', null)}
    ${this.generatePageBreakdown(data)}

    <!-- Back to top link -->
    <div style="text-align: center; margin-top: 40px; padding: 20px;">
      <a href="#toc" style="color: #667eea; text-decoration: none; font-size: 2rem; display: inline-block;">⬆️</a>
    </div>

  </div>
</body>
</html>`;

    const filename = `${domain} ${filenameBrand} brand style guide colors.html`;
    downloadFile(html, filename, 'text/html');
    showSuccess('Brand Style Guides for Typography and Colors generated successfully!');
  }

	// Suggest contrast fix
		static suggestContrastFix(failure) {
			const textRgb = this.hexToRgb(failure.textColor);
			const bgRgb = this.hexToRgb(failure.backgroundColor);
			
			if (!textRgb || !bgRgb) {
				return `<div class="contrast-fix">💡 Fix: Increase contrast between text and background colors.</div>`;
			}
			
			// Calculate which is lighter using simple average
			const textLuminance = (textRgb.r + textRgb.g + textRgb.b) / 3;
			const bgLuminance = (bgRgb.r + bgRgb.g + bgRgb.b) / 3;
			
			// Check if background is white or near-white (average > 250)
			const isWhiteBackground = bgLuminance > 250;
			
			let suggestion = '';
			if (textLuminance > bgLuminance) {
				// Text is lighter than background (e.g., white text on colored background)
				// To improve contrast: darken the background
				suggestion = 'Consider using a darker background color.';
			} else {
				// Text is darker than background (e.g., dark text on light background)
				if (isWhiteBackground) {
					// Background is already white, can only darken text
					suggestion = 'Consider using darker text.';
				} else {
					// Background is not white, can darken text or lighten background
					suggestion = 'Consider using darker text or a lighter background color.';
				}
			}
			
			return `<div class="contrast-fix">💡 Fix: ${suggestion}</div>`;
		}

  // Generate page-by-page breakdown
  static generatePageBreakdown(data) {
    const pages = {};
    
    // Group colors by page
    Object.entries(data.colorData.colors).forEach(([color, colorData]) => {
      colorData.instances.forEach(instance => {
        if (!pages[instance.page]) {
          pages[instance.page] = {
            title: instance.pageTitle,
            colors: new Set()
          };
        }
        pages[instance.page].colors.add(color);
      });
    });
    
    if (Object.keys(pages).length === 0) {
      return '<div class="section"><p style="color: #718096;">No page distribution data available.</p></div>';
    }
    
    const pageCount = Object.keys(pages).length;
    return `
    <div class="section">
      <p style="color: #718096; margin-bottom: 20px;">Shows which colors appear on each page of your site.</p>
      <div class="accordion-container">
        <div class="accordion-header" onclick="this.parentElement.classList.toggle('open')">
          <div class="accordion-title">
            <span class="accordion-icon">▶</span>
            <span class="accordion-count">${pageCount} pages</span>
          </div>
        </div>
        <div class="accordion-content">
      ${Object.entries(pages).map(([url, pageData]) => `
        <div class="page-breakdown">
          <h3>${pageData.title}</h3>
          <div class="page-url">
            <strong>Page:</strong>
            <a href="${url}" target="_blank" style="color: #667eea; text-decoration: underline;">
              ${url}
            </a>
          </div>
          <div><strong>${pageData.colors.size} colors used on this page:</strong></div>
          <div class="page-colors">
            ${Array.from(pageData.colors).map(color => `
              <div class="page-color-item">
                <div class="page-color-swatch" style="background-color: ${color};"></div>
                <span style="font-family: monospace;">${color}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
        </div>
      </div>
    </div>
    `;
  }
}

// Make available globally
window.ExportStyleGuideColorsReport = ExportStyleGuideColorsReport;
