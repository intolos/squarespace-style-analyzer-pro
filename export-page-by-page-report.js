// export-page-by-page-report.js - Page-by-Page Styles Report Generator
// Single Responsibility: Generate the "Organized by Styles Shown on Each Page" report

const ExportPageByPageReport = {

  // Generate the full page-by-page report content
  generate: function(data, escapeHtmlFn) {
    const self = this;
    let html = '';
    
    // Get unique pages from pagesAnalyzed
    const pages = data.metadata.pagesAnalyzed || [];
    
    // Build a map of all items by page URL
    const pageDataMap = this.buildPageDataMap(data, pages);
    
    // Get H1 issues
    const missingH1Pages = (data.qualityChecks?.missingH1 || []).map(item => item.url);
    const multipleH1Map = {};
    (data.qualityChecks?.multipleH1 || []).forEach(item => {
      multipleH1Map[item.url] = item.count;
    });
    
    // Generate page navigation order
    const pageUrls = Object.keys(pageDataMap);
    
    // Generate content for each page
    for (let i = 0; i < pageUrls.length; i++) {
      const pageUrl = pageUrls[i];
      const pageData = pageDataMap[pageUrl];
      const pageName = pageData.navigationName || pageData.path || 'Unknown';
      const pageId = `page-${i}`;
      const nextPageId = i < pageUrls.length - 1 ? `page-${i + 1}` : null;
      
      // Check for H1 issues
      const hasNoH1 = missingH1Pages.includes(pageUrl);
      const multipleH1Count = multipleH1Map[pageUrl] || 0;
      
      // Build H1 issue badge (light red for contrast on blue background)
      let h1Badge = '';
      if (hasNoH1 && multipleH1Count > 0) {
        h1Badge = ` <span style="color: #FCE3E3; font-weight: bold;">- No H1 and Multiple H1 (${multipleH1Count})</span>`;
      } else if (hasNoH1) {
        h1Badge = ` <span style="color: #FCE3E3; font-weight: bold;">- No H1</span>`;
      } else if (multipleH1Count > 0) {
        h1Badge = ` <span style="color: #FCE3E3; font-weight: bold;">- Multiple H1 (${multipleH1Count})</span>`;
      }
      
      // Count total items on this page
      const totalItems = this.countPageItems(pageData);
      
      // Page section header
      const arrows = nextPageId 
        ? `<div>
            <a href="#toc" style="color: white; text-decoration: none; font-size: 1.5rem; margin-right: 15px;">⬆️</a>
            <a href="#${nextPageId}" style="color: white; text-decoration: none; font-size: 1.5rem;">⬇️</a>
          </div>`
        : `<a href="#toc" style="color: white; text-decoration: none; font-size: 1.5rem;">⬆️</a>`;
      
      html += `
        <div id="${pageId}" style="margin-bottom: 40px;">
          <div style="background: #4B68E7; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 style="margin: 0; color: white; border: none; padding: 0;">📄 ${escapeHtmlFn(pageName)}${h1Badge}</h2>
              <a href="${escapeHtmlFn(pageUrl)}" target="_blank" style="color: #FAFAFA; font-size: 0.9rem; text-decoration: underline;">${escapeHtmlFn(pageUrl)}</a>
              <span style="color: #FAFAFA; font-size: 0.9rem; margin-left: 15px;">(${totalItems} items)</span>
            </div>
            ${arrows}
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
      `;
      
      // Headings on this page
      html += this.generateHeadingsSection(pageData, escapeHtmlFn);
      
      // Paragraphs on this page
      html += this.generateParagraphsSection(pageData, escapeHtmlFn);
      
      // Buttons on this page
      html += this.generateButtonsSection(pageData, escapeHtmlFn);
      
      // Links on this page
      html += this.generateLinksSection(pageData, escapeHtmlFn);
      
      // No items message
      const hasHeadings = Object.keys(pageData.headings).some(t => pageData.headings[t].length > 0);
      const hasParagraphs = Object.keys(pageData.paragraphs).some(t => pageData.paragraphs[t].length > 0);
      const hasButtons = Object.keys(pageData.buttons).some(t => pageData.buttons[t].length > 0);
      
      if (!hasHeadings && !hasParagraphs && !hasButtons && pageData.links.length === 0) {
        html += `<p style="color: #718096; font-style: italic;">No styled elements found on this page.</p>`;
      }
      
      html += `
          </div>
        </div>
      `;
    }
    
    // Footer with up arrow
    html += `
      <div style="text-align: center; margin-top: 40px; padding: 20px;">
        <a href="#toc" style="color: #667eea; text-decoration: none; font-size: 2rem;">⬆️</a>
      </div>
    `;
    
    return html;
  },

  // Build a map of all data organized by page URL
  buildPageDataMap: function(data, pages) {
    const domain = data.metadata.domain;
    const pageDataMap = {};
    
    // Initialize pages
    for (const pagePath of pages) {
      const fullUrl = pagePath === '/' ? `https://${domain}/` : `https://${domain}${pagePath}`;
      
      pageDataMap[fullUrl] = {
        path: pagePath,
        navigationName: '',
        headings: {},
        paragraphs: {},
        buttons: {},
        links: []
      };
    }
    
    // Populate headings
    for (const headingType in data.headings) {
      const locations = data.headings[headingType].locations || [];
      for (const loc of locations) {
        const url = loc.url;
        if (pageDataMap[url]) {
          if (!pageDataMap[url].headings[headingType]) {
            pageDataMap[url].headings[headingType] = [];
          }
          pageDataMap[url].headings[headingType].push(loc);
          if (!pageDataMap[url].navigationName && loc.navigationName) {
            pageDataMap[url].navigationName = loc.navigationName;
          }
        }
      }
    }
    
    // Populate paragraphs
    for (const paragraphType in data.paragraphs) {
      const locations = data.paragraphs[paragraphType].locations || [];
      for (const loc of locations) {
        const url = loc.url;
        if (pageDataMap[url]) {
          if (!pageDataMap[url].paragraphs[paragraphType]) {
            pageDataMap[url].paragraphs[paragraphType] = [];
          }
          pageDataMap[url].paragraphs[paragraphType].push(loc);
          if (!pageDataMap[url].navigationName && loc.navigationName) {
            pageDataMap[url].navigationName = loc.navigationName;
          }
        }
      }
    }
    
    // Populate buttons
    for (const buttonType in data.buttons) {
      const locations = data.buttons[buttonType].locations || [];
      for (const loc of locations) {
        const url = loc.url;
        if (pageDataMap[url]) {
          if (!pageDataMap[url].buttons[buttonType]) {
            pageDataMap[url].buttons[buttonType] = [];
          }
          pageDataMap[url].buttons[buttonType].push(loc);
          if (!pageDataMap[url].navigationName && loc.navigationName) {
            pageDataMap[url].navigationName = loc.navigationName;
          }
        }
      }
    }
    
    // Populate links
    if (data.links && data.links['in-content'] && data.links['in-content'].locations) {
      for (const loc of data.links['in-content'].locations) {
        const url = loc.url;
        if (pageDataMap[url]) {
          pageDataMap[url].links.push(loc);
          if (!pageDataMap[url].navigationName && loc.navigationName) {
            pageDataMap[url].navigationName = loc.navigationName;
          }
        }
      }
    }
    
    return pageDataMap;
  },

  // Count total items on a page
  countPageItems: function(pageData) {
    let totalItems = 0;
    for (const type in pageData.headings) {
      totalItems += pageData.headings[type].length;
    }
    for (const type in pageData.paragraphs) {
      totalItems += pageData.paragraphs[type].length;
    }
    for (const type in pageData.buttons) {
      totalItems += pageData.buttons[type].length;
    }
    totalItems += pageData.links.length;
    return totalItems;
  },

  // Generate accordion for a subsection
  generateSubsectionAccordion: function(label, items, escapeHtmlFn, textMaxLength) {
    let html = `<div class="accordion-container" style="margin-bottom: 10px;">`;
    html += `<div class="accordion-header" onclick="this.parentElement.classList.toggle('open')">`;
    html += `<div class="accordion-title">`;
    html += `<span class="accordion-label">${label}</span>`;
    html += `<span class="accordion-icon">▶</span>`;
    html += `<span class="accordion-count">${items.length} instance${items.length === 1 ? '' : 's'}</span>`;
    html += `</div>`;
    html += `</div>`;
    
    html += `<div class="accordion-content">`;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      html += `<div class="accordion-item">`;
      html += `<div class="accordion-item-number">#${i + 1}</div>`;
      html += `<div style="flex: 1;">`;
      html += `<div style="font-weight: 600; color: #4a5568;">"${escapeHtmlFn((item.text || '').substring(0, textMaxLength))}${(item.text || '').length > textMaxLength ? '...' : ''}"</div>`;
      html += `<div style="font-size: 0.85rem; color: #718096; margin-top: 4px;">Style: ${escapeHtmlFn(item.styleDefinition || 'N/A')}</div>`;
      html += `<div style="font-size: 0.8rem; color: #a0aec0;">Section: ${item.section || 'N/A'} | Block: ${item.block || 'N/A'}</div>`;
      html += `</div>`;
      html += `</div>`;
    }
    html += `</div>`;
    html += `</div>`;
    
    return html;
  },

  // Generate headings section for a page
  generateHeadingsSection: function(pageData, escapeHtmlFn) {
    const hasHeadings = Object.keys(pageData.headings).some(t => pageData.headings[t].length > 0);
    if (!hasHeadings) return '';
    
    let html = `<div style="margin-bottom: 25px;">`;
    html += `<h3 style="color: #667eea; margin-top: 0; border-bottom: 2px solid #667eea; padding-bottom: 10px;">📝 Headings</h3>`;
    
    for (const headingType of ['heading-1', 'heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6']) {
      const items = pageData.headings[headingType] || [];
      if (items.length === 0) continue;
      
      const label = headingType.replace('-', ' ').toUpperCase();
      html += this.generateSubsectionAccordion(label, items, escapeHtmlFn, 100);
    }
    
    html += `</div>`;
    return html;
  },

  // Generate paragraphs section for a page
  generateParagraphsSection: function(pageData, escapeHtmlFn) {
    const hasParagraphs = Object.keys(pageData.paragraphs).some(t => pageData.paragraphs[t].length > 0);
    if (!hasParagraphs) return '';
    
    let html = `<div style="margin-bottom: 25px;">`;
    html += `<h3 style="color: #667eea; margin-top: 0; border-bottom: 2px solid #667eea; padding-bottom: 10px;">📄 Paragraphs</h3>`;
    
    for (const paragraphType of ['paragraph-1', 'paragraph-2', 'paragraph-3']) {
      const items = pageData.paragraphs[paragraphType] || [];
      if (items.length === 0) continue;
      
      const label = paragraphType.replace('-', ' ').toUpperCase();
      html += this.generateSubsectionAccordion(label, items, escapeHtmlFn, 100);
    }
    
    html += `</div>`;
    return html;
  },

  // Generate buttons section for a page
  generateButtonsSection: function(pageData, escapeHtmlFn) {
    const hasButtons = Object.keys(pageData.buttons).some(t => pageData.buttons[t].length > 0);
    if (!hasButtons) return '';
    
    let html = `<div style="margin-bottom: 25px;">`;
    html += `<h3 style="color: #667eea; margin-top: 0; border-bottom: 2px solid #667eea; padding-bottom: 10px;">🔘 Buttons</h3>`;
    
    for (const buttonType of ['primary', 'secondary', 'tertiary', 'other']) {
      const items = pageData.buttons[buttonType] || [];
      if (items.length === 0) continue;
      
      const label = buttonType.toUpperCase() + ' BUTTON';
      html += this.generateSubsectionAccordion(label, items, escapeHtmlFn, 50);
    }
    
    html += `</div>`;
    return html;
  },

  // Generate links section for a page
  generateLinksSection: function(pageData, escapeHtmlFn) {
    if (pageData.links.length === 0) return '';
    
    let html = `<div style="margin-bottom: 25px;">`;
    html += `<h3 style="color: #667eea; margin-top: 0; border-bottom: 2px solid #667eea; padding-bottom: 10px;">🔗 Links</h3>`;
    
    html += this.generateSubsectionAccordion('IN-CONTENT LINKS', pageData.links, escapeHtmlFn, 50);
    
    html += `</div>`;
    return html;
  },

  // Generate Table of Contents for page-by-page report
  generateTOC: function(data, escapeHtmlFn) {
    const pages = data.metadata.pagesAnalyzed || [];
    const domain = data.metadata.domain;
    
    // Get H1 issues
    const missingH1Pages = (data.qualityChecks?.missingH1 || []).map(item => item.url);
    const multipleH1Map = {};
    (data.qualityChecks?.multipleH1 || []).forEach(item => {
      multipleH1Map[item.url] = item.count;
    });
    
    // Build page info
    const pageInfo = [];
    for (let i = 0; i < pages.length; i++) {
      const pagePath = pages[i];
      const fullUrl = pagePath === '/' ? `https://${domain}/` : `https://${domain}${pagePath}`;
      
      // Find navigation name from any location data
      let navName = this.findNavigationName(data, fullUrl);
      if (!navName) {
        navName = pagePath === '/' ? 'Home' : pagePath.replace(/\//g, '').replace(/-/g, ' ');
      }
      
      // Check for H1 issues
      const hasNoH1 = missingH1Pages.includes(fullUrl);
      const multipleH1Count = multipleH1Map[fullUrl] || 0;
      
      // Build H1 issue badge
      let h1Badge = '';
      if (hasNoH1 && multipleH1Count > 0) {
        h1Badge = ` <span style="color: #e53e3e; font-weight: bold;">- No H1 and Multiple H1 (${multipleH1Count})</span>`;
      } else if (hasNoH1) {
        h1Badge = ` <span style="color: #e53e3e; font-weight: bold;">- No H1</span>`;
      } else if (multipleH1Count > 0) {
        h1Badge = ` <span style="color: #e53e3e; font-weight: bold;">- Multiple H1 (${multipleH1Count})</span>`;
      }
      
      pageInfo.push({
        id: `page-${i}`,
        name: navName,
        url: fullUrl,
        h1Badge: h1Badge
      });
    }
    
    return `
      <div id="toc" style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 40px; border: 2px solid #667eea;">
        <h3 style="margin-top: 0; color: #667eea;">📋 Table of Contents — Pages</h3>
        <ul style="list-style: none; padding-left: 0;">
          ${pageInfo.map(page => `
            <li style="margin: 10px 0;">
              <a href="#${page.id}" style="color: #667eea; text-decoration: none; font-weight: bold;">📄 ${escapeHtmlFn(page.name)}${page.h1Badge}</a>
              <span style="color: #718096; font-size: 0.85rem; margin-left: 10px;">— ${escapeHtmlFn(page.url)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  },

  // Find navigation name for a URL from the data
  findNavigationName: function(data, fullUrl) {
    // Check headings
    for (const headingType in data.headings) {
      const loc = (data.headings[headingType].locations || []).find(l => l.url === fullUrl);
      if (loc && loc.navigationName) return loc.navigationName;
    }
    // Check paragraphs
    for (const paragraphType in data.paragraphs) {
      const loc = (data.paragraphs[paragraphType].locations || []).find(l => l.url === fullUrl);
      if (loc && loc.navigationName) return loc.navigationName;
    }
    // Check buttons
    for (const buttonType in data.buttons) {
      const loc = (data.buttons[buttonType].locations || []).find(l => l.url === fullUrl);
      if (loc && loc.navigationName) return loc.navigationName;
    }
    return null;
  }
};

// Make globally available
window.ExportPageByPageReport = ExportPageByPageReport;