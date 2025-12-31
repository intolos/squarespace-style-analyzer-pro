// page-selection-ui.js - Page Selection Modal UI
// Handles the premium user page selection interface

const PageSelectionUI = {

  // Store references for use across methods
  groupedUrls: null,
  navStructure: null,
  onStartAnalysis: null,

  // Show the page selection modal
  show: function(totalPages, domain, sitemapUrls, navStructure, groupedUrls, onCancel, onStartAnalysis, detectionMethod, detectionQuality) {
    // Hide any messages
    UIHelpers.hideMessages();
    
    const modal = document.getElementById('pageSelectionModal');
    const pagesFound = document.getElementById('pagesFound');
    
    // Store for later use
    this.groupedUrls = groupedUrls;
    this.navStructure = navStructure;
    this.onStartAnalysis = onStartAnalysis;
    this.detectionMethod = detectionMethod || 'nav';
    this.detectionQuality = detectionQuality || { isPoor: false };
    
    pagesFound.textContent = `Found ${totalPages} pages in sitemap`;
    
    // Hide main buttons, show modal
    document.getElementById('analyzeBtn').style.display = 'none';
    document.getElementById('analyzeDomainBtn').style.display = 'none';
    modal.style.display = 'block';
    
    // Populate navigation sections
    this.populateNavigationSections(groupedUrls);
    
    // Bind events for cancel and confirm
    document.getElementById('cancelPageSelection').onclick = () => {
      modal.style.display = 'none';
      document.getElementById('analyzeBtn').style.display = 'block';
      document.getElementById('analyzeDomainBtn').style.display = 'block';
      UIHelpers.hideMessages();
      if (onCancel) onCancel();
    };
    
    document.getElementById('confirmWithoutMobile').onclick = () => {
      this.handleNavigationSelection(false, false);
    };
    
    document.getElementById('confirmWithMobile').onclick = () => {
      this.handleNavigationSelection(true, false);
    };
    
    document.getElementById('confirmOnlyMobile').onclick = () => {
      this.handleNavigationSelection(true, true);
    };
  },

  // Populate navigation sections in the modal
  populateNavigationSections: function(groupedUrls) {
  const container = document.getElementById('navigationSections');
  container.innerHTML = '';
  
  let sectionIndex = 0;
  
  console.log('DEBUG: All section keys:', Object.keys(groupedUrls.sections));
  
  // Check for nav/sitemap mismatch
  const originalNavCount = this.navStructure && this.navStructure.sections ? this.navStructure.sections.length : 0;
  const finalSectionCount = Object.keys(groupedUrls.sections).length;
  
  // Show message if path pattern fallback was used OR if nav/sitemap mismatch detected
  // Only show one message to avoid duplication
  if (this.detectionMethod === 'pathPattern') {
    const infoMsg = document.createElement('div');
    infoMsg.style.cssText = 'background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 15px; font-size: 0.85rem; color: #92400e; line-height: 1.5;';
    infoMsg.innerHTML = '<strong>Note:</strong> Sitemap URLs do not match Navigation URLs. Therefore, it is not possible to show the individual navigation links as are shown when these match. In this situation, the sitemap is used, as best as possible, to show an alternative navigation grouping. You can always analyze pages using the page groupings with the limit and page offset controls.';
    container.appendChild(infoMsg);
  } else if (originalNavCount > 2 && finalSectionCount <= originalNavCount / 2) {
    // Show message if we detected nav links but most didn't match sitemap URLs
    // (more than half of detected nav links have no matching pages)
    const mismatchMsg = document.createElement('div');
    mismatchMsg.style.cssText = 'background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 15px; font-size: 0.85rem; color: #92400e; line-height: 1.5;';
    mismatchMsg.innerHTML = '<strong>Note:</strong> Sitemap URLs do not match Navigation URLs. Therefore, it is not possible to show the individual navigation links as are shown when these match. In this situation, you can still analyze pages using the page groupings with the limit and page offset controls.';
    container.appendChild(mismatchMsg);
  }
  
  // Add main navigation sections (up to 20, Home should be first)
  for (const key in groupedUrls.sections) {
    const section = groupedUrls.sections[key];
    
    console.log('DEBUG: Processing section:', key, 'name:', section.name, 'children:', section.children ? section.children.length : 0);
    
    // Check if this section has children
    const childCount = section.children ? section.children.length : 0;
    
    if (childCount > 0 && childCount <= 6) {
      console.log('DEBUG: Creating section WITH children for:', section.name);
      // Show parent with individual child checkboxes
      this.createSectionWithChildren(container, section, sectionIndex++);
    } else if (childCount > 6) {
      console.log('DEBUG: Creating section WITH subgroup for:', section.name);
      // Show parent, then subgroup for children
      this.createSectionWithSubgroup(container, section, sectionIndex++);
    } else {
      console.log('DEBUG: Creating regular section for:', section.name);
      // No children - just show the section
      this.createSectionCheckbox(container, section, sectionIndex++, 'section');
    }
  }
  
  // Add "Other Navigation Links" section if exists and has pages
  if (groupedUrls.otherNavLinks && groupedUrls.otherNavLinks.count > 0) {
    console.log('DEBUG: Creating otherNavLinks section');
    this.createSectionCheckbox(container, groupedUrls.otherNavLinks, sectionIndex++, 'otherNavLinks');
  }
  
  // Add blog section if exists
  if (groupedUrls.blog && groupedUrls.blog.count > 0) {
    console.log('DEBUG: Creating blog section');
    this.createSectionCheckbox(container, groupedUrls.blog, sectionIndex++, 'blog');
  }
  
  // Add other section if exists
  console.log('DEBUG other section:', groupedUrls.other);
  if (groupedUrls.other && groupedUrls.other.count > 0) {
    console.log('DEBUG: Creating other section checkbox');
    this.createSectionCheckbox(container, groupedUrls.other, sectionIndex++, 'other');
  }
  
  // Update selection summary
  this.updateSelectionSummary();
},

  // Create a standard section checkbox
  createSectionCheckbox: function(container, section, index, type) {
   try {
    console.log('DEBUG createSectionCheckbox:', section.name, 'count:', section.count, 'type:', type);
  
    const item = document.createElement('div');
    item.className = 'nav-section-item';
    item.dataset.index = index;
    item.dataset.type = type;
    item.dataset.pageCount = section.count;
    
    const isLarge = section.count > 10;
    
    item.innerHTML = `
      <div class="nav-section-left">
        <input type="checkbox" id="section-${index}" checked>
        <label for="section-${index}" class="nav-section-name">${section.name}</label>
      </div>
      <div class="nav-section-right">
        <span class="nav-section-count">${section.count} page${section.count === 1 ? '' : 's'}</span>
      </div>
    `;
    
    // Add limit option for large sections
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
    console.log('DEBUG: Appended item to container for:', section.name, 'container children:', container.children.length);
    
    // Bind checkbox change event
    const checkbox = item.querySelector('input[type="checkbox"]');
    const self = this;
    checkbox.addEventListener('change', function() {
      if (checkbox.checked) {
        item.classList.add('checked');
      } else {
        item.classList.remove('checked');
      }
      self.updateSelectionSummary();
    });
    
    // Bind limit checkbox and input
    if (isLarge) {
      const enableLimit = item.querySelector('.enable-limit');
      const limitInput = item.querySelector('.section-limit');
      
      enableLimit.addEventListener('change', function() {
        limitInput.disabled = !enableLimit.checked;
        self.updateSelectionSummary();
      });
      
      limitInput.addEventListener('input', function() {
        self.updateSelectionSummary();
      });
    }
    
    // Make the whole item clickable (except inputs and limit area)
    item.addEventListener('click', function(e) {
      // Don't toggle if clicking on any input
      if (e.target.type === 'checkbox' || e.target.type === 'number') {
        return;
      }
      // Don't toggle if clicking inside the limit input area
      if (e.target.closest('.section-limit-input')) {
        return;
      }
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change'));
    });
    
    // Mark as checked initially
    item.classList.add('checked');
    
     } catch (e) {
    console.error('ERROR in createSectionCheckbox:', e);
     }
    
  },

  // Update selection summary
  updateSelectionSummary: function() {
    const items = document.querySelectorAll('.nav-section-item');
    let totalPages = 0;
    let sectionsCount = 0;
    
    items.forEach(function(item) {
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (checkbox && checkbox.checked) {
        const hasChildren = item.dataset.hasChildren === 'true';
        const isChild = item.dataset.type === 'child';
        const isSubgroup = item.dataset.type === 'subgroup';
        const hasSubgroup = item.dataset.hasSubgroup === 'true';
        
        if (hasChildren) {
          sectionsCount++;
        } else if (hasSubgroup) {
          totalPages += 1;
          sectionsCount++;
        } else if (isChild) {
          totalPages += parseInt(item.dataset.pageCount) || 0;
        } else if (isSubgroup) {
          const enableLimit = item.querySelector('.enable-limit');
          const limitInput = item.querySelector('.section-limit');
          
          if (limitInput && enableLimit && enableLimit.checked) {
            const limit = parseInt(limitInput.value) || 0;
            totalPages += Math.min(limit, parseInt(item.dataset.pageCount));
          } else {
            totalPages += parseInt(item.dataset.pageCount) || 0;
          }
        } else {
          sectionsCount++;
          
          const enableLimit = item.querySelector('.enable-limit');
          const limitInput = item.querySelector('.section-limit');
          
          if (limitInput && enableLimit && enableLimit.checked) {
            const limit = parseInt(limitInput.value) || 0;
            totalPages += Math.min(limit, parseInt(item.dataset.pageCount));
          } else {
            totalPages += parseInt(item.dataset.pageCount) || 0;
          }
        }
      }
    });
    
    const summary = document.getElementById('selectionCount');
    summary.innerHTML = `<strong>${totalPages} pages</strong> selected across <strong>${sectionsCount} section${sectionsCount === 1 ? '' : 's'}</strong>`;
    
    const minutes = Math.ceil((totalPages * 15) / 60);
    const timeEstimate = document.getElementById('timeEstimate');
    timeEstimate.textContent = `⏱️ Estimated time: ~${minutes} minute${minutes === 1 ? '' : 's'}`;
    
    if (totalPages > 500) {
      timeEstimate.textContent += ' (large analysis - you can cancel anytime)';
    }
    
    // Update mobile time estimate on the "With Mobile" button
    const mobileTimeAddition = document.getElementById('mobileTimeAddition');
    if (mobileTimeAddition && totalPages > 0) {
      const mobileMinutes = Math.ceil((totalPages * 2) / 60);
      mobileTimeAddition.innerHTML = `<br>(+ ~${mobileMinutes} min)`;
    }
  },

  // Handle navigation selection when user clicks "Start Analysis"
  handleNavigationSelection: function(useMobileViewport, mobileOnly) {
    const items = document.querySelectorAll('.nav-section-item');
    const selectedUrls = [];
    const self = this;
    
    items.forEach(function(item) {
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (!checkbox || !checkbox.checked) return;
      
      const type = item.dataset.type;
      const index = item.dataset.index;
      
      if (type === 'child') {
        const parentIndex = parseInt(item.dataset.parentIndex);
        const childPathname = item.dataset.childPathname;
        
        const keys = Object.keys(self.groupedUrls.sections);
        let sectionIndex = 0;
        for (const key of keys) {
          if (sectionIndex === parentIndex) {
            const section = self.groupedUrls.sections[key];
            if (section.childUrls && section.childUrls[childPathname]) {
              selectedUrls.push(...section.childUrls[childPathname].urls);
            }
            break;
          }
          sectionIndex++;
        }
      } else if (type === 'subgroup') {
        const parentIndex = parseInt(item.dataset.parentIndex);
        
        const keys = Object.keys(self.groupedUrls.sections);
        let sectionIndex = 0;
        for (const key of keys) {
          if (sectionIndex === parentIndex) {
            const section = self.groupedUrls.sections[key];
            let subgroupUrls = section.urls.filter(function(url) {
              try {
                const urlObj = new URL(url);
                return urlObj.pathname !== section.pathname;
              } catch (e) {
                return true;
              }
            });
            
            const enableLimit = item.querySelector('.enable-limit');
            const limitInput = item.querySelector('.section-limit');
            const offsetInput = item.querySelector('.section-offset');
            
            if (limitInput && enableLimit && enableLimit.checked) {
              const limit = parseInt(limitInput.value) || subgroupUrls.length;
              const offset = Math.max(0, (parseInt(offsetInput?.value) || 1) - 1);
              subgroupUrls = subgroupUrls.slice(offset, offset + limit);
            }
            
            selectedUrls.push(...subgroupUrls);
            break;
          }
          sectionIndex++;
        }
      } else if (type === 'section') {
        const hasChildren = item.dataset.hasChildren === 'true';
        const hasSubgroup = item.dataset.hasSubgroup === 'true';
        
        const keys = Object.keys(self.groupedUrls.sections);
        const idx = parseInt(index);
        
        if (idx < keys.length) {
          const section = self.groupedUrls.sections[keys[idx]];
          
          if (hasChildren) {
            selectedUrls.push(section.navUrl);
          } else if (hasSubgroup) {
            selectedUrls.push(section.navUrl);
          } else {
            let sectionUrls = section.urls;
            
            const enableLimit = item.querySelector('.enable-limit');
            const limitInput = item.querySelector('.section-limit');
            const offsetInput = item.querySelector('.section-offset');
            
            if (limitInput && enableLimit && enableLimit.checked) {
              const limit = parseInt(limitInput.value) || sectionUrls.length;
              const offset = Math.max(0, (parseInt(offsetInput?.value) || 1) - 1);
              sectionUrls = sectionUrls.slice(offset, offset + limit);
            }
            
            selectedUrls.push(...sectionUrls);
          }
        }
      } else if (type === 'otherNavLinks') {
        let urls = self.groupedUrls.otherNavLinks.urls;
        
        const enableLimit = item.querySelector('.enable-limit');
        const limitInput = item.querySelector('.section-limit');
        const offsetInput = item.querySelector('.section-offset');
        
        if (limitInput && enableLimit && enableLimit.checked) {
          const limit = parseInt(limitInput.value) || urls.length;
          const offset = Math.max(0, (parseInt(offsetInput?.value) || 1) - 1);
          urls = urls.slice(offset, offset + limit);
        }
        
        selectedUrls.push(...urls);
      } else if (type === 'blog') {
        let urls = self.groupedUrls.blog.urls;
        
        const enableLimit = item.querySelector('.enable-limit');
        const limitInput = item.querySelector('.section-limit');
        const offsetInput = item.querySelector('.section-offset');
        
        if (limitInput && enableLimit && enableLimit.checked) {
          const limit = parseInt(limitInput.value) || urls.length;
          const offset = Math.max(0, (parseInt(offsetInput?.value) || 1) - 1);
          urls = urls.slice(offset, offset + limit);
        }
        
        selectedUrls.push(...urls);
      } else if (type === 'other') {
        let urls = self.groupedUrls.other.urls;
        
        const enableLimit = item.querySelector('.enable-limit');
        const limitInput = item.querySelector('.section-limit');
        const offsetInput = item.querySelector('.section-offset');
        
        if (limitInput && enableLimit && enableLimit.checked) {
          const limit = parseInt(limitInput.value) || urls.length;
          const offset = Math.max(0, (parseInt(offsetInput?.value) || 1) - 1);
          urls = urls.slice(offset, offset + limit);
        }
        
        selectedUrls.push(...urls);
      }
    });
    
    const uniqueUrls = [...new Set(selectedUrls)];
    const urlsToAnalyze = uniqueUrls;
    
    console.log('🎯 Selected URLs for analysis:', urlsToAnalyze.length);
    
    if (urlsToAnalyze.length === 0) {
      customAlert('Please select at least one section to analyze.');
      return;
    }
    
    document.getElementById('pageSelectionModal').style.display = 'none';
    
    if (this.onStartAnalysis) {
      this.onStartAnalysis(urlsToAnalyze, useMobileViewport, mobileOnly);
    }
  }
};

// Make globally available
window.PageSelectionUI = PageSelectionUI;