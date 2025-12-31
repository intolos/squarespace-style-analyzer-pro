// export-aggregated-styles-report.js - Aggregated Styles Report Generator
// Single Responsibility: Generate the "Organized by Styles, Aggregated for All Pages" report

const ExportAggregatedStylesReport = {

  // Generate section header with navigation arrows
  generateSectionHeader: function(id, title, emoji, nextSectionId) {
    const arrows = nextSectionId 
      ? `<div>
          <a href="#agg-toc" style="color: white; text-decoration: none; font-size: 1.5rem; margin-right: 15px;">⬆️</a>
          <a href="#${nextSectionId}" style="color: white; text-decoration: none; font-size: 1.5rem;">⬇️</a>
        </div>`
      : `<a href="#agg-toc" style="color: white; text-decoration: none; font-size: 1.5rem;">⬆️</a>`;
    
    return `
      <div id="${id}" style="background: #667eea; color: white; padding: 20px; border-radius: 8px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="margin: 0; color: white; border: none; padding: 0;">${emoji} ${title}</h2>
        ${arrows}
      </div>
    `;
  },

  // Generate a single type section with navigation (e.g., H1, P2, Primary Button)
  generateTypeSectionWithNav: function(typeName, typeLabel, locations, escapeHtmlFn, sectionId, nextSectionId) {
    const styleGroups = StyleComparisonUtils.groupByStyleDefinition(locations);
    const hasVariations = styleGroups.length > 1;
    const baseline = styleGroups.length > 0 ? styleGroups[0].styleWithoutColors : null;
    
    // Navigation arrows
    const arrows = `
      <div style="flex-shrink: 0;">
        <a href="#agg-toc" style="color: #667eea; text-decoration: none; font-size: 1.1rem; margin-right: 8px;">⬆️</a>
        ${nextSectionId ? `<a href="#${nextSectionId}" style="color: #667eea; text-decoration: none; font-size: 1.1rem;">⬇️</a>` : ''}
      </div>
    `;
    
    let html = `<div id="${sectionId}" style="margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 5px solid ${hasVariations ? '#e53e3e' : '#48bb78'};">`;
    html += `<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">`;
    html += `<h3 style="margin: 0; color: #2d3748;">${typeLabel} `;
    html += `<span style="font-size: 0.85rem; font-weight: normal; color: ${hasVariations ? '#e53e3e' : '#48bb78'};">`;
    
    if (locations.length === 0) {
      html += '(not used)';
    } else {
      html += `(${locations.length} instance${locations.length === 1 ? '' : 's'}`;
      html += hasVariations ? `, ${styleGroups.length} variations)` : ', consistent)';
    }
    html += `</span></h3>`;
    html += arrows;
    html += `</div>`;
    
    if (locations.length === 0) {
      html += `<p style="color: #718096; margin: 0;">Not used on any analyzed pages.</p>`;
    } else {
      for (let i = 0; i < styleGroups.length; i++) {
        const group = styleGroups[i];
        const isBaseline = i === 0;
        const differences = isBaseline ? [] : StyleComparisonUtils.getStyleDifferences(baseline, group.styleWithoutColors);
        
        html += `<div class="location accordion-container" style="margin-bottom: 10px;">`;
        html += `<div class="accordion-header" onclick="this.parentElement.classList.toggle('open')">`;
        html += `<div class="accordion-title">`;
        html += `<span class="accordion-label">`;
        
        if (isBaseline) {
          html += `<span style="background: #48bb78; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-right: 8px;">BASELINE (most common)</span>`;
        } else {
          html += `<span style="background: #e53e3e; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-right: 8px;">VARIATION ${i}</span>`;
        }
        
        html += `</span>`;
        html += `<span class="accordion-icon">▶</span>`;
        html += `<span class="accordion-count">${group.instances.length} instance${group.instances.length === 1 ? '' : 's'}</span>`;
        html += `</div>`;
        
        // Show style (with differences bolded for variations)
        const formattedStyle = isBaseline 
          ? StyleComparisonUtils.formatStyleWithoutColors(group.styleDefinition, escapeHtmlFn)
          : StyleComparisonUtils.formatStyleWithDifferences(group.styleDefinition, differences, escapeHtmlFn);
        html += `<div class="location-style" style="margin-top: 8px;">Style: ${formattedStyle}</div>`;
        html += `</div>`;
        
        // Accordion content - list of instances
        html += `<div class="accordion-content">`;
        for (let j = 0; j < group.instances.length; j++) {
          const loc = group.instances[j];
          html += `<div class="accordion-item">`;
          html += `<div class="accordion-item-number">#${j + 1}</div>`;
          html += `<div style="flex: 1;">`;
          html += `<div>📍 ${escapeHtmlFn(loc.navigationName || 'Unknown')} — <a href="${escapeHtmlFn(loc.url)}" target="_blank" style="color: #667eea; text-decoration: underline;">${escapeHtmlFn(loc.url)}</a></div>`;
          if (loc.text) {
            const displayText = escapeHtmlFn(loc.text.substring(0, 150));
            html += `<div class="location-text">"${displayText}${loc.text.length > 150 ? '...' : ''}"</div>`;
          }
          html += `</div>`;
          html += `</div>`;
        }
        html += `</div>`;
        html += `</div>`;
      }
    }
    
    html += `</div>`;
    return html;
  },

  // Build navigation order for aggregated report
  buildNavOrder: function(data) {
    const order = [];
    
    const headingTypes = ['heading-1', 'heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6'];
    for (const type of headingTypes) {
      const typeData = data.headings[type];
      if (typeData && typeData.locations && typeData.locations.length > 0) {
        order.push(`agg-${type}`);
      }
    }
    
    order.push('agg-paragraphs-section');
    
    const paragraphTypes = ['paragraph-1', 'paragraph-2', 'paragraph-3'];
    for (const type of paragraphTypes) {
      const typeData = data.paragraphs[type];
      if (typeData && typeData.locations && typeData.locations.length > 0) {
        order.push(`agg-${type}`);
      }
    }
    
    order.push('agg-buttons-section');
    
    const buttonTypes = ['primary', 'secondary', 'tertiary', 'other'];
    for (const type of buttonTypes) {
      const typeData = data.buttons[type];
      if (typeData && typeData.locations && typeData.locations.length > 0) {
        order.push(`agg-button-${type}`);
      }
    }
    
    order.push('agg-links-section');
    
    if (data.links && data.links['in-content'] && data.links['in-content'].locations && data.links['in-content'].locations.length > 0) {
      order.push('agg-links-in-content');
    }
    
    order.push('page-report-start');
    
    return order;
  },

  // Get next section ID from nav order
  getNextSection: function(currentId, navOrder) {
    const index = navOrder.indexOf(currentId);
    if (index >= 0 && index < navOrder.length - 1) {
      return navOrder[index + 1];
    }
    return null;
  },

  // Generate subsection header with navigation
  generateSubsectionHeader: function(id, label, count, nextSectionId) {
    const arrows = `
      <div>
        <a href="#agg-toc" style="color: #667eea; text-decoration: none; font-size: 1.2rem; margin-right: 10px;">⬆️</a>
        ${nextSectionId ? `<a href="#${nextSectionId}" style="color: #667eea; text-decoration: none; font-size: 1.2rem;">⬇️</a>` : ''}
      </div>
    `;
    
    return `
      <div id="${id}" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; color: #2d3748; font-size: 1.3rem;">
          ${label}
          <span style="background: #667eea; color: white; padding: 3px 12px; border-radius: 15px; font-size: 0.8rem; margin-left: 10px;">${count}</span>
        </h3>
        ${arrows}
      </div>
    `;
  },

  // Generate the full aggregated styles report
  generate: function(data, escapeHtmlFn) {
    let html = '';
    const navOrder = this.buildNavOrder(data);
    
    // Headings Section
    html += this.generateSectionHeader('agg-headings-section', 'Headings', '📝', 'agg-paragraphs-section');
    
    const headingTypes = [
      { key: 'heading-1', label: 'HEADING 1' },
      { key: 'heading-2', label: 'HEADING 2' },
      { key: 'heading-3', label: 'HEADING 3' },
      { key: 'heading-4', label: 'HEADING 4' },
      { key: 'heading-5', label: 'HEADING 5' },
      { key: 'heading-6', label: 'HEADING 6' }
    ];
    
    for (const type of headingTypes) {
      const typeData = data.headings[type.key];
      const locations = (typeData && typeData.locations) ? typeData.locations : [];
      const subsectionId = `agg-${type.key}`;
      const nextId = this.getNextSection(subsectionId, navOrder);
      html += this.generateTypeSectionWithNav(type.key, type.label, locations, escapeHtmlFn, subsectionId, nextId);
    }
    
    // Paragraphs Section
    html += this.generateSectionHeader('agg-paragraphs-section', 'Paragraphs', '📄', 'agg-buttons-section');
    
    const paragraphTypes = [
      { key: 'paragraph-1', label: 'PARAGRAPH 1' },
      { key: 'paragraph-2', label: 'PARAGRAPH 2' },
      { key: 'paragraph-3', label: 'PARAGRAPH 3' }
    ];
    
    for (const type of paragraphTypes) {
      const typeData = data.paragraphs[type.key];
      const locations = (typeData && typeData.locations) ? typeData.locations : [];
      const subsectionId = `agg-${type.key}`;
      const nextId = this.getNextSection(subsectionId, navOrder);
      html += this.generateTypeSectionWithNav(type.key, type.label, locations, escapeHtmlFn, subsectionId, nextId);
    }
    
    // Buttons Section
    html += this.generateSectionHeader('agg-buttons-section', 'Buttons', '🔘', 'agg-links-section');
    
    const buttonTypes = [
      { key: 'primary', label: 'PRIMARY BUTTON' },
      { key: 'secondary', label: 'SECONDARY BUTTON' },
      { key: 'tertiary', label: 'TERTIARY BUTTON' },
      { key: 'other', label: 'OTHER BUTTON' }
    ];
    
    for (const type of buttonTypes) {
      const typeData = data.buttons[type.key];
      const locations = (typeData && typeData.locations) ? typeData.locations : [];
      const subsectionId = `agg-button-${type.key}`;
      const nextId = this.getNextSection(subsectionId, navOrder);
      html += this.generateTypeSectionWithNav(type.key, type.label, locations, escapeHtmlFn, subsectionId, nextId);
    }
    
    // Links Section
    html += this.generateSectionHeader('agg-links-section', 'Links', '🔗', 'page-report-start');
    html += `<p style="color: #718096; font-size: 0.95rem; margin-bottom: 20px; font-style: italic;">
      Analyzes in-content links for consistent styling. Excludes navigation, footer, and social media links since these often use specialized styling.
    </p>`;
    
    const linkLocations = (data.links && data.links['in-content'] && data.links['in-content'].locations) 
      ? data.links['in-content'].locations 
      : [];
    const linkSubsectionId = 'agg-links-in-content';
    const linkNextId = 'page-report-start';
    html += this.generateTypeSectionWithNav('in-content', 'IN-CONTENT LINKS', linkLocations, escapeHtmlFn, linkSubsectionId, linkNextId);
    
    // Footer with up arrow to TOC
    html += `
      <div style="text-align: center; margin-top: 40px; padding: 20px;">
        <a href="#agg-toc" style="color: #667eea; text-decoration: none; font-size: 1.5rem; display: inline-flex; align-items: center; gap: 8px;">
          ⬆️ <span style="font-size: 1rem;">Aggregated Report TOC</span>
        </a>
      </div>
    `;
    
    return html;
  },

  // Generate TOC for aggregated styles report
  generateTOC: function(data) {
    let headingsSublist = '';
    const headingTypes = ['heading-1', 'heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6'];
    for (const type of headingTypes) {
      const typeData = data.headings[type];
      if (typeData && typeData.locations && typeData.locations.length > 0) {
        const locations = typeData.locations;
        const styleGroups = StyleComparisonUtils.groupByStyleDefinition(locations);
        const hasVariations = styleGroups.length > 1;
        const instances = locations.length;
        const variations = styleGroups.length;
        
        const label = type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        const variationText = hasVariations 
          ? ` <span style="color: #e53e3e;">(${instances} instance${instances === 1 ? '' : 's'}, ${variations} variation${variations === 1 ? '' : 's'})</span>`
          : '';
        headingsSublist += `<li style="margin: 5px 0;"><a href="#agg-${type}" style="color: #667eea; text-decoration: none;">${label}${variationText}</a></li>`;
      }
    }
    
    let paragraphsSublist = '';
    const paragraphTypes = ['paragraph-1', 'paragraph-2', 'paragraph-3'];
    for (const type of paragraphTypes) {
      const typeData = data.paragraphs[type];
      if (typeData && typeData.locations && typeData.locations.length > 0) {
        const locations = typeData.locations;
        const styleGroups = StyleComparisonUtils.groupByStyleDefinition(locations);
        const hasVariations = styleGroups.length > 1;
        const instances = locations.length;
        const variations = styleGroups.length;
        
        const label = type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        const variationText = hasVariations 
          ? ` <span style="color: #e53e3e;">(${instances} instance${instances === 1 ? '' : 's'}, ${variations} variation${variations === 1 ? '' : 's'})</span>`
          : '';
        paragraphsSublist += `<li style="margin: 5px 0;"><a href="#agg-${type}" style="color: #667eea; text-decoration: none;">${label}${variationText}</a></li>`;
      }
    }
    
    let buttonsSublist = '';
    const buttonTypes = ['primary', 'secondary', 'tertiary', 'other'];
    for (const type of buttonTypes) {
      const typeData = data.buttons[type];
      if (typeData && typeData.locations && typeData.locations.length > 0) {
        const locations = typeData.locations;
        const styleGroups = StyleComparisonUtils.groupByStyleDefinition(locations);
        const hasVariations = styleGroups.length > 1;
        const instances = locations.length;
        const variations = styleGroups.length;
        
        const label = type.charAt(0).toUpperCase() + type.slice(1);
        const variationText = hasVariations 
          ? ` <span style="color: #e53e3e;">(${instances} instance${instances === 1 ? '' : 's'}, ${variations} variation${variations === 1 ? '' : 's'})</span>`
          : '';
        buttonsSublist += `<li style="margin: 5px 0;"><a href="#agg-button-${type}" style="color: #667eea; text-decoration: none;">${label}${variationText}</a></li>`;
      }
    }
    
    let linksSublist = '';
    if (data.links && data.links['in-content'] && data.links['in-content'].locations && data.links['in-content'].locations.length > 0) {
      const locations = data.links['in-content'].locations;
      const styleGroups = StyleComparisonUtils.groupByStyleDefinition(locations);
      const hasVariations = styleGroups.length > 1;
      const instances = locations.length;
      const variations = styleGroups.length;
      
      const variationText = hasVariations 
        ? ` <span style="color: #e53e3e;">(${instances} instance${instances === 1 ? '' : 's'}, ${variations} variation${variations === 1 ? '' : 's'})</span>`
        : '';
      linksSublist = `<li style="margin: 5px 0;"><a href="#agg-links-in-content" style="color: #667eea; text-decoration: none;">In-Content Links${variationText}</a></li>`;
    }
    
    return `
      <div id="agg-toc" style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 40px; border: 2px solid #667eea;">
        <h3 style="margin-top: 0; color: #667eea;">📋 Table of Contents</h3>
        <ul style="list-style: none; padding-left: 0;">
          <li style="margin: 10px 0;">
            <a href="#agg-headings-section" style="color: #667eea; text-decoration: none; font-weight: bold;">📝 Headings</a>
            ${headingsSublist ? `<ul style="list-style: none; padding-left: 25px; margin-top: 5px;">${headingsSublist}</ul>` : ''}
          </li>
          <li style="margin: 10px 0;">
            <a href="#agg-paragraphs-section" style="color: #667eea; text-decoration: none; font-weight: bold;">📄 Paragraphs</a>
            ${paragraphsSublist ? `<ul style="list-style: none; padding-left: 25px; margin-top: 5px;">${paragraphsSublist}</ul>` : ''}
          </li>
          <li style="margin: 10px 0;">
            <a href="#agg-buttons-section" style="color: #667eea; text-decoration: none; font-weight: bold;">🔘 Buttons</a>
            ${buttonsSublist ? `<ul style="list-style: none; padding-left: 25px; margin-top: 5px;">${buttonsSublist}</ul>` : ''}
          </li>
          <li style="margin: 10px 0;">
            <a href="#agg-links-section" style="color: #667eea; text-decoration: none; font-weight: bold;">🔗 Links</a>
            ${linksSublist ? `<ul style="list-style: none; padding-left: 25px; margin-top: 5px;">${linksSublist}</ul>` : ''}
          </li>
        </ul>
      </div>
    `;
  }
};

// Make globally available
window.ExportAggregatedStylesReport = ExportAggregatedStylesReport;