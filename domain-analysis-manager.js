// domain-analysis-manager.js - Domain Analysis and Navigation Structure
// Handles sitemap fetching, navigation parsing, and URL grouping

const DomainAnalysisManager = {

  // Fetch sitemap from domain
  fetchSitemap: async function(domain) {
    console.log('🔍 Starting sitemap discovery for:', domain);
    
    // Step 1: Check robots.txt for sitemap declarations
    var robotsSitemaps = await this.getSitemapsFromRobotsTxt(domain);
    if (robotsSitemaps.length > 0) {
      console.log('📋 Found sitemaps in robots.txt:', robotsSitemaps);
      var urls = await this.fetchSitemapsFromList(robotsSitemaps);
      if (urls && urls.length > 0) {
        console.log('✅ Got', urls.length, 'URLs from robots.txt sitemaps');
        return urls;
      }
    }
    
    // Step 2: Try common sitemap URL patterns
    var sitemapUrls = [
      'https://' + domain + '/sitemap.xml',
      'https://' + domain + '/sitemap_index.xml',
      'https://' + domain + '/sitemap-index.xml',
      'https://' + domain + '/sitemaps/sitemap.xml',
      'https://' + domain + '/sitemap/sitemap.xml',
      'https://' + domain + '/page-sitemap.xml',
      'https://' + domain + '/post-sitemap.xml',
      'https://' + domain + '/sitemap1.xml',
      'https://www.' + domain + '/sitemap.xml',
      'https://www.' + domain + '/sitemap_index.xml',
      'https://www.' + domain + '/sitemap-index.xml'
    ];
    
    // Add language/region specific patterns for international sites
    var langPrefixes = ['en', 'en-us', 'en-gb', 'us'];
    for (var i = 0; i < langPrefixes.length; i++) {
      sitemapUrls.push('https://' + domain + '/' + langPrefixes[i] + '/sitemap.xml');
    }

    for (var i = 0; i < sitemapUrls.length; i++) {
      var sitemapUrl = sitemapUrls[i];
      try {
        console.log('🔎 Trying:', sitemapUrl);
        var urls = await this.fetchAndParseSitemapUrl(sitemapUrl);
        if (urls && urls.length > 0) {
          console.log('✅ Found', urls.length, 'URLs from', sitemapUrl);
          return urls;
        }
      } catch (error) {
        continue;
      }
    }
    
    console.log('❌ No sitemap found for', domain);
    return null;
  },

  // Get sitemap URLs from robots.txt
  getSitemapsFromRobotsTxt: async function(domain) {
    var robotsUrls = [
      'https://' + domain + '/robots.txt',
      'https://www.' + domain + '/robots.txt'
    ];
    
    var sitemaps = [];
    
    for (var i = 0; i < robotsUrls.length; i++) {
      try {
        var response = await fetch(robotsUrls[i]);
        if (!response.ok) continue;
        
        var text = await response.text();
        var lines = text.split('\n');
        
        for (var j = 0; j < lines.length; j++) {
          var line = lines[j].trim();
          // Look for Sitemap: directive (case-insensitive)
          if (line.toLowerCase().startsWith('sitemap:')) {
            var sitemapUrl = line.substring(8).trim();
            if (sitemapUrl && !sitemaps.includes(sitemapUrl)) {
              sitemaps.push(sitemapUrl);
            }
          }
        }
        
        // If we found sitemaps, no need to check www variant
        if (sitemaps.length > 0) break;
        
      } catch (error) {
        console.log('Could not fetch robots.txt from', robotsUrls[i]);
        continue;
      }
    }
    
    return sitemaps;
  },

  // Fetch URLs from a list of sitemap URLs
  fetchSitemapsFromList: async function(sitemapUrls) {
    var allUrls = [];
    var maxSubSitemaps = 15; // Limit sub-sitemaps to prevent overwhelming large sites
    var processedCount = 0;
    
    for (var i = 0; i < sitemapUrls.length && processedCount < maxSubSitemaps; i++) {
      try {
        var urls = await this.fetchAndParseSitemapUrl(sitemapUrls[i]);
        if (urls && urls.length > 0) {
          allUrls.push.apply(allUrls, urls);
          processedCount++;
        }
      } catch (error) {
        console.error('Failed to fetch sitemap:', sitemapUrls[i], error);
      }
    }
    
    return allUrls;
  },

  // Fetch and parse a single sitemap URL (handles index files recursively)
  fetchAndParseSitemapUrl: async function(sitemapUrl) {
    try {
      var response = await fetch(sitemapUrl);
      if (!response.ok) return null;
      
      var text = await response.text();
      var urlMatches = text.matchAll(/<loc>(.*?)<\/loc>/g);
      var urls = Array.from(urlMatches).map(function(match) { return match[1].trim(); });
      
      if (urls.length === 0) return null;
      
      var isSitemapIndex = text.includes('<sitemap>') || text.includes('<sitemapindex>');
      
      if (isSitemapIndex) {
        console.log('📂 Found sitemap index with', urls.length, 'sub-sitemaps');
        var allUrls = [];
        var maxSubSitemaps = 15; // Limit to prevent very long waits on huge sites
        
        for (var j = 0; j < Math.min(urls.length, maxSubSitemaps); j++) {
          try {
            console.log('  📄 Fetching sub-sitemap', (j + 1) + '/' + Math.min(urls.length, maxSubSitemaps) + ':', urls[j]);
            var subResponse = await fetch(urls[j]);
            if (!subResponse.ok) continue;
            
            var subText = await subResponse.text();
            var subMatches = subText.matchAll(/<loc>(.*?)<\/loc>/g);
            var subUrls = Array.from(subMatches).map(function(m) { return m[1].trim(); });
            allUrls.push.apply(allUrls, subUrls);
            
            // Limit total URLs to prevent memory issues
            if (allUrls.length > 500000) {
              console.log('⚠️ Reached 500000 URL limit, stopping sitemap fetch');
              break;
            }
          } catch (e) {
            console.error('Failed to fetch sub-sitemap:', urls[j], e);
          }
        }
        
        if (urls.length > maxSubSitemaps) {
          console.log('ℹ️ Note: Site has', urls.length, 'sub-sitemaps, only processed first', maxSubSitemaps);
        }
        
        return allUrls;
      }
      
      return urls;
    } catch (error) {
      return null;
    }
  },

  // Fetch and parse navigation structure from homepage
  fetchNavigationStructure: async function(domain) {
    try {
      var homepageUrls = [
        'https://' + domain,
        'https://www.' + domain
      ];

      for (var i = 0; i < homepageUrls.length; i++) {
        try {
          var response = await fetch(homepageUrls[i]);
          if (!response.ok) continue;
          
          var html = await response.text();
          return this.parseNavigation(html, domain);
        } catch (e) {
          console.error('Failed to fetch homepage:', e);
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching navigation:', error);
      return null;
    }
  },

  // Parse navigation from HTML
  parseNavigation: function(html, domain) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    
    var navStructure = {
      sections: [],
      blogSection: null,
      allNavUrls: new Set()
    };

    // Find navigation element
    // Squarespace-specific selectors first, then generic selectors
    var navSelectors = [
      // Squarespace-specific
      'nav[data-content-field="navigation"]',
      '.header-nav',
      '.header-nav-wrapper',
      '.header-menu',
      '[data-nc-group="top"]',
      
      // Generic selectors for non-Squarespace sites
      'header nav',
      '#header nav',
      'nav[role="navigation"]',
      '[role="navigation"]',
      '.main-nav',
      '.main-navigation',
      '.primary-nav',
      '.primary-navigation',
      '.site-nav',
      '.site-navigation',
      '#main-nav',
      '#primary-nav',
      '.navbar-nav',
      '.nav-menu',
      'nav.navigation',
      '#navigation',
      '.global-nav',
      '.top-nav',
      '.masthead nav',
      '[class*="main-menu"]',
      '[class*="primary-menu"]'
    ];

    var navElement = null;
    for (var i = 0; i < navSelectors.length; i++) {
      navElement = doc.querySelector(navSelectors[i]);
      if (navElement) {
        console.log('Found nav element with selector:', navSelectors[i]);
        break;
      }
    }

    if (!navElement) {
      console.log('No navigation found, using fallback');
      return this.createFallbackNavStructure(domain);
    }

    // Find all nav items - both individual links and dropdowns
    var processedPaths = new Set();
    
// Find dropdown/folder groups first
    // Squarespace-specific selectors first, then generic selectors
    var folderSelectors = [
      // Squarespace-specific
      '.header-nav-item--folder',
      '.header-nav-folder-item',
      '.header-menu-nav-folder',
      
      // Generic selectors for non-Squarespace sites
      '.menu-item-has-children',           // WordPress
      '.has-submenu',
      '.has-children',
      '.has-dropdown',
      '.dropdown',
      '.nav-item.dropdown',                // Bootstrap
      '[class*="dropdown"]',
      '[class*="submenu-parent"]',
      '[aria-haspopup="true"]',            // Accessibility attribute
      'li.parent',
      '[class*="has-mega-menu"]'
    ];
    
    var folders = [];
    for (var i = 0; i < folderSelectors.length; i++) {
      var found = navElement.querySelectorAll(folderSelectors[i]);
      if (found.length > 0) {
        folders = found;
        console.log('Found folders with selector:', folderSelectors[i], 'count:', found.length);
        break;
      }
    }
    
    // Process each folder/dropdown
    for (var i = 0; i < folders.length; i++) {
      var folder = folders[i];
      
      // Get folder name from title element
      // Squarespace-specific and generic selectors
      var titleEl = folder.querySelector('.header-nav-folder-title, .header-menu-nav-folder-title, :scope > a, :scope > span, :scope > button, [class*="nav-link"], [class*="menu-link"]');
      var folderName = null;
      
      if (titleEl) {
        folderName = titleEl.textContent.trim();
      } else {
        // Try first text content
        var firstText = folder.childNodes[0];
        if (firstText && firstText.textContent) {
          folderName = firstText.textContent.trim().split('\n')[0].trim();
        }
      }
      
      if (!folderName || folderName.length < 2) continue;
      
      // Skip "search" 
      if (folderName.toLowerCase() === 'search') continue;
      
      // Get child links from folder content
      // Squarespace-specific and generic selectors
      var childPaths = [];
      var contentEl = folder.querySelector('.header-nav-folder-content, .header-menu-nav-folder-content, .sub-menu, .submenu, .dropdown-menu, [class*="submenu"], [class*="dropdown-content"], ul.children, :scope > ul');
      
      if (contentEl) {
        var childLinks = contentEl.querySelectorAll('a[href]');
        for (var j = 0; j < childLinks.length; j++) {
          var href = childLinks[j].getAttribute('href');
          var normalized = this.normalizeUrl(href, domain);
          
          if (normalized && !processedPaths.has(normalized.pathname)) {
            childPaths.push(normalized.pathname);
            processedPaths.add(normalized.pathname);
            navStructure.allNavUrls.add(normalized.url);
          }
        }
      }
      
      if (childPaths.length > 0) {
        // Check if this is blog-related
        var isBlog = folderName.toLowerCase().includes('blog') || 
                     folderName.toLowerCase().includes('news');
        
        if (isBlog) {
          navStructure.blogSection = {
            name: folderName,
            pathnames: childPaths,
            isBlog: true
          };
        } else {
          navStructure.sections.push({
            name: folderName,
            pathnames: childPaths,
            isGroup: true
          });
        }
        
        console.log('Added dropdown group:', folderName, 'with', childPaths.length, 'child paths');
      }
    }
    
    // 2. Find individual nav links (not in folders)
    var allNavLinks = navElement.querySelectorAll('a[href]');
    
		// Track dropdown names to avoid adding them as individual links
		var dropdownNames = new Set();
		for (var i = 0; i < navStructure.sections.length; i++) {
			if (navStructure.sections[i].isGroup) {
				dropdownNames.add(navStructure.sections[i].name.toLowerCase());
			}
		}
		
		for (var i = 0; i < allNavLinks.length; i++) {
			var link = allNavLinks[i];
			var href = link.getAttribute('href');
			if (!href || href === '#') continue;
			
			var linkText = link.textContent.trim();
			
			// Skip if this is a dropdown name (already added as group)
			if (dropdownNames.has(linkText.toLowerCase())) continue;
      
      if (!linkText || linkText.length < 2) continue;
      
      // Skip search, menu, cart, etc.
      var lowerText = linkText.toLowerCase();
      if (lowerText === 'search' || lowerText === 'menu' || lowerText === 'cart' || 
          lowerText === 'close' || lowerText.includes('skip')) continue;
      
      var normalized = this.normalizeUrl(href, domain);
      if (!normalized) continue;
      
      // Skip if already processed (part of a dropdown)
      if (processedPaths.has(normalized.pathname)) continue;
      
      // Skip if this link is inside a folder content area
      if (link.closest('.header-nav-folder-content, .header-menu-nav-folder-content')) continue;
      
      processedPaths.add(normalized.pathname);
      navStructure.allNavUrls.add(normalized.url);
      
      // Check if blog
      var isBlog = normalized.pathname.includes('/blog') || 
                   normalized.pathname.includes('/news') ||
                   lowerText.includes('blog') || 
                   lowerText.includes('news');
      
      if (isBlog) {
        if (!navStructure.blogSection) {
          navStructure.blogSection = {
            name: linkText,
            pathname: normalized.pathname,
            url: normalized.url,
            isBlog: true
          };
        }
      } else {
        navStructure.sections.push({
          name: linkText,
          pathname: normalized.pathname,
          url: normalized.url,
          isGroup: false
        });
        console.log('Added individual link:', linkText);
      }
    }

		// 3. Always add Home as first section
		// Remove any existing Home entry first
		navStructure.sections = navStructure.sections.filter(function(s) {
			return s.pathname !== '/' && s.name.toLowerCase() !== 'home';
		});
		
		// Add Home at the beginning
		navStructure.sections.unshift({
			name: 'Home',
			pathname: '/',
			url: 'https://' + domain + '/',
			isGroup: false
		});
		navStructure.allNavUrls.add('https://' + domain + '/');

    console.log('🔍 Navigation structure parsed:', navStructure);
    return navStructure;
  },

  // Normalize URL helper
  normalizeUrl: function(href, domain) {
    if (!href) return null;
    if (href.startsWith('#')) return null;

    var url;
    if (href.startsWith('/')) {
      url = 'https://' + domain + href;
    } else if (href.startsWith('http')) {
      url = href;
    } else {
      url = 'https://' + domain + '/' + href;
    }

    try {
      var urlObj = new URL(url);
      // Only include URLs from same domain
      var domainBase = domain.replace('www.', '');
      if (!urlObj.hostname.includes(domainBase)) {
        return null;
      }
      return {
        url: url,
        pathname: urlObj.pathname
      };
    } catch (e) {
      return null;
    }
  },

  // Create fallback nav structure
  createFallbackNavStructure: function(domain) {
    return {
      sections: [
        { name: 'Home', pathname: '/', url: 'https://' + domain + '/', isGroup: false }
      ],
      blogSection: null,
      allNavUrls: new Set(['https://' + domain + '/'])
    };
  },

  // Group sitemap URLs by navigation sections
  groupUrlsByNavigation: function(sitemapUrls, navStructure, domain) {
    var grouped = {
      sections: {},
      blog: {
        name: 'Blog',
        urls: [],
        count: 0
      },
      other: {
        name: 'Other Pages',
        urls: [],
        count: 0
      }
    };

    var self = this;

    // Initialize sections from nav structure
    if (navStructure && navStructure.sections) {
      for (var i = 0; i < navStructure.sections.length; i++) {
        var section = navStructure.sections[i];
        var key = this.sanitizeKey(section.name);
        grouped.sections[key] = {
          name: section.name,
          pathname: section.pathname,
          pathnames: section.pathnames || null,  // For groups
          isGroup: section.isGroup,
          urls: [],
          count: 0
        };
      }
    }

    // Group each sitemap URL
    for (var i = 0; i < sitemapUrls.length; i++) {
      var url = sitemapUrls[i];
      try {
        var urlObj = new URL(url);
        var pathname = urlObj.pathname;
        
        // Check if blog URL
        if (this.isBlogUrl(pathname)) {
          grouped.blog.urls.push(url);
          grouped.blog.count++;
          continue;
        }

        // Try to match to a nav section
        var matched = false;
        
        for (var key in grouped.sections) {
          var section = grouped.sections[key];
          
          if (section.isGroup && section.pathnames) {
            // Group - check if URL matches any child pathname
            for (var j = 0; j < section.pathnames.length; j++) {
              var childPath = section.pathnames[j];
              if (pathname === childPath || pathname.startsWith(childPath + '/')) {
                section.urls.push(url);
                section.count++;
                matched = true;
                break;
              }
            }
          } else if (section.pathname) {
            // Individual link - check exact match or starts with
            if (section.pathname === '/') {
              // Home - only exact match
              if (pathname === '/') {
                section.urls.push(url);
                section.count++;
                matched = true;
              }
            } else {
              // Strip file extensions for matching
              var sectionPath = section.pathname.replace(/\.(html?|php|aspx?)$/i, '');
              var urlPath = pathname.replace(/\.(html?|php|aspx?)$/i, '');
              
              // Check exact match or URL starts with section path
              if (pathname === section.pathname || 
                  urlPath === sectionPath ||
                  urlPath.startsWith(sectionPath + '/')) {
                section.urls.push(url);
                section.count++;
                matched = true;
              }
            }
          }
          
          if (matched) break;
        }

        // If no match, add to Other
        if (!matched) {
          grouped.other.urls.push(url);
          grouped.other.count++;
        }

      } catch (e) {
        console.error('Error processing URL:', url, e);
        grouped.other.urls.push(url);
        grouped.other.count++;
      }
    }

		// Remove empty sections (but never remove Home)
		for (var key in grouped.sections) {
			if (grouped.sections[key].count === 0 && key !== 'home') {
				delete grouped.sections[key];
			}
		}
		
		// Ensure Home always has count of 1 and the root URL
		if (grouped.sections['home']) {
			if (grouped.sections['home'].count === 0) {
				grouped.sections['home'].urls.push('https://' + domain + '/');
				grouped.sections['home'].count = 1;
			}
		}

    // Log statistics
    console.log('📊 Grouping statistics:');
    console.log('  Navigation sections:', Object.keys(grouped.sections).length);
    console.log('  Blog posts:', grouped.blog.count);
    console.log('  Other pages:', grouped.other.count);
    
    for (var key in grouped.sections) {
      console.log('  ' + grouped.sections[key].name + ': ' + grouped.sections[key].count + ' pages');
    }

    return grouped;
  },

  // Check if URL is a blog post
  isBlogUrl: function(pathname) {
    var blogPatterns = [
      '/blog/',
      '/news/',
      '/articles/',
      '/posts/',
      '/insights/'
    ];

    var lowerPath = pathname.toLowerCase();
    for (var i = 0; i < blogPatterns.length; i++) {
      if (lowerPath.includes(blogPatterns[i])) {
        return true;
      }
    }
    return false;
  },

  // Convert name to safe key
  sanitizeKey: function(name) {
    return name.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  },

  // Check if detection quality is "poor"
  // Returns { isPoor: boolean, reason: string }
  checkDetectionQuality: function(navStructure, groupedUrls, totalSitemapUrls) {
    var originalNavCount = navStructure && navStructure.sections ? navStructure.sections.length : 0;
    var matchedSectionCount = Object.keys(groupedUrls.sections).length;
    var otherPagesCount = groupedUrls.other ? groupedUrls.other.count : 0;
    var otherPagesPercent = totalSitemapUrls > 0 ? (otherPagesCount / totalSitemapUrls) * 100 : 0;
    var matchPercent = originalNavCount > 0 ? (matchedSectionCount / originalNavCount) * 100 : 0;
    
    console.log('📊 Detection quality check:');
    console.log('  Original nav links detected:', originalNavCount);
    console.log('  Matched to sitemap:', matchedSectionCount);
    console.log('  Match percent:', matchPercent.toFixed(1) + '%');
    console.log('  Other pages percent:', otherPagesPercent.toFixed(1) + '%');
    
    // Criteria 1: Less than 60% of detected nav links match sitemap URLs
    if (originalNavCount > 0 && matchPercent < 60) {
      return { 
        isPoor: true, 
        reason: 'Only ' + matchPercent.toFixed(0) + '% of detected nav links matched sitemap URLs',
        matchPercent: matchPercent,
        otherPagesPercent: otherPagesPercent
      };
    }
    
    // Criteria 2: "Other Pages" contains more than 80% of total sitemap URLs
    if (otherPagesPercent > 80) {
      return { 
        isPoor: true, 
        reason: otherPagesPercent.toFixed(0) + '% of sitemap URLs are uncategorized',
        matchPercent: matchPercent,
        otherPagesPercent: otherPagesPercent
      };
    }
    
    return { 
      isPoor: false, 
      reason: 'Detection quality acceptable',
      matchPercent: matchPercent,
      otherPagesPercent: otherPagesPercent
    };
  },

  // Step 3: Group URLs by path pattern when nav detection fails
  groupUrlsByPathPattern: function(sitemapUrls, domain) {
    console.log('📁 Grouping URLs by path pattern...');
    
    var grouped = {
      sections: {},
      blog: { name: 'Blog', urls: [], count: 0 },
      other: { name: 'Other Pages', urls: [], count: 0 }
    };
    
    var pathCounts = {};
    var urlsByPath = {};
    
    // Analyze all URLs to find common path prefixes
    for (var i = 0; i < sitemapUrls.length; i++) {
      var url = sitemapUrls[i];
      try {
        var urlObj = new URL(url);
        var pathname = urlObj.pathname;
        
        // Check if blog URL first
        if (this.isBlogUrl(pathname)) {
          grouped.blog.urls.push(url);
          grouped.blog.count++;
          continue;
        }
        
        // Get path segments
        var segments = pathname.split('/').filter(function(s) { return s.length > 0; });
        
        if (segments.length === 0) {
          // Root URL
          if (!grouped.sections['home']) {
            grouped.sections['home'] = {
              name: 'Home',
              pathname: '/',
              isGroup: false,
              isPathPattern: true,
              urls: [],
              count: 0
            };
          }
          grouped.sections['home'].urls.push(url);
          grouped.sections['home'].count++;
          continue;
        }
        
        // Use first 1-2 segments as the grouping key depending on depth
        var groupPath;
        var groupName;
        
        // For deep paths like /content/www/us/en/products/, go deeper
        if (segments.length >= 4 && (segments[0] === 'content' || segments[0] === 'www')) {
          // Skip common prefixes and use meaningful segment
          var meaningfulIndex = 0;
          for (var j = 0; j < segments.length && j < 5; j++) {
            if (segments[j] !== 'content' && segments[j] !== 'www' && segments[j].length !== 2) {
              meaningfulIndex = j;
              break;
            }
          }
          groupPath = '/' + segments.slice(0, meaningfulIndex + 1).join('/');
          groupName = segments[meaningfulIndex];
        } else {
          // Use first segment
          groupPath = '/' + segments[0];
          groupName = segments[0];
        }
        
        // Format the name nicely
        groupName = groupName
          .replace(/[-_]/g, ' ')
          .replace(/\.(html?|php|aspx?)$/i, '')
          .split(' ')
          .map(function(word) { 
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(); 
          })
          .join(' ');
        
        var key = this.sanitizeKey(groupName);
        
        if (!pathCounts[key]) {
          pathCounts[key] = 0;
          urlsByPath[key] = {
            name: groupName,
            pathname: groupPath,
            urls: []
          };
        }
        
        pathCounts[key]++;
        urlsByPath[key].urls.push(url);
        
      } catch (e) {
        grouped.other.urls.push(url);
        grouped.other.count++;
      }
    }
    
    // Convert to sections - only include groups with more than 5 URLs
    // and limit to top 20 groups by count
    var sortedKeys = Object.keys(pathCounts).sort(function(a, b) {
      return pathCounts[b] - pathCounts[a];
    });
    
    var addedCount = 0;
    for (var k = 0; k < sortedKeys.length && addedCount < 20; k++) {
      var key = sortedKeys[k];
      var count = pathCounts[key];
      
      if (count >= 5) {
        grouped.sections[key] = {
          name: urlsByPath[key].name,
          pathname: urlsByPath[key].pathname,
          isGroup: false,
          isPathPattern: true,
          urls: urlsByPath[key].urls,
          count: count
        };
        addedCount++;
      } else {
        // Add to Other
        for (var u = 0; u < urlsByPath[key].urls.length; u++) {
          grouped.other.urls.push(urlsByPath[key].urls[u]);
          grouped.other.count++;
        }
      }
    }
    
    // Add remaining groups to Other
    for (var k = addedCount; k < sortedKeys.length; k++) {
      var key = sortedKeys[k];
      for (var u = 0; u < urlsByPath[key].urls.length; u++) {
        grouped.other.urls.push(urlsByPath[key].urls[u]);
        grouped.other.count++;
      }
    }
    
    // Ensure Home exists
    if (!grouped.sections['home']) {
      grouped.sections['home'] = {
        name: 'Home',
        pathname: '/',
        isGroup: false,
        isPathPattern: true,
        urls: ['https://' + domain + '/'],
        count: 1
      };
    }
    
    // Log statistics
    console.log('📊 Path pattern grouping statistics:');
    console.log('  Groups created:', Object.keys(grouped.sections).length);
    console.log('  Blog posts:', grouped.blog.count);
    console.log('  Other pages:', grouped.other.count);
    
    for (var key in grouped.sections) {
      console.log('  ' + grouped.sections[key].name + ': ' + grouped.sections[key].count + ' pages');
    }
    
    return grouped;
  }
};

window.DomainAnalysisManager = DomainAnalysisManager;