// export-page-by-page-report.js - Page-by-Page Styles Report Generator
// Single Responsibility: Generate the "Organized by Styles Shown on Each Page" report

const ExportPageByPageReport = {
  // Generate the full page-by-page report content
  generate: function (data, escapeHtmlFn) {
    const self = this;
    let html = '';

    // Get unique pages from pagesAnalyzed
    const pages = data.metadata.pagesAnalyzed || [];

    // Build a map of all items by page URL
    const pageDataMap = this.buildPageDataMap(data, pages);

    // Get H1 issues
    const missingH1Pages = (data.qualityChecks?.missingH1 || []).map(item =>
      this.normalizeUrl(item.url)
    );
    const multipleH1Map = {};
    (data.qualityChecks?.multipleH1 || []).forEach(item => {
      multipleH1Map[this.normalizeUrl(item.url)] = item.count;
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
            <a href="#reports-nav" style="color: white; text-decoration: none; font-size: 1.5rem; margin-right: 15px;">⬆️</a>
            <a href="#${nextPageId}" style="color: white; text-decoration: none; font-size: 1.5rem;">⬇️</a>
          </div>`
        : `<a href="#reports-nav" style="color: white; text-decoration: none; font-size: 1.5rem;">⬆️</a>`;

      html += `
        <div id="${pageId}" style="margin-bottom: 40px;">
          <div style="background: #4B68E7; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 style="margin: 0; color: white; border: none; padding: 0;">📄 ${escapeHtmlFn(pageName)}${h1Badge}</h2>
              <a href="${escapeHtmlFn(pageData.fullUrl)}" target="_blank" style="color: #FAFAFA; font-size: 0.9rem; text-decoration: underline;">${escapeHtmlFn(pageData.fullUrl)}</a>
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
      const hasParagraphs = Object.keys(pageData.paragraphs).some(
        t => pageData.paragraphs[t].length > 0
      );
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
        <a href="#reports-nav" style="color: #667eea; text-decoration: none; font-size: 2rem;">⬆️</a>
      </div>
    `;

    return html;
  },

  // Build a map of all data organized by page URL
  // Normalize URL for comparison (removes protocol, www, trailing slashes, and query params)
  normalizeUrl: function (url) {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      let normalized = urlObj.hostname.replace(/^www\./, '') + urlObj.pathname;
      if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
      }
      return normalized.toLowerCase();
    } catch (e) {
      // Fallback for relative URLs or invalid URLs
      let normalized = url
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('?')[0]
        .split('#')[0];
      if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
      }
      return normalized.toLowerCase();
    }
  },

  buildPageDataMap: function (data, pages) {
    const domain = data.metadata.domain;
    const pageDataMap = {};
    const self = this;

    // Initialize pages
    for (const pagePath of pages) {
      // Handle both absolute and relative paths in the pages array
      const fullUrl = pagePath.startsWith('http')
        ? pagePath
        : pagePath === '/'
          ? `https://${domain}/`
          : `https://${domain}${pagePath}`;
      const normalizedFullUrl = this.normalizeUrl(fullUrl);

      pageDataMap[normalizedFullUrl] = {
        path: pagePath,
        fullUrl: fullUrl,
        navigationName: '',
        headings: {},
        paragraphs: {},
        buttons: {},
        links: [],
        h1Issues: [],
      };
    }

    // Process all categories
    const processLocations = (locations, category, type) => {
      for (const loc of locations) {
        const normUrl = self.normalizeUrl(loc.url);
        if (pageDataMap[normUrl]) {
          const page = pageDataMap[normUrl];
          if (category === 'links') {
            page.links.push(loc);
          } else {
            if (!page[category][type]) page[category][type] = [];
            page[category][type].push(loc);
          }
          if (!page.navigationName && loc.navigationName) {
            page.navigationName = loc.navigationName;
          }
        }
      }
    };

    // Headings
    for (const type in data.headings) {
      processLocations(data.headings[type].locations || [], 'headings', type);
    }

    // Paragraphs
    for (const type in data.paragraphs) {
      processLocations(data.paragraphs[type].locations || [], 'paragraphs', type);
    }

    // Buttons
    for (const type in data.buttons) {
      processLocations(data.buttons[type].locations || [], 'buttons', type);
    }

    // Links
    if (data.links && data.links['in-content']) {
      processLocations(data.links['in-content'].locations || [], 'links');
    }

    return pageDataMap;
  },

  // Count total items on a page
  countPageItems: function (pageData) {
    let totalItems = 0;
    if (pageData.headings) {
      for (const type in pageData.headings) {
        totalItems += pageData.headings[type].length;
      }
    }
    if (pageData.paragraphs) {
      for (const type in pageData.paragraphs) {
        totalItems += pageData.paragraphs[type].length;
      }
    }
    if (pageData.buttons) {
      for (const type in pageData.buttons) {
        totalItems += pageData.buttons[type].length;
      }
    }
    if (pageData.links) {
      totalItems += pageData.links.length;
    }
    return totalItems;
  },

  // Generate accordion for a subsection
  generateSubsectionAccordion: function (label, items, escapeHtmlFn, textMaxLength) {
    let html = `<div class="accordion-container" style="margin-bottom: 10px;">`;
    html += `<div class="accordion-header">`;
    html += `<div class="accordion-title">`;
    html += `<span class="accordion-label">${label}</span>`;
    html += `<span class="accordion-icon">▶</span>`;
    html += `<span class="accordion-count">${items.length} instance${items.length === 1 ? '' : 's'}</span>`;
    html += `</div>`;
    html += `</div>`;

    html += `<div class="accordion-content">`;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      html += `<div class="accordion-item" style="display: flex; gap: 15px; align-items: flex-start;">`;
      html += `<div class="accordion-item-number">#${i + 1}</div>`;
      html += `<div style="flex: 1;">`;
      html += `<div style="font-weight: 600; color: #4a5568;">"${escapeHtmlFn((item.text || '').substring(0, textMaxLength))}${(item.text || '').length > textMaxLength ? '...' : ''}"</div>`;
      html += `<div style="font-size: 0.85rem; color: #718096; margin-top: 4px;">Style: ${escapeHtmlFn(item.styleDefinition || 'N/A')}</div>`;
      html += `<div style="font-size: 0.8rem; color: #a0aec0;">Section: ${item.section || 'N/A'} | Block: ${item.block || 'N/A'}</div>`;
      html += `</div>`;
      if (item.selector) {
        html += `
          <div style="flex-shrink: 0;">
            <a href="${item.url}${item.url.includes('?') ? '&' : '?'}ssa-inspect-selector=${encodeURIComponent(item.selector)}" 
               target="_blank" 
               style="display: inline-block; padding: 6px 10px; background: #667eea; color: white; border-radius: 4px; text-decoration: none; font-size: 0.75rem; font-weight: bold;">
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Locate
            </a>
          </div>`;
      }
      html += `</div>`;
    }
    html += `</div></div>`;
    return html;
  },

  // Helper sections for each category
  generateHeadingsSection: function (pageData, escapeHtmlFn) {
    const types = Object.keys(pageData.headings).sort();
    if (types.length === 0) return '';

    let html = `<h4 style="color: #4B68E7; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 0; margin-bottom: 15px;">Headings</h4>`;
    for (const type of types) {
      const label = type.toUpperCase().replace(/-/g, ' ');
      html += this.generateSubsectionAccordion(label, pageData.headings[type], escapeHtmlFn, 150);
    }
    return html;
  },

  generateParagraphsSection: function (pageData, escapeHtmlFn) {
    const types = Object.keys(pageData.paragraphs).sort();
    if (types.length === 0) return '';

    let html = `<h4 style="color: #4B68E7; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 25px; margin-bottom: 15px;">Paragraphs</h4>`;
    for (const type of types) {
      const label = type.toUpperCase().replace(/-/g, ' ');
      html += this.generateSubsectionAccordion(label, pageData.paragraphs[type], escapeHtmlFn, 150);
    }
    return html;
  },

  generateButtonsSection: function (pageData, escapeHtmlFn) {
    const types = ['primary', 'secondary', 'tertiary', 'other'];
    let hasButtons = false;
    let buttonHtml = `<h4 style="color: #4B68E7; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 25px; margin-bottom: 15px;">Buttons</h4>`;

    for (const type of types) {
      if (pageData.buttons[type] && pageData.buttons[type].length > 0) {
        hasButtons = true;
        const label = type.toUpperCase() + ' BUTTON';
        buttonHtml += this.generateSubsectionAccordion(
          label,
          pageData.buttons[type],
          escapeHtmlFn,
          100
        );
      }
    }

    return hasButtons ? buttonHtml : '';
  },

  generateLinksSection: function (pageData, escapeHtmlFn) {
    if (!pageData.links || pageData.links.length === 0) return '';

    let html = `<h4 style="color: #4B68E7; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 25px; margin-bottom: 15px;">In-Content Links</h4>`;
    html += this.generateSubsectionAccordion('IN-CONTENT LINKS', pageData.links, escapeHtmlFn, 100);
    return html;
  },

  // Generate Table of Contents for pages
  generateTOC: function (data, escapeHtmlFn) {
    const pages = data.metadata.pagesAnalyzed || [];
    const pageDataMap = this.buildPageDataMap(data, pages);
    const pageUrls = Object.keys(pageDataMap).sort((a, b) => {
      const nameA = (
        pageDataMap[a].navigationName ||
        pageDataMap[a].path ||
        'Unknown'
      ).toLowerCase();
      const nameB = (
        pageDataMap[b].navigationName ||
        pageDataMap[b].path ||
        'Unknown'
      ).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    if (pageUrls.length === 0) return '';

    let html = `
      <div id="reports-nav" style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 40px; border: 2px solid #667eea;">
        <h2 style="margin-top: 0; color: #667eea; font-size: 1.5rem;">📄 Styles Shown on Each Page</h2>
        <p style="color: #718096; margin-bottom: 20px;">Jump to a specific page analysis below:</p>
        <ul style="list-style: none; padding-left: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px;">
    `;

    // Pre-calculate H1 issues for efficiency
    const missingH1Pages = (data.qualityChecks?.missingH1 || []).map(item =>
      this.normalizeUrl(item.url)
    );
    const multipleH1Map = {};
    (data.qualityChecks?.multipleH1 || []).forEach(item => {
      multipleH1Map[this.normalizeUrl(item.url)] = item.count;
    });

    for (let i = 0; i < pageUrls.length; i++) {
      const pageUrl = pageUrls[i];
      const pageData = pageDataMap[pageUrl];
      const pageName = pageData.navigationName || pageData.path || 'Unknown';
      const totalItems = this.countPageItems(pageData);

      const hasNoH1 = missingH1Pages.includes(this.normalizeUrl(pageUrl));
      const multipleH1Count = multipleH1Map[this.normalizeUrl(pageUrl)] || 0;

      let errorBadge = '';
      if (hasNoH1 && multipleH1Count > 0) {
        errorBadge = ` <span style="color: #e53e3e; font-weight: bold; font-size: 0.8rem;">(No H1, Multiple H1: ${multipleH1Count})</span>`;
      } else if (hasNoH1) {
        errorBadge = ` <span style="color: #e53e3e; font-weight: bold; font-size: 0.8rem;">(No H1)</span>`;
      } else if (multipleH1Count > 0) {
        errorBadge = ` <span style="color: #e53e3e; font-weight: bold; font-size: 0.8rem;">(Multiple H1: ${multipleH1Count})</span>`;
      }

      html += `
        <li style="margin: 0;">
          <a href="#page-${i}" style="color: #667eea; text-decoration: none; display: block; padding: 8px 12px; background: white; border-radius: 6px; border: 1px solid #e2e8f0; transition: all 0.2s;">
            <strong>${escapeHtmlFn(pageName)}</strong>${errorBadge}
            <div style="font-size: 0.8rem; color: #a0aec0;">${totalItems} items — ${escapeHtmlFn(pageData.fullUrl)}</div>
          </a>
        </li>
      `;
    }

    html += `
        </ul>
      </div>
    `;

    return html;
  },
};

// Make available globally
window.ExportPageByPageReport = ExportPageByPageReport;
