// export-images-report.js - Images Analysis Report Generator
// Single Responsibility: Generate the Images Analysis report

const ExportImagesReport = {
  // Export the images analysis report
  export: function (data, imagesWithoutAlt, genericImageNames, filenameBrand, downloadFileFn) {
    const domain = data.metadata.domain.replace(/^www\./, '');
    const hasMissingAlt = imagesWithoutAlt && imagesWithoutAlt.length > 0;
    const hasGenericNames = genericImageNames && genericImageNames.length > 0;

    // Group images by page URL for accordions
    const groupByPage = items => {
      const grouped = {};
      for (const item of items) {
        const pageUrl = item.url;
        if (!grouped[pageUrl]) {
          grouped[pageUrl] = {
            url: pageUrl,
            navigationName: item.navigationName || 'Unknown',
            items: [],
          };
        }
        grouped[pageUrl].items.push(item);
      }
      return Object.values(grouped).sort((a, b) => a.url.localeCompare(b.url));
    };

    const missingAltByPage = hasMissingAlt ? groupByPage(imagesWithoutAlt) : [];
    const genericNamesByPage = hasGenericNames ? groupByPage(genericImageNames) : [];

    // Build TOC items - show ALL check types (like mobile report)
    const allCheckTypes = [
      {
        id: 'missing-alt-section',
        label: 'Missing Alt Text',
        count: imagesWithoutAlt.length,
        hasIssues: hasMissingAlt,
      },
      {
        id: 'generic-names-section',
        label: 'Generic File Names',
        count: genericImageNames.length,
        hasIssues: hasGenericNames,
      },
    ];

    const tocItems = allCheckTypes;

    // Determine section navigation
    const getNextSection = currentId => {
      const ids = tocItems.map(t => t.id);
      const idx = ids.indexOf(currentId);
      return idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null;
    };

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${domain} Images Analysis</title>
  <link rel="icon" type="image/png" href="https://intolos.github.io/squarespace-style-analyzer-pro/icon32.png">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 3px solid #667eea; }
    .header h1 { font-size: 2.7rem; margin: 0 0 10px 0; color: #2d3748; }
    .header p { color: #7180D8; font-size: 1.8rem; margin: 5px 0; }
    .toc { background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 40px; border: 2px solid #667eea; }
    .toc h2 { margin-top: 0; color: #667eea; }
    .toc ul { list-style: none; padding-left: 0; }
    .toc li { margin: 10px 0; }
    .toc a { color: #667eea; text-decoration: none; font-weight: 600; }
    .toc a:hover { text-decoration: underline; }
    .section-header { background: #667eea; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .section-header h2 { margin: 0; color: white; }
    .section-header a { color: white; text-decoration: none; font-size: 1.5rem; }
    .accordion-container { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 15px; }
    .accordion-header { padding: 15px; background: #edf2f7; cursor: pointer; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .accordion-header:hover { background: #e2e8f0; }
    .accordion-icon { font-size: 1.3rem; color: #667eea; transition: transform 0.2s ease; }
    .accordion-container.open .accordion-icon { transform: rotate(90deg); }
    .accordion-count { background: #667eea; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; }
    .accordion-content { display: none; padding: 0; background: white; }
    .accordion-container.open .accordion-content { display: block; }
    .accordion-item { padding: 12px 15px; border-top: 1px solid #e2e8f0; }
    .accordion-item:hover { background: #f7fafc; }
    .item-row { display: grid; grid-template-columns: 1fr 200px 120px 150px 100px; gap: 15px; align-items: start; }
    .item-row.alt-text { grid-template-columns: 1fr 150px 100px; }
    .item-label { font-size: 0.75rem; color: #718096; text-transform: uppercase; margin-bottom: 4px; }
    .item-value { font-size: 0.9rem; color: #2d3748; word-break: break-all; }
    .item-value a { color: #667eea; text-decoration: none; }
    .item-value a:hover { text-decoration: underline; }
    .pattern-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; background: #fed7d7; color: #9b2c2c; }
    @media print { body { padding: 20px; } .container { box-shadow: none; } .accordion-content { display: block !important; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🖼️ ${domain} Images Analysis</h1>
      <p>Professional Design Audit by Squarespace Style Analyzer Pro</p>
      <p><span style="font-size: 1.2rem;">Generated on ${new Date().toLocaleString()}</span></p>
    </div>

    <!-- Table of Contents -->
    <div id="images-toc" class="toc">
      <h2>📋 Table of Contents</h2>
      <ul>
        ${tocItems
          .map(
            item => `
          <li>
            ${
              item.hasIssues
                ? `<a href="#${item.id}">🖼️ ${item.label}</a>
                 <span class="toc-count">${item.count}</span>`
                : `<span style="color: #718096;">🖼️ ${item.label}</span>
                 <span style="color: #22c55e; font-weight: bold; margin-left: 8px;">✓ Pass, No Issues Found</span>`
            }
          </li>
        `
          )
          .join('')}
      </ul>
      <p style="margin-top: 15px; font-size: 0.85rem; color: black; line-height: 1.4;">
         <strong>💡 NOTE:</strong> To properly use the Locate link, you must let the web page fully and completely finish loading. It is at the very end of the page loading that the item is identified with a red outline.
      </p>
    </div>

    ${
      hasMissingAlt
        ? `
    <!-- Missing Alt Text Section -->
    <div id="missing-alt-section" class="section-header">
      <h2>🖼️ Missing Alt Text (${imagesWithoutAlt.length})</h2>
      <div>
        <a href="#images-toc" style="margin-right: 15px;">⬆️</a>
        ${getNextSection('missing-alt-section') ? `<a href="#${getNextSection('missing-alt-section')}">⬇️</a>` : ''}
      </div>
    </div>
    <p style="color: #718096; margin-bottom: 20px;">Images without alt text may cause accessibility issues and hurt SEO.</p>
    
    ${missingAltByPage
      .map(
        page => `
      <div class="accordion-container">
        <div class="accordion-header">
          <span><strong>${page.navigationName}</strong> — <a href="${page.url}" target="_blank" onclick="event.stopPropagation();">${page.url}</a></span>
          <span class="accordion-icon">▶</span>
          <span class="accordion-count">${page.items.length} image${page.items.length === 1 ? '' : 's'}</span>
        </div>
        <div class="accordion-content">
          ${page.items
            .map(
              img => `
            <div class="accordion-item">
              <div class="item-row alt-text">
                <div>
                  <div class="item-label">Image URL</div>
                  <div class="item-value"><a href="${img.src || img.imageSrc}" target="_blank">${img.src || img.imageSrc}</a></div>
                </div>
                <div>
                  <div class="item-label">Location</div>
                  <div class="item-value">${img.section || 'N/A'}${img.block ? ' / ' + img.block : ''}</div>
                </div>
                <div>
                  ${
                    img.selector
                      ? `
                  <div class="item-label">Inspect</div>
                  <div class="item-value">
                    <a href="${img.url}${img.url.includes('?') ? '&' : '?'}ssa-inspect-selector=${encodeURIComponent(img.selector)}" 
                       target="_blank" 
                       style="display: inline-block; padding: 4px 8px; background: #667eea; color: white; border-radius: 4px; text-decoration: none; font-size: 0.75rem; font-weight: bold;">
                       🔍 Locate
                    </a>
                  </div>`
                      : ''
                  }
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `
      )
      .join('')}
    `
        : ''
    }

    ${
      hasGenericNames
        ? `
    <!-- Generic File Names Section -->
    <div id="generic-names-section" class="section-header">
      <h2>📁 Generic File Names (${genericImageNames.length})</h2>
      <div>
        <a href="#images-toc" style="margin-right: 15px;">⬆️</a>
      </div>
    </div>
    <p style="color: #718096; margin-bottom: 20px;">Images with generic file names (like IMG_1234.jpg) should be renamed to descriptive names for better SEO and organization.</p>
    
    ${genericNamesByPage
      .map(
        page => `
      <div class="accordion-container">
        <div class="accordion-header">
          <span><strong>${page.navigationName}</strong> — <a href="${page.url}" target="_blank" onclick="event.stopPropagation();">${page.url}</a></span>
          <span class="accordion-icon">▶</span>
          <span class="accordion-count">${page.items.length} image${page.items.length === 1 ? '' : 's'}</span>
        </div>
        <div class="accordion-content">
          ${page.items
            .map(
              img => `
            <div class="accordion-item">
              <div class="item-row">
                <div>
                  <div class="item-label">Image URL</div>
                  <div class="item-value"><a href="${img.src}" target="_blank">${img.src}</a></div>
                </div>
                <div>
                  <div class="item-label">Filename</div>
                  <div class="item-value">${img.filename}</div>
                </div>
                <div>
                  <div class="item-label">Pattern</div>
                  <div class="item-value"><span class="pattern-badge">${img.pattern}</span></div>
                </div>
                <div>
                  <div class="item-label">Location</div>
                  <div class="item-value">${img.section || 'N/A'}${img.block ? ' / ' + img.block : ''}</div>
                </div>
                <div>
                  ${
                    img.selector
                      ? `
                  <div class="item-label">Inspect</div>
                  <div class="item-value">
                    <a href="${img.url}${img.url.includes('?') ? '&' : '?'}ssa-inspect-selector=${encodeURIComponent(img.selector)}" 
                       target="_blank" 
                       style="display: inline-block; padding: 4px 8px; background: #667eea; color: white; border-radius: 4px; text-decoration: none; font-size: 0.75rem; font-weight: bold;">
                       🔍 Locate
                    </a>
                  </div>`
                      : ''
                  }
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `
      )
      .join('')}
    `
        : ''
    }

    <!-- Back to top -->
    <div style="text-align: center; margin-top: 40px; padding: 20px;">
      <a href="#images-toc" style="color: #667eea; text-decoration: none; font-size: 2rem;">⬆️</a>
    </div>
  </div>
  <script>
    // Accordion functionality
    document.addEventListener('click', function(e) {
      const header = e.target.closest('.accordion-header');
      if (header) {
        const container = header.closest('.accordion-container');
        if (container) {
          container.classList.toggle('open');
        }
      }
    });
  </script>
</body>
</html>`;

    const filename = `${domain} ${filenameBrand} images analysis.html`;
    downloadFileFn(html, filename, 'text/html');
  },
};

// Make globally available
window.ExportImagesReport = ExportImagesReport;
