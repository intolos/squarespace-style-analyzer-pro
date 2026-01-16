// templates/sections/distribution.ts - Page distribution section

import type { ReportData, ColorData } from '../../types';
import { generateSectionHeader } from '../components';

export function buildDistributionSection(data: ReportData): string {
  const pages: Record<string, { title: string; colors: Set<string> }> = {};

  // Group colors by page
  Object.entries(data.colorData.colors).forEach(([color, colorData]: [string, ColorData]) => {
    colorData.instances.forEach(instance => {
      if (!pages[instance.page]) {
        pages[instance.page] = {
          title: instance.pageTitle,
          colors: new Set(),
        };
      }
      pages[instance.page].colors.add(color);
    });
  });

  if (Object.keys(pages).length === 0) {
    return `
      ${generateSectionHeader('distribution-section', 'Color Distribution Across Pages', '🌈', null)}
      <div class="section">
        <p style="color: #718096;">No page distribution data available.</p>
      </div>
    `;
  }

  const pageCount = Object.keys(pages).length;

  return `
    ${generateSectionHeader('distribution-section', 'Color Distribution Across Pages', '🌈', null)}
    <div class="section">
      <p style="color: #718096; margin-bottom: 20px;">Shows which colors appear on each page of your site.</p>
      <div class="accordion-container">
        <div class="accordion-header" onclick="this.parentElement.classList.toggle('open');">
          <div class="accordion-title">
            <span class="accordion-icon">▶</span>
            <span class="accordion-count">${pageCount} pages</span>
          </div>
        </div>
        <div class="accordion-content">
      ${Object.entries(pages)
        .map(
          ([url, pageData]) => `
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
            ${Array.from(pageData.colors)
              .map(
                color => `
              <div class="page-color-item">
                <div class="page-color-swatch" style="background-color: ${color};"></div>
                <span style="font-family: monospace;">${color}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
        )
        .join('')}
        </div>
      </div>
    </div>
    
    <script>
    (function() {
      // Ensure accordion works even if script loads late
      const attachAccordion = () => {
        document.querySelectorAll('.accordion-header').forEach(header => {
          if (header.dataset.ssaBound) return;
          header.dataset.ssaBound = 'true';
          header.addEventListener('click', function(e) {
            const container = this.closest('.accordion-container');
            if (container) {
              container.classList.toggle('open');
            }
          });
        });
      };
      attachAccordion();
      // Also catch any dynamic ones
      document.addEventListener('click', function(e) {
        const header = e.target.closest('.accordion-header');
        if (header && !header.dataset.ssaBound) {
          const container = header.closest('.accordion-container');
          if (container) container.classList.toggle('open');
        }
      });
    })();
    </script>
  `;
}
