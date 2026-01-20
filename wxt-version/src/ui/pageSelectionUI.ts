import { UIHelpers, customAlert } from '../utils/uiHelpers';
import { GroupedUrls, NavStructure, UrlGroup, NavSection } from '../managers/domainAnalysis';

const DEBUG_PSU = false;

export const PageSelectionUI = {
  // Store references for use across methods
  groupedUrls: null as GroupedUrls | null,
  navStructure: null as NavStructure | null,
  onStartAnalysis: null as
    | ((urls: string[], useMobile: boolean, mobileOnly: boolean) => void)
    | null,
  detectionMethod: 'nav',
  detectionQuality: { isPoor: false },

  // Show the page selection modal
  show(
    totalPages: number,
    domain: string,
    sitemapUrls: string[],
    navStructure: NavStructure,
    groupedUrls: GroupedUrls,
    onCancel: () => void,
    onStartAnalysis: (urls: string[], useMobile: boolean, mobileOnly: boolean) => void,
    detectionMethod: string,
    detectionQuality: any
  ): void {
    // Hide any messages
    UIHelpers.hideMessages();

    const modal = document.getElementById('pageSelectionModal');
    const pagesFound = document.getElementById('pagesFound');

    if (!modal || !pagesFound) return;

    // Store for later use
    this.groupedUrls = groupedUrls;
    this.navStructure = navStructure;
    this.onStartAnalysis = onStartAnalysis;
    this.detectionMethod = detectionMethod || 'nav';
    this.detectionQuality = detectionQuality || { isPoor: false };

    pagesFound.textContent = `Found ${totalPages} pages in sitemap`;

    // Hide main buttons, show modal
    const analyzeBtn = document.getElementById('analyzeBtn');
    const analyzeDomainBtn = document.getElementById('analyzeDomainBtn');
    const statusSection = document.getElementById('statusSection');
    const siteInfo = document.getElementById('siteInfo');

    // IMPORTANT: Explicitly remove status and site info from DOM to ensure they are gone
    if (statusSection) statusSection.remove();
    if (siteInfo) siteInfo.remove();
    if (analyzeBtn) analyzeBtn.style.display = 'none';
    if (analyzeDomainBtn) analyzeDomainBtn.style.display = 'none';

    // Move modal to the very top of the container
    const mainInterface = document.getElementById('mainInterface');
    if (mainInterface && modal) {
      mainInterface.insertBefore(modal, mainInterface.firstChild);
    }

    modal.style.setProperty('display', 'block', 'important');

    // Populate navigation sections
    this.populateNavigationSections(groupedUrls);

    // Bind events for cancel and confirm
    const cancelBtn = document.getElementById('cancelPageSelection');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        modal.style.display = 'none';
        if (analyzeBtn) analyzeBtn.style.display = 'block';
        if (analyzeDomainBtn) analyzeDomainBtn.style.display = 'block';
        UIHelpers.hideMessages();
        if (onCancel) onCancel();
      };
    }

    const confirmWithoutMobile = document.getElementById('confirmWithoutMobile');
    if (confirmWithoutMobile) {
      confirmWithoutMobile.onclick = () => {
        this.handleNavigationSelection(false, false);
      };
    }

    const confirmWithMobile = document.getElementById('confirmWithMobile');
    if (confirmWithMobile) {
      confirmWithMobile.onclick = () => {
        this.handleNavigationSelection(true, false);
      };
    }

    const confirmOnlyMobile = document.getElementById('confirmOnlyMobile');
    if (confirmOnlyMobile) {
      confirmOnlyMobile.onclick = () => {
        this.handleNavigationSelection(true, true);
      };
    }
  },

  // Populate navigation sections in the modal
  populateNavigationSections(groupedUrls: GroupedUrls): void {
    const container = document.getElementById('navigationSections');
    if (!container) return;

    container.innerHTML = '';

    let sectionIndex = 0;

    if (DEBUG_PSU) console.log('DEBUG: All section keys:', Object.keys(groupedUrls.sections));

    // Check for nav/sitemap mismatch
    const originalNavCount =
      this.navStructure && this.navStructure.sections ? this.navStructure.sections.length : 0;
    const finalSectionCount = Object.keys(groupedUrls.sections).length;

    // Show message if path pattern fallback was used OR if nav/sitemap mismatch detected
    if (this.detectionMethod === 'pathPattern') {
      const infoMsg = document.createElement('div');
      infoMsg.style.cssText =
        'background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 15px; font-size: 0.85rem; color: #92400e; line-height: 1.5;';
      infoMsg.innerHTML =
        '<strong>Note:</strong> Sitemap URLs do not match Navigation URLs. Therefore, it is not possible to show the individual navigation links as are shown when these match. In this situation, the sitemap is used, as best as possible, to show an alternative navigation grouping. You can always analyze pages using the page groupings with the limit and page offset controls.';
      container.appendChild(infoMsg);
    } else if (originalNavCount > 2 && finalSectionCount <= originalNavCount / 2) {
      // Show message if we detected nav links but most didn't match sitemap URLs
      const mismatchMsg = document.createElement('div');
      mismatchMsg.style.cssText =
        'background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 15px; font-size: 0.85rem; color: #92400e; line-height: 1.5;';
      mismatchMsg.innerHTML =
        '<strong>Note:</strong> Sitemap URLs do not match Navigation URLs. Therefore, it is not possible to show the individual navigation links as are shown when these match. In this situation, you can still analyze pages using the page groupings with the limit and page offset controls.';
      container.appendChild(mismatchMsg);
    }

    // Add main navigation sections (up to 20)
    for (const key in groupedUrls.sections) {
      const section = groupedUrls.sections[key];

      // Note: original code checked "children" prop but UrlGroup doesn't have "children" in the standard interface
      // However, if "groupUrlsByNavigation" logic used it (it didn't seem to populate "children"),
      // wait, "groupUrlsByNavigation" only populated "urls".
      // But the UI code checked `section.children`.
      // Legacy code might have had more props.
      // Based on `domain-analysis-manager.js` legacy, `grouped.sections[key]` had `urls`, `name`, `pathname`, `isGroup`.
      // It didn't seem to have `children` unless I missed it.
      // Ah, the UI code has a `createSectionWithChildren`.
      // But looking at `domain-analysis-manager.js` lines 528-535, no children prop.
      // Maybe this part of `page-selection-ui.js` was for a future feature or I missed something.
      // The `DomainAnalysisManager` in `domain-analysis-manager.js` definitely populated `urls`.
      // I'll stick to treating them as flat sections unless I see `children` usage.
      // Wait, `createSectionCheckbox` handles sections.

      // Actually, looking at `page-selection-ui.js` lines 118-124, it checks `section.children`.
      // Use `section.urls` for now. Or assume it handles simple groups.
      // I'll implement `createSectionCheckbox` and skip the `children` checks if they don't apply,
      // or check if `section` object actually has children in runtime.
      // If I look at `DomainAnalysisManager.ts`, `UrlGroup` interface doesn't have children.
      // I'll stick to `createSectionCheckbox` for all for now, assuming flat groups.

      this.createSectionCheckbox(container, section, sectionIndex++, 'section');
    }

    if (groupedUrls.blog && groupedUrls.blog.count > 0) {
      this.createSectionCheckbox(container, groupedUrls.blog, sectionIndex++, 'blog');
    }

    if (groupedUrls.other && groupedUrls.other.count > 0) {
      this.createSectionCheckbox(container, groupedUrls.other, sectionIndex++, 'other');
    }

    this.updateSelectionSummary();
  },

  createSectionCheckbox(
    container: HTMLElement,
    section: UrlGroup,
    index: number,
    type: string
  ): void {
    try {
      if (DEBUG_PSU)
        console.log(
          'DEBUG createSectionCheckbox:',
          section.name,
          'count:',
          section.count,
          'type:',
          type
        );

      const item = document.createElement('div');
      item.className = 'nav-section-item';
      item.dataset.index = index.toString();
      item.dataset.type = type;
      item.dataset.pageCount = section.count.toString();

      const isLarge = section.count > 10;

      item.innerHTML = `
        <div class="nav-section-left">
          <input type="checkbox" id="section-${index}" checked>
          <label for="section-${index}" class="nav-section-name">${section.name}</label>
        </div>
        <div class="nav-section-right">
          <span class="nav-section-count">${section.count} page${
            section.count === 1 ? '' : 's'
          }</span>
        </div>
      `;

      if (isLarge) {
        const limitDiv = document.createElement('div');
        limitDiv.className = 'section-limit-input';
        limitDiv.style.display = 'flex';
        limitDiv.style.flexDirection = 'column';
        limitDiv.style.gap = '8px';
        limitDiv.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <label style="display: flex; align-items: center; gap: 4px;">
              <input type="checkbox" class="enable-limit" checked>
              <span style="font-size: 0.8rem; color: #9c640c;">Limit to:</span>
            </label>
            <input type="number" 
                   class="section-limit" 
                   min="1" 
                   max="${section.count}" 
                   value="${Math.min(50, section.count)}"
                   style="width: 60px;">
            <span style="font-size: 0.75rem; color: #9c640c;">pages starting at</span>
            <input type="number" 
                   class="section-offset" 
                   min="1" 
                   max="${section.count}" 
                   value="1"
                   style="width: 60px;">
            <span style="font-size: 0.75rem; color: #9c640c;">of ${section.count}</span>
          </div>
        `;
        item.appendChild(limitDiv);
      }

      container.appendChild(item);

      const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
      const self = this;
      checkbox.addEventListener('change', function () {
        if (checkbox.checked) {
          item.classList.add('checked');
        } else {
          item.classList.remove('checked');
        }
        self.updateSelectionSummary();
      });

      if (isLarge) {
        const enableLimit = item.querySelector('.enable-limit') as HTMLInputElement;
        const limitInput = item.querySelector('.section-limit') as HTMLInputElement;

        if (enableLimit && limitInput) {
          enableLimit.addEventListener('change', function () {
            limitInput.disabled = !enableLimit.checked;
            self.updateSelectionSummary();
          });

          limitInput.addEventListener('input', function () {
            self.updateSelectionSummary();
          });
        }
      }

      item.addEventListener('click', function (e) {
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.closest('.section-limit-input') ||
          target.type === 'checkbox' ||
          target.type === 'number'
        ) {
          return;
        }
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      });

      item.classList.add('checked');
    } catch (e) {
      if (DEBUG_PSU) console.error('ERROR in createSectionCheckbox:', e);
    }
  },

  updateSelectionSummary(): void {
    const items = document.querySelectorAll('.nav-section-item');
    let totalPages = 0;
    let sectionsCount = 0;

    items.forEach(function (item) {
      const el = item as HTMLElement;
      const checkbox = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (checkbox && checkbox.checked) {
        sectionsCount++;

        const enableLimit = el.querySelector('.enable-limit') as HTMLInputElement;
        const limitInput = el.querySelector('.section-limit') as HTMLInputElement;
        const pageCount = parseInt(el.dataset.pageCount || '0') || 0;

        if (limitInput && enableLimit && enableLimit.checked) {
          const limit = parseInt(limitInput.value) || 0;
          totalPages += Math.min(limit, pageCount);
        } else {
          totalPages += pageCount;
        }
      }
    });

    const summary = document.getElementById('selectionCount');
    if (summary) {
      summary.innerHTML = `<strong>${totalPages} pages</strong> selected across <strong>${sectionsCount} section${
        sectionsCount === 1 ? '' : 's'
      }</strong>`;
    }

    // IMPORTANT: Standard analysis time is ~20s per page (full load + analysis). Fixed 2026-01-20.
    const minutes = Math.ceil((totalPages * 20) / 60);
    const timeEstimate = document.getElementById('timeEstimate');
    if (timeEstimate) {
      timeEstimate.textContent = `⏱️ Estimated time: ~${minutes} minute${minutes === 1 ? '' : 's'}`;

      if (totalPages > 500) {
        timeEstimate.textContent += ' (large analysis - you can cancel anytime)';
      }
    }

    // Mobile analysis time addition (approx 4s per page extra)
    // IMPORTANT: Ensure we update the correct element
    const mobileTimeSpan = document.getElementById('mobileTimeAddition');
    if (mobileTimeSpan) {
      const mobileMinutes = Math.ceil((totalPages * 4) / 60);
      mobileTimeSpan.textContent = ` (+ ~${mobileMinutes} min)`;
      mobileTimeSpan.style.display = 'inline'; // Ensure it is visible
    }
  },

  handleNavigationSelection(useMobile: boolean, mobileOnly: boolean): void {
    if (!this.groupedUrls) return; // Should not happen

    const items = document.querySelectorAll('.nav-section-item');
    const selectedUrls: string[] = [];
    const self = this;

    items.forEach(function (item) {
      const el = item as HTMLElement;
      const checkbox = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (!checkbox || !checkbox.checked) return;

      const type = el.dataset.type;
      const indexStr = el.dataset.index;
      if (!indexStr) return;

      const keys = Object.keys(self.groupedUrls!.sections);
      const idx = parseInt(indexStr);

      if (type === 'section') {
        if (idx < keys.length) {
          const sectionKey = keys[idx];
          const section = self.groupedUrls!.sections[sectionKey];
          let sectionUrls = section.urls;

          const enableLimit = el.querySelector('.enable-limit') as HTMLInputElement;
          const limitInput = el.querySelector('.section-limit') as HTMLInputElement;
          const offsetInput = el.querySelector('.section-offset') as HTMLInputElement;

          if (limitInput && enableLimit && enableLimit.checked) {
            const limit = parseInt(limitInput.value) || sectionUrls.length;
            const offset = Math.max(0, (parseInt(offsetInput?.value) || 1) - 1);
            sectionUrls = sectionUrls.slice(offset, offset + limit);
          }

          selectedUrls.push(...sectionUrls);
        }
      } else if (type === 'blog') {
        let urls = self.groupedUrls!.blog.urls;
        // Apply limits for blog too if present (logic same as section)
        const enableLimit = el.querySelector('.enable-limit') as HTMLInputElement;
        const limitInput = el.querySelector('.section-limit') as HTMLInputElement;
        const offsetInput = el.querySelector('.section-offset') as HTMLInputElement;

        if (limitInput && enableLimit && enableLimit.checked) {
          const limit = parseInt(limitInput.value) || urls.length;
          const offset = Math.max(0, (parseInt(offsetInput?.value) || 1) - 1);
          urls = urls.slice(offset, offset + limit);
        }
        selectedUrls.push(...urls);
      } else if (type === 'other') {
        let urls = self.groupedUrls!.other.urls;
        // Limit logic
        const enableLimit = el.querySelector('.enable-limit') as HTMLInputElement;
        const limitInput = el.querySelector('.section-limit') as HTMLInputElement;
        const offsetInput = el.querySelector('.section-offset') as HTMLInputElement;

        if (limitInput && enableLimit && enableLimit.checked) {
          const limit = parseInt(limitInput.value) || urls.length;
          const offset = Math.max(0, (parseInt(offsetInput?.value) || 1) - 1);
          urls = urls.slice(offset, offset + limit);
        }
        selectedUrls.push(...urls);
      }
    });

    const uniqueUrls = [...new Set(selectedUrls)];

    if (DEBUG_PSU) console.log('🎯 Selected URLs for analysis:', uniqueUrls.length);

    if (uniqueUrls.length === 0) {
      customAlert('Please select at least one section to analyze.');
      return;
    }

    const modal = document.getElementById('pageSelectionModal');
    if (modal) modal.style.display = 'none';

    if (this.onStartAnalysis) {
      this.onStartAnalysis(uniqueUrls, useMobile, mobileOnly);
    }
  },
};
