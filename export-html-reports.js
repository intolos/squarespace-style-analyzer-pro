// export-html-reports.js - HTML Report Export Functionality
// Handles generating and exporting HTML reports including Website Analysis,
// Quality Check reports, and Images Analysis reports

const ExportHTMLReports = {

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  // Escape HTML to prevent XSS
  escapeHtml: function(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // Check if mobile analysis was actually performed
  hasMobileAnalysisData: function(data) {
    if (!data) return false;

    const mobileIssues = data.mobileIssues;
    if (!mobileIssues) return false;

    // Check if there are any mobile issues
    const issues = mobileIssues.issues || [];
    if (issues.length > 0) return true;

    // Check if viewport meta was actually analyzed (content will not be null if analyzed)
    // When mobile analysis is performed, viewport.content will be a string (even if empty "")
    // When no mobile analysis is performed, content remains null (default state)
    const viewportMeta = mobileIssues.viewportMeta;
    if (viewportMeta && viewportMeta.content !== null) {
      return true; // Mobile analysis was performed
    }

    // If viewport exists but was never analyzed, mobile analysis was still performed
    if (viewportMeta && (viewportMeta.exists === true || viewportMeta.isProper === true)) {
      return true;
    }

    return false; // No mobile analysis was performed
  },

  // Get total count from data object with locations
  getTotalCount: function(dataObject) {
    let total = 0;
    for (const key in dataObject) {
      if (dataObject[key].locations) {
        total += dataObject[key].locations.length;
      }
    }
    return total;
  },

  // Extract font size from style definition string
  extractFontSize: function(styleDefinition) {
    if (!styleDefinition) return null;
    const match = styleDefinition.match(/font-size:\s*([0-9.]+)px/);
    return match ? parseFloat(match[1]) : null;
  },

  // Get most common font size for a heading type
  getMostCommonSize: function(data, headingType) {
    if (!data.headings[headingType] || !data.headings[headingType].locations) return null;
    
    const sizeCounts = {};
    let maxCount = 0;
    let mostCommonSize = null;
    
    for (const location of data.headings[headingType].locations) {
      const fontSize = this.extractFontSize(location.styleDefinition);
      if (fontSize) {
        sizeCounts[fontSize] = (sizeCounts[fontSize] || 0) + 1;
        if (sizeCounts[fontSize] > maxCount) {
          maxCount = sizeCounts[fontSize];
          mostCommonSize = fontSize;
        }
      }
    }
    
    return mostCommonSize;
  },

  // Download file helper
  downloadFile: function(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Build navigation order for all sections and subsections
  buildNavigationOrder: function(data) {
    const navOrder = [];
    
    // Headings section
    navOrder.push('headings-section');
    for (const type of ['heading-1', 'heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6']) {
      if (data.headings[type] && data.headings[type].locations && data.headings[type].locations.length > 0) {
        navOrder.push(type);
      }
    }
    
    // Paragraphs section
    navOrder.push('paragraphs-section');
    for (const type of ['paragraph-1', 'paragraph-2', 'paragraph-3']) {
      if (data.paragraphs[type] && data.paragraphs[type].locations && data.paragraphs[type].locations.length > 0) {
        navOrder.push(type);
      }
    }
    
    // Buttons section - enforce order: primary, secondary, tertiary, other
    navOrder.push('buttons-section');
    for (const type of ['primary', 'secondary', 'tertiary', 'other']) {
      if (data.buttons[type] && data.buttons[type].locations && data.buttons[type].locations.length > 0) {
        navOrder.push('button-' + type);
      }
    }
    
    // Links section
    navOrder.push('links-section');
    if (data.links && data.links['in-content'] && data.links['in-content'].locations && data.links['in-content'].locations.length > 0) {
      navOrder.push('in-content');
    }
    
    return navOrder;
  },
  
  // Get ordered entries for buttons (primary, secondary, tertiary, other)
  getOrderedButtonEntries: function(buttonsObj) {
    const orderedTypes = ['primary', 'secondary', 'tertiary', 'other'];
    const result = [];
    
    for (const type of orderedTypes) {
      if (buttonsObj[type] && buttonsObj[type].locations && buttonsObj[type].locations.length > 0) {
        result.push([type, buttonsObj[type]]);
      }
    }
    
    return result;
  },

  // Get next section ID from navigation order
  getNextSection: function(currentId, navOrder) {
    const idx = navOrder.indexOf(currentId);
    if (idx >= 0 && idx < navOrder.length - 1) {
      return navOrder[idx + 1];
    }
    return null;
  },

  // Generate section header with navigation arrows
  generateSectionHeaderWithNav: function(id, title, emoji, nextSectionId) {
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
  },

  // Generate subsection header with navigation arrows
  generateSubsectionHeaderWithNav: function(id, title, count, nextSectionId) {
    const arrows = nextSectionId 
      ? `<div>
          <a href="#toc" style="color: white; text-decoration: none; font-size: 1.2rem; margin-right: 10px;">⬆️</a>
          <a href="#${nextSectionId}" style="color: white; text-decoration: none; font-size: 1.2rem;">⬇️</a>
        </div>`
      : `<a href="#toc" style="color: white; text-decoration: none; font-size: 1.2rem;">⬆️</a>`;
    
    return `
      <div id="${id}" style="background: #667eea; color: white; padding: 15px 20px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; color: white; font-size: 1.3rem;">${title} <span style="font-weight: normal; font-size: 0.9rem;">(${count} instances)</span></h3>
        ${arrows}
      </div>
    `;
  },

  // ============================================
  // QUALITY CHECKS CALCULATION
  // ============================================

  calculateQualityChecks: function(data, filenameBrand) {
    const checks = [];
    let passedCount = 0;
    // totalChecks will be set after we determine if mobile analysis was performed
    let totalChecks = 9; // Default: all 9 checks
    const self = this;

    const domain = data.metadata.domain.replace(/^www\./, '');
    
    // Check 1: Missing H1
    const missingH1 = data.qualityChecks?.missingH1 || [];
    const allHaveH1 = missingH1.length === 0;
    
    checks.push({
      passed: allHaveH1,
      message: allHaveH1 ? 'All pages have H1 headings' : `${missingH1.length} page(s) missing H1 headings. <a href="#reports-nav" style="color: #667eea;">See the Styles Shown on Each Page report below.</a>`,
      details: allHaveH1 ? [] : missingH1.slice(0, 5).map(item => ({
        url: item.url,
        page: item.page,
        description: 'Missing H1 heading'
      }))
    });
    if (allHaveH1) passedCount++;
    
    // Check 2: Multiple H1
    const multipleH1 = data.qualityChecks?.multipleH1 || [];
    const noMultipleH1 = multipleH1.length === 0;
    
    checks.push({
      passed: noMultipleH1,
      message: noMultipleH1 ? 'No pages have multiple H1 headings' : `${multipleH1.length} page(s) have multiple H1 headings. <a href="#reports-nav" style="color: #667eea;">See the Styles Shown on Each Page report below.</a>`,
      details: noMultipleH1 ? [] : multipleH1.slice(0, 5).map(item => ({
        url: item.url,
        page: item.page,
        description: `Multiple H1 headings (${item.count} found)`
      }))
    });
    if (noMultipleH1) passedCount++;
    
    // Check 3: Broken Heading Hierarchy
    const brokenHierarchy = data.qualityChecks?.brokenHeadingHierarchy || [];
    const hierarchyCorrect = brokenHierarchy.length === 0;
    
    if (brokenHierarchy.length > 5) {
      this.exportQualityCheckReport(data, 'brokenHeadingHierarchy', brokenHierarchy, domain, filenameBrand);
      checks.push({
        passed: false,
        message: `${brokenHierarchy.length} heading hierarchy issue(s) found. See downloaded Heading Hierarchy report.`,
        details: []
      });
    } else {
      checks.push({
        passed: hierarchyCorrect,
        message: hierarchyCorrect ? 'Heading hierarchy is correct on all pages' : `${brokenHierarchy.length} heading hierarchy issue(s) found. <a href="#reports-nav" style="color: #667eea;">See Aggregated Styles Report below.</a>`,
        details: hierarchyCorrect ? [] : brokenHierarchy.map(item => ({
          url: item.url,
          page: item.page,
          description: item.description || item.issue || 'Broken heading hierarchy'
        }))
      });
    }
    if (hierarchyCorrect) passedCount++;
    
    // Check 4: Typography Style Inconsistency (checks ALL style properties except colors)
    if (!data.qualityChecks) data.qualityChecks = {};
    data.qualityChecks.styleInconsistency = [];
    
    // Helper to check style variations for any element type
    const checkStyleVariations = (dataObj, categoryName) => {
      for (const itemType in dataObj) {
        if (!dataObj[itemType] || !dataObj[itemType].locations) continue;
        
        const locations = dataObj[itemType].locations;
        if (locations.length === 0) continue;
        
        const variationCount = StyleComparisonUtils.getVariationCount(locations);
        
        if (variationCount >= 2) {
          let label;
          if (categoryName === 'Button') {
            // Title case + "Button" suffix (e.g., "Primary Button")
            label = itemType.charAt(0).toUpperCase() + itemType.slice(1) + ' Button';
          } else {
            label = itemType.replace('heading-', 'H').replace('paragraph-', 'P').toUpperCase();
          }
          
          const issueText = `${label} has ${variationCount} style variations (${locations.length} total instances)`;
          const description = `${label} uses ${variationCount} different styles. <a href="#reports-nav" style="color: #667eea;">See Aggregated Styles Report below.</a>`;
          
          data.qualityChecks.styleInconsistency.push({
            url: '',
            page: 'All Pages',
            issue: issueText,
            description: description,
            elementType: itemType,
            variationCount: variationCount,
            totalInstances: locations.length
          });
        }
      }
    };
    
    checkStyleVariations(data.headings, 'Heading');
    checkStyleVariations(data.paragraphs, 'Paragraph');
    checkStyleVariations(data.buttons, 'Button');
    
    // Check hierarchical issues (H3 shouldn't be bigger than H2, etc.)
    const headingComparisons = [
      { higher: 'heading-1', lower: 'heading-2', higherLabel: 'H1', lowerLabel: 'H2' },
      { higher: 'heading-2', lower: 'heading-3', higherLabel: 'H2', lowerLabel: 'H3' },
      { higher: 'heading-3', lower: 'heading-4', higherLabel: 'H3', lowerLabel: 'H4' },
      { higher: 'heading-4', lower: 'heading-5', higherLabel: 'H4', lowerLabel: 'H5' },
      { higher: 'heading-5', lower: 'heading-6', higherLabel: 'H5', lowerLabel: 'H6' }
    ];

    for (const comparison of headingComparisons) {
      const higherSize = this.getMostCommonSize(data, comparison.higher);
      const lowerSize = this.getMostCommonSize(data, comparison.lower);
      
      if (higherSize && lowerSize) {
        const higherSizeNum = parseFloat(higherSize);
        const lowerSizeNum = parseFloat(lowerSize);
        
        if (lowerSizeNum > higherSizeNum) {
          const issueText = `${comparison.lowerLabel} (${lowerSize}px) is larger than ${comparison.higherLabel} (${higherSize}px)`;
          const description = `${comparison.higherLabel} should be larger than ${comparison.lowerLabel}. Heading sizes should decrease as level increases.`;
          
          data.qualityChecks.styleInconsistency.push({
            url: '',
            page: 'All Pages',
            issue: issueText,
            description: description,
            higherLevel: comparison.higherLabel,
            higherSize: higherSize,
            lowerLevel: comparison.lowerLabel,
            lowerSize: lowerSize
          });
        }
      }
    }
    
    const allStyleInconsistencies = data.qualityChecks.styleInconsistency;
    const allStylesConsistent = allStyleInconsistencies.length === 0;
    
    // Show up to 5 details inline, with message about remaining
    const displayedInconsistencies = allStyleInconsistencies.slice(0, 5);
    const remainingCount = allStyleInconsistencies.length - 5;
    
    let details = displayedInconsistencies.map(item => ({
      url: item.url,
      page: item.page,
      description: item.description || item.issue
    }));
    
    // Add "and X more" message if there are more than 5
    if (remainingCount > 0) {
      details.push({
        url: '',
        page: '',
        description: `...and ${remainingCount} more. <a href="#reports-nav" style="color: #667eea;">See Aggregated Styles Report below.</a>`
      });
    }
    
    checks.push({
      passed: allStylesConsistent,
      message: allStylesConsistent 
        ? 'Typography Styles are consistent across all headings, paragraphs, and buttons' 
        : `Typography Style Inconsistencies in ${allStyleInconsistencies.length} element type(s)`,
      details: allStylesConsistent ? [] : details
    });
    
    if (allStylesConsistent) passedCount++;
    
    // Check 5: Link Styling Consistency
    const linkLocations = (data.links && data.links['in-content'] && data.links['in-content'].locations) 
      ? data.links['in-content'].locations 
      : [];
    
    let linkStylesConsistent = true;
    let linkVariationCount = 0;
    let linkInconsistencyDetails = [];
    
    if (linkLocations.length > 0) {
      linkVariationCount = StyleComparisonUtils.getVariationCount(linkLocations);
      linkStylesConsistent = linkVariationCount <= 1;
      
      if (!linkStylesConsistent) {
        linkInconsistencyDetails.push({
          url: '',
          page: 'All Pages',
          description: `Links use ${linkVariationCount} different styles (${linkLocations.length} total instances). <a href="#reports-nav" style="color: #667eea;">See the Aggregated Styles Report below.</a>`
        });
      }
    }
    
    checks.push({
      passed: linkStylesConsistent,
      message: linkLocations.length === 0 
        ? 'No in-content links found to analyze'
        : linkStylesConsistent 
          ? 'Link styling is consistent across all pages' 
          : `Link styling inconsistencies found (${linkVariationCount} variations)`,
      details: linkInconsistencyDetails
    });
    
    if (linkStylesConsistent) passedCount++;
    
    // Check 6: Missing Alt Text
    const images = data.images || [];
    
    // Helper function to check if image source is likely an icon
    const isLikelyIconSrc = (src) => {
      if (!src) return false;
      
      // Extract filename without query params
      const cleanUrl = src.split('?')[0].split('#')[0];
      const urlParts = cleanUrl.split('/');
      const filename = urlParts[urlParts.length - 1];
      
      // Check if "icon" appears in filename
      if (filename.toLowerCase().includes('icon')) {
        return true;
      }
      
      // Check if path contains /icons/
      const lowerPath = src.toLowerCase();
      if (lowerPath.includes('/icons/') || lowerPath.includes('/assets/icons/') || 
          lowerPath.includes('/images/icons/') || lowerPath.includes('/img/icons/')) {
        return true;
      }
      
      return false;
    };
    
    const imagesWithoutAlt = images.filter(img => 
      (!img.alt || img.alt === '(missing alt text)') && 
      img.src && img.src.trim() !== '' &&
      !isLikelyIconSrc(img.src)
    );
    const allHaveAlt = imagesWithoutAlt.length === 0;
    
    const genericImageNames = data.qualityChecks?.genericImageNames || [];
    if (imagesWithoutAlt.length > 5 || genericImageNames.length > 5) {
      ExportImagesReport.export(data, imagesWithoutAlt, genericImageNames, filenameBrand, this.downloadFile.bind(this));
      checks.push({
        passed: false,
        message: `${imagesWithoutAlt.length} image(s) missing alt text. See downloaded Images Analysis report.`,
        details: []
      });
    } else {
      checks.push({
        passed: allHaveAlt,
        message: allHaveAlt ? 'All images have alt text' : `${imagesWithoutAlt.length} image(s) missing alt text`,
        details: allHaveAlt ? [] : imagesWithoutAlt.map(img => ({
          url: img.url || window.location.href,
          page: img.navigationName || 'Unknown',
          description: `Image missing alt text: <a href="${img.src}" target="_blank" style="color: #667eea; text-decoration: underline;">${img.src || 'Unknown source'}</a>`
        }))
      });
    }
    if (allHaveAlt) passedCount++;
    
    // Check 7: Generic Image File Names
    const allDescriptiveNames = genericImageNames.length === 0;
    
    if (genericImageNames.length > 5) {
      // Will be included in Images Analysis report
      checks.push({
        passed: false,
        message: `${genericImageNames.length} image(s) have generic file names. See downloaded Images Analysis report.`,
        details: []
      });
    } else {
      checks.push({
        passed: allDescriptiveNames,
        message: allDescriptiveNames ? 'All images have descriptive file names' : `${genericImageNames.length} image(s) have generic file names`,
        details: allDescriptiveNames ? [] : genericImageNames.map(img => ({
          url: img.url,
          page: img.navigationName || 'Unknown',
          description: `${img.filename} (${img.pattern})`
        }))
      });
    }
    if (allDescriptiveNames) passedCount++;
    
    // Check 8: Color Consistency
    if (data.colorData && data.colorData.colors) {
      const analysis = window.ExportStyleGuideColorsReport.analyzeColorConsistency(data);
      const colorScore = analysis.score;
      
      if (colorScore < 7) {
        checks.push({
          passed: false,
          message: `Color consistency: ${colorScore}/10 - ${analysis.issues.length + analysis.warnings.length} issue(s). See downloaded Brand Style Guide Colors report.`,
          details: analysis.issues.concat(analysis.warnings).map(issue => ({
            url: data.metadata?.url || '',
            page: 'All Pages',
            description: issue
          }))
        });
      } else {
        checks.push({
          passed: true,
          message: `Color Consistency Score: ${colorScore}/10. See Brand Style Guide Colors report for details.<br />Also, includes Quality Check for Accessibility for color contrast between text and background colors.`,
          details: []
        });
        passedCount++;
      }
    } else {
      checks.push({
        passed: true,
        message: 'Color analysis data not available',
        details: []
      });
      passedCount++;
    }

    // Check 8: Mobile Usability
    // First check if mobile analysis was actually performed
    const mobileAnalysisPerformed = this.hasMobileAnalysisData(data);

    if (!mobileAnalysisPerformed) {
      // No mobile analysis was performed - use only 8 checks for percentage calculation
      // Don't increment passedCount - we want to exclude this check entirely from the score
      totalChecks = 8;
      checks.push({
        passed: true,
        message: 'Mobile Usability was not analyzed',
        details: []
      });
      // Note: No passedCount++ here - we exclude this from the calculation entirely
    } else {
      // Mobile analysis was performed - show results
      const mobileIssues = data.mobileIssues?.issues || [];
      const mobileErrors = mobileIssues.filter(issue => issue.severity === 'error');
      const mobileWarnings = mobileIssues.filter(issue => issue.severity === 'warning');
      const hasMobileIssues = mobileErrors.length > 0;

      // Always show up to 5 issues in the quality check details
      // User can click the Mobile Report button to export the full report
      const displayedIssues = mobileIssues.slice(0, 5);
      const hasMoreIssues = mobileIssues.length > 5;

      checks.push({
        passed: !hasMobileIssues,
        message: mobileIssues.length === 0
          ? 'Mobile Usability checks passed - no issues detected'
          : hasMobileIssues
            ? `Mobile Usability issues found (${mobileErrors.length} errors, ${mobileWarnings.length} warnings)${hasMoreIssues ? `. Showing first 5 of ${mobileIssues.length} issues. Click the Mobile Report button to export the full report.` : ''}`
            : `Mobile Usability warnings found (${mobileWarnings.length})${hasMoreIssues ? `. Showing first 5 of ${mobileIssues.length} warnings. Click the Mobile Report button to export the full report.` : ''}`,
        details: displayedIssues.map(issue => ({
          url: issue.url,
          page: issue.navigationName || 'Unknown',
          description: ExportMobileReport.formatIssueDescription(issue)
        }))
      });

      if (!hasMobileIssues) passedCount++;
    }

    const score = Math.round((passedCount / totalChecks) * 100);
    
    return { score, checks };
  },

  // ============================================
  // QUALITY CHECK REPORT EXPORT
  // ============================================

  exportQualityCheckReport: function(data, checkType, issues, domain, filenameBrand) {
    let reportTitle = '';
    let checkDescription = '';
    let iconEmoji = '';
    
    if (checkType === 'missingH1') {
      iconEmoji = '❌';
      reportTitle = `${domain} Missing H1`;
      checkDescription = 'Pages Missing H1 Headings';
    } else if (checkType === 'multipleH1') {
      iconEmoji = '⚠️';
      reportTitle = `${domain} Multiple H1`;
      checkDescription = 'Pages with Multiple H1 Headings';
    } else if (checkType === 'brokenHeadingHierarchy') {
      iconEmoji = '🔺';
      reportTitle = `${domain} Heading Hierarchy`;
      checkDescription = 'Broken Heading Hierarchy Issues';
    } else if (checkType === 'fontSizeInconsistency' || checkType === 'styleInconsistency') {
      iconEmoji = '⚖️';
      reportTitle = `${domain} Style Inconsistency`;
      checkDescription = 'Style Inconsistency Issues';
    }
    
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${reportTitle}</title>
  <link rel="icon" type="image/png" href="https://intolos.github.io/squarespace-style-analyzer-pro/icon32.png">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }   
    .header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 3px solid #667eea; }
    .header h1 { font-size: 2.7rem; margin: 0 0 10px 0; color: #2d3748; }
    .header p { color: #7180D8; font-size: 1.8rem; }
    .section { margin-bottom: 50px; }
    .section-title { font-size: 2rem; color: #2d3748; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; word-break: break-all; }
    th { background: #667eea; color: white; padding: 15px; text-align: left; font-weight: 600; }
    td { padding: 15px; border-bottom: 1px solid #e2e8f0; word-break: break-all; overflow-wrap: anywhere; white-space: normal; }
    tr:hover { background: #f7fafc; }
    a { color: #667eea; text-decoration: none; word-break: break-all; }
    a:hover { text-decoration: underline; }
    @media print { body { padding: 20px; } .container { box-shadow: none; padding: 30px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${iconEmoji} ${reportTitle}</h1>
      <p>Professional Design Audit by Squarespace Style Analyzer Pro</p>
      <p><span style="font-size: 1.2rem;">Generated on ${new Date().toLocaleString()}</span></p>
    </div>
    <div class="header-line"></div>

    <div class="section">
      <h2 class="section-title">${checkDescription} (${issues.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Page URL</th>
            <th>Issue Description</th>
          </tr>
        </thead>
        <tbody>
          ${issues.sort((a, b) => a.url.localeCompare(b.url)).map(issue => `
            <tr>
              <td><a href="${issue.url}" target="_blank">${issue.url}</a></td>
              <td>${issue.description || issue.issue || 'Issue detected'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;

    const filename = `${domain} ${filenameBrand} ${checkDescription.toLowerCase().replace(/\s+/g, '-')}.html`;
    this.downloadFile(html, filename, 'text/html');
  },

  // ============================================
  // HTML SECTION GENERATORS WITH NAVIGATION
  // ============================================

  generateHTMLSectionWithSubheadersAndNav: function(sectionName, dataObj, showText, navOrder) {
    if (!dataObj || Object.keys(dataObj).length === 0) {
      return `<p style="color: #718096;">No data found for this section.</p>`;
    }

    const self = this;
    let html = '';
    
    // Use ordered entries for Buttons, otherwise use Object.entries
    let entries;
    if (sectionName === 'Buttons') {
      entries = this.getOrderedButtonEntries(dataObj);
    } else if (sectionName === 'Links') {
      entries = Object.entries(dataObj).map(([key, value]) => {
        return [key, { ...value, displayName: 'In-Content Links' }];
      });
    } else {
      entries = Object.entries(dataObj);
    }
    
    for (const [itemName, itemData] of entries) {
      if (!itemData.locations || itemData.locations.length === 0) continue;
      
      const anchorId = sectionName === 'Buttons' ? `button-${itemName}` : itemName;
      const nextSectionId = this.getNextSection(anchorId, navOrder);
      
      // Use displayName if available (for Links), otherwise format itemName
      const displayLabel = itemData.displayName || itemName.toUpperCase().replace(/-/g, ' ');
      
      html += `<div style="margin-bottom: 40px;">`;
      html += this.generateSubsectionHeaderWithNav(
        anchorId, 
        displayLabel, 
        itemData.locations.length,
        nextSectionId
      );
      
      html += `<div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 5px solid #667eea;">`;
      html += `<div class="locations">`;
      
      // Group locations by URL + styleDefinition
      const groupedLocations = this.groupLocationsByUrlAndStyle(itemData.locations);
      
      for (const group of groupedLocations) {
        // Determine if we have multiple style groups for this URL - find all differing properties
        const allDifferingProps = groupedLocations.length > 1 
          ? StyleComparisonUtils.getAllDifferingProperties(groupedLocations) 
          : [];
        
        if (group.instances.length === 1) {
          // Single instance - no accordion needed
          const location = group.instances[0];
          html += `<div class="location">`;
          html += `<div class="location-header">📍 ${self.escapeHtml(location.navigationName || 'Unknown')} — <a href="${self.escapeHtml(location.url)}" target="_blank" style="color: #667eea; text-decoration: underline;">${self.escapeHtml(location.url)}</a></div>`;
          
          if (showText && location.text) {
            const displayText = self.escapeHtml(location.text.substring(0, 150));
            html += `<div class="location-text">"${displayText}${location.text.length > 150 ? '...' : ''}"</div>`;
          }
          
          if (location.styleDefinition) {
            // Highlight differing properties if there are multiple style groups on this page
            const formattedStyle = allDifferingProps.length > 0
              ? StyleComparisonUtils.formatStyleWithDifferences(location.styleDefinition, allDifferingProps, self.escapeHtml.bind(self))
              : StyleComparisonUtils.formatStyleWithoutColors(location.styleDefinition, self.escapeHtml.bind(self));
            html += `<div class="location-style">Style: ${formattedStyle}</div>`;
          }
          
          html += `</div>`;
        } else {
          // Multiple instances with same style - use accordion
          const uniqueId = 'accordion-' + Math.random().toString(36).substr(2, 9);
          const firstLocation = group.instances[0];
          
          html += `<div class="location accordion-container">`;
          html += `<div class="accordion-header" onclick="this.parentElement.classList.toggle('open')">`;
          html += `<div class="accordion-title">`;
          html += `<span class="accordion-label">📍 ${self.escapeHtml(firstLocation.navigationName || 'Unknown')} — <a href="${self.escapeHtml(firstLocation.url)}" target="_blank" style="color: #667eea; text-decoration: underline;" onclick="event.stopPropagation();">${self.escapeHtml(firstLocation.url)}</a></span>`;
          html += `<span class="accordion-icon">▶</span>`;
          html += `<span class="accordion-count">${group.instances.length} instances</span>`;
          html += `</div>`;
          if (firstLocation.styleDefinition) {
            // Highlight differing properties if there are multiple style groups on this page
            const formattedStyle = allDifferingProps.length > 0
              ? StyleComparisonUtils.formatStyleWithDifferences(firstLocation.styleDefinition, allDifferingProps, self.escapeHtml.bind(self))
              : StyleComparisonUtils.formatStyleWithoutColors(firstLocation.styleDefinition, self.escapeHtml.bind(self));
            html += `<div class="location-style" style="margin-top: 8px;">Style: ${formattedStyle}</div>`;
          }
          html += `</div>`;
          
          html += `<div class="accordion-content">`;
          for (let i = 0; i < group.instances.length; i++) {
            const location = group.instances[i];
            html += `<div class="accordion-item">`;
            html += `<div class="accordion-item-number">#${i + 1}</div>`;
            
            if (showText && location.text) {
              const displayText = self.escapeHtml(location.text.substring(0, 150));
              html += `<div class="location-text">"${displayText}${location.text.length > 150 ? '...' : ''}"</div>`;
            }
            
            html += `</div>`;
          }
          html += `</div>`;
          html += `</div>`;
        }
      }
      
      html += `</div></div></div>`;
    }
    
    return html;
  },

  // Group locations by URL and styleDefinition
  groupLocationsByUrlAndStyle: function(locations) {
    const groups = {};
    
    for (const location of locations) {
      const key = (location.url || '') + '|||' + (location.styleDefinition || '');
      
      if (!groups[key]) {
        groups[key] = {
          url: location.url,
          styleDefinition: location.styleDefinition,
          instances: []
        };
      }
      
      groups[key].instances.push(location);
    }
    
    // Convert to array and sort by URL
    return Object.values(groups).sort((a, b) => (a.url || '').localeCompare(b.url || ''));
  },

  // ============================================
  // MAIN HTML REPORT EXPORT
  // ============================================

  export: function(accumulatedResults, filenameBrand, showSuccess, showError) {
    if (!accumulatedResults) {
      customAlert('No data to export. Please analyze a page first.');
      return;
    }

    const data = accumulatedResults;
    const domain = data.metadata.domain.replace(/^www\./, '');
    const pagesAnalyzed = data.metadata.pagesAnalyzed || [];
    
    const qualityChecks = this.calculateQualityChecks(data, filenameBrand);
    const qualityScore = qualityChecks.score;
    const scoreColor = qualityScore === 100 ? '#48bb78' : qualityScore >= 80 ? '#ed8936' : '#e53e3e';
    const self = this;
    
    // Build navigation order for all sections and subsections
    const navOrder = this.buildNavigationOrder(data);
    
    // Generate aggregated styles report content
    const aggregatedReportContent = ExportAggregatedStylesReport.generate(data, this.escapeHtml.bind(this));
    const aggregatedTOC = ExportAggregatedStylesReport.generateTOC(data);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${domain} Website Analysis</title>
  <link rel="icon" type="image/png" href="https://intolos.github.io/squarespace-style-analyzer-pro/icon32.png">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; line-height: 1.4; background: #f8fafc; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }    
    .header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 3px solid #667eea; }
    .header h1 { font-size: 2.7rem; margin: 0 0 0px 0; color: #2d3748; }
    .header p { color: #7180D8; font-size: 1.8rem; }
    .quality-score { background: white; border-radius: 12px; padding: 30px; margin-bottom: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
    .quality-score h2 { margin: 0 0 30px 0; color: #2d3748; font-size: 2rem; }
    .score-circle { width: 150px; height: 150px; border-radius: 50%; background: ${scoreColor}; color: white; display: flex; align-items: center; justify-content: center; font-size: 3rem; font-weight: bold; margin: 0 auto 30px; }
    .quality-checks { text-align: left; max-width: 600px; margin: 0 auto; }
    .quality-check { padding: 15px 20px; margin: 10px 0; border-radius: 8px; font-size: 1rem; }
    .quality-check.pass { background: #c6f6d5; color: #22543d; }
    .quality-check.fail { background: #fed7d7; color: #9b2c2c; }
    .quality-check::before { margin-right: 10px; font-weight: bold; }
    .quality-check.pass::before { content: '✔'; }
    .quality-check.fail::before { content: '✗'; }
    .quality-details { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.1); font-size: 0.9rem; }
    .quality-detail-item { padding: 6px 0; }
    .quality-url { color: #667eea; text-decoration: none; font-weight: 600; }
    .quality-url:hover { text-decoration: underline; }
    .metadata { background: #e9ecef; padding: 25px; border-radius: 8px; margin-bottom: 40px; }
    .metadata h2 { margin-top: 0; color: #2d3748; }
    .metadata-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 20px; }
    .metadata-item { background: white; padding: 15px; border-radius: 6px; }
    .metadata-label { font-weight: 600; color: #4a5568; margin-bottom: 5px; }
    .metadata-value { color: #2d3748; }
    .section { margin-bottom: 50px; }
    .section h2 { color: #2d3748; border-bottom: 3px solid #667eea; padding-bottom: 15px; margin-bottom: 25px; font-size: 1.8rem; }
    .item { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 5px solid #667eea; }
    .item-title { font-weight: bold; font-size: 1.3em; color: #495057; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
    .item-count { background: #667eea; color: white; padding: 5px 15px; border-radius: 20px; font-size: 0.8em; }
    .locations { margin-top: 15px; }
    .location { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border: 1px solid #dee2e6; }
    .location-header { font-weight: 600; color: #6c757d; margin-bottom: 8px; font-size: 0.95em; }
    .location-text { font-style: italic; color: #868e96; margin: 8px 0; padding: 10px; background: #f1f3f5; border-radius: 4px; }
    .location-style { font-size: 0.85em; color: #495057; margin-top: 8px; padding: 8px; background: #fff3cd; border-radius: 4px; font-family: 'Courier New', monospace; }
    .accordion-container { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .accordion-header { padding: 15px; background: #edf2f7; cursor: pointer; transition: background 0.2s ease; }
    .accordion-header:hover { background: #e2e8f0; }
    .accordion-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .accordion-icon { font-size: 1.3rem; color: #667eea; transition: transform 0.2s ease; }
    .accordion-container.open .accordion-icon { transform: rotate(90deg); }
    .accordion-label { font-weight: 600; color: #4a5568; }
    .accordion-count { background: #667eea; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; }
    .accordion-content { display: none; padding: 0; background: white; }
    .accordion-container.open .accordion-content { display: block; }
    .accordion-item { padding: 12px 15px; border-top: 1px solid #e2e8f0; display: flex; align-items: flex-start; gap: 12px; }
    .accordion-item:hover { background: #f7fafc; }
    .accordion-item-number { background: #667eea; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; flex-shrink: 0; }
    .report-title { text-align: center; margin: 60px 0 40px 0; }
    .report-title h2 { font-size: 2.2rem; color: #667eea; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px; }
    .report-title h3 { font-size: 2.2rem; color: #667eea; margin: 0; font-weight: 700; letter-spacing: 2px; }
    .report-divider { margin: 80px 0; text-align: center; position: relative; }
    .report-divider::before { content: ''; position: absolute; top: 50%; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, transparent, #667eea, #764ba2, #667eea, transparent); }
    .report-divider-icon { background: white; padding: 0 30px; position: relative; font-size: 2.5rem; }
    .reports-nav { background: linear-gradient(135deg, #5562D8 0%, #764ba2 100%); padding: 25px; border-radius: 12px; margin-bottom: 40px; }
    .reports-nav h3 { color: white; margin: 0 0 15px 0; font-size: 1.5rem; text-align: center; }
    .reports-nav-links { display: flex; flex-direction: column; gap: 12px; }
    .reports-nav-link { font-size: 1.3rem; background: rgba(255,255,255,0.10); padding: 15px 20px; border-radius: 8px; text-decoration: none; color: white; font-weight: 600; transition: all 0.2s ease; display: block; }
    .reports-nav-link:hover { transform: translateX(5px); }
    .reports-nav-link span { display: block; font-size: 1.1rem; font-weight: normal; opacity: 0.9; margin-top: 4px; }
    @media print { body { margin: 0; } .container { box-shadow: none; } .accordion-content { display: block !important; } .accordion-icon { display: none; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔬 ${domain} Website Analysis</h1>
      <p>Professional Design Audit by Squarespace Style Analyzer Pro</p>
      <p><span style="font-size: 1.2rem;">Generated on ${new Date().toLocaleString()}</span></p>
    </div>
    <div class="header-line"></div>
    
    <div class="quality-score">
      <h2>Quality Score</h2>
      <div class="score-circle">${qualityScore}%</div>
      <div class="quality-checks">
        ${qualityChecks.checks.map(check => {
          let checkHtml = `<div class="quality-check ${check.passed ? 'pass' : 'fail'}">${check.message}`;
          
          if (check.details && check.details.length > 0) {
            checkHtml += `<div class="quality-details">`;
            for (const detail of check.details) {
              checkHtml += `<div class="quality-detail-item">`;
              if (detail.page && detail.page !== 'All Pages' && detail.url) {
                checkHtml += `<a href="${self.escapeHtml(detail.url)}" target="_blank" class="quality-url">${self.escapeHtml(detail.page)}</a> - `;
              }
              if (detail.description && detail.description.includes('<a href=')) {
                checkHtml += detail.description;
              } else {
                checkHtml += self.escapeHtml(detail.description);
              }
              checkHtml += `</div>`;
            }
            checkHtml += `</div>`;
          }
          
          checkHtml += `</div>`;
          return checkHtml;
        }).join('')}
      </div><br />
				<div class="metadata" style="background: #667EEA; padding: 10px; margin-bottom: 20px;"><div class="metadata-item" style="font-size: 0.9rem;">NOTE: The purpose of our Design Audit reports is to reveal the “issues” about your website so you can decide if they are valid by design or if they are oversights. At times, there may be reasons for visual content outside “typical” styling. And at other times, visual content may simply not be adhering to your own standards or multiple people may not be acting in synchronization. We also want you to know that Squarespace code is not always easy to analyze. Our coding in this extension includes numerous situations to catch all possibilities for the aspects being analyzed. Although it may not be absolutely perfect in all situations it will be extremely close and a huge guide for your understanding.</div>
				</div>
    </div>
    
    <div class="metadata">
      <h2>📋 Analysis Summary</h2>
      <div class="metadata-grid">
        <div class="metadata-item">
          <div class="metadata-label">Domain</div>
          <div class="metadata-value">${domain}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Pages Analyzed</div>
          <div class="metadata-value">${pagesAnalyzed.length}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Total Headings</div>
          <div class="metadata-value">${this.getTotalCount(data.headings)}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Total Paragraphs</div>
          <div class="metadata-value">${this.getTotalCount(data.paragraphs)}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Total Buttons</div>
          <div class="metadata-value">${this.getTotalCount(data.buttons)}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Analysis Date</div>
          <div class="metadata-value">${new Date(data.metadata.timestamp).toLocaleDateString()}</div>
        </div>
      </div>
      <div style="margin-top: 20px;">
        <div class="metadata-label">Pages Included:</div>
        <div class="metadata-value">${pagesAnalyzed.join(', ')}</div>
      </div>
    </div>

    <!-- Reports Navigation -->
    <div id="reports-nav" class="reports-nav">
      <h3>📊 Typography Style Consistency Reports</h3>
      <div class="reports-nav-links">
        <a href="#aggregated-report" class="reports-nav-link">
          📈 Typography Styles Consistency Audit — Organized by Styles, Aggregated for All Pages
          <span>Compare style variations across your entire site</span>
        </a>
        <a href="#page-report-start" class="reports-nav-link">
          📄 Typography Styles Consistency Audit — Organized by Styles Shown on Each Page
          <span>View styles page-by-page with detailed locations</span>
        </a>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- REPORT 1: Aggregated by Styles -->
    <!-- ========================================== -->
    
    <div id="aggregated-report" class="report-title">
      <h2>✨ Typography Styles Consistency Audit ✨</h2>
      <h3>Organized by Styles — Aggregated for All Pages</h3>
    </div>
    
    ${aggregatedTOC}
    
    ${aggregatedReportContent}

    <!-- ========================================== -->
    <!-- DIVIDER -->
    <!-- ========================================== -->
    
    <div class="report-divider">
      <span class="report-divider-icon">◆ ◆ ◆</span>
    </div>

    <!-- ========================================== -->
    <!-- REPORT 2: Page by Page -->
    <!-- ========================================== -->
    
    <div id="page-report-start" class="report-title">
      <h2>✨ Typography Styles Consistency Audit ✨</h2>
      <h3>Organized by Styles Shown on Each Page</h3>
    </div>

    ${ExportPageByPageReport.generateTOC(data, this.escapeHtml.bind(this))}
    
    ${ExportPageByPageReport.generate(data, this.escapeHtml.bind(this))}
  </div>
</body>
</html>`;

    const filename = `${domain} ${filenameBrand} website analysis.html`;
    this.downloadFile(html, filename, 'text/html');
    showSuccess('HTML Report exported successfully!');
  }
};

// Make globally available
window.ExportHTMLReports = ExportHTMLReports;
