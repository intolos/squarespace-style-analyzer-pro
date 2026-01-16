// Domain Analysis Manager
// Handles sitemap fetching, navigation parsing, and URL grouping
// Migrated from domain-analysis-manager.js

const DEBUG_DAM = false;

export interface NavSection {
  name: string;
  pathname: string;
  url: string;
  isGroup: boolean;
  pathnames?: string[];
  isPathPattern?: boolean;
}

export interface NavStructure {
  sections: NavSection[];
  blogSection: {
    name: string;
    pathnames?: string[];
    pathname?: string;
    url?: string;
    isBlog: boolean;
  } | null;
  allNavUrls: Set<string>;
}

export interface UrlGroup {
  name: string;
  pathname?: string;
  pathnames?: string[];
  isGroup?: boolean;
  isPathPattern?: boolean;
  urls: string[];
  count: number;
}

export interface GroupedUrls {
  sections: Record<string, UrlGroup>;
  blog: UrlGroup;
  other: UrlGroup;
}

export const DomainAnalysisManager = {
  // Fetch sitemap from domain
  async fetchSitemap(domain: string): Promise<string[] | null> {
    if (DEBUG_DAM) console.log('🔍 Starting sitemap discovery for:', domain);

    // Step 1: Check robots.txt for sitemap declarations
    const robotsSitemaps = await this.getSitemapsFromRobotsTxt(domain);
    if (robotsSitemaps.length > 0) {
      if (DEBUG_DAM) console.log('📋 Found sitemaps in robots.txt:', robotsSitemaps);
      const urls = await this.fetchSitemapsFromList(robotsSitemaps);
      if (urls && urls.length > 0) {
        if (DEBUG_DAM) console.log('✅ Got', urls.length, 'URLs from robots.txt sitemaps');
        return urls;
      }
    }

    // Step 2: Try common sitemap URL patterns
    const sitemapUrls = [
      `https://${domain}/sitemap.xml`,
      `https://${domain}/sitemap_index.xml`,
      `https://${domain}/sitemap-index.xml`,
      `https://${domain}/sitemaps/sitemap.xml`,
      `https://${domain}/sitemap/sitemap.xml`,
      `https://${domain}/page-sitemap.xml`,
      `https://${domain}/post-sitemap.xml`,
      `https://${domain}/sitemap1.xml`,
      `https://www.${domain}/sitemap.xml`,
      `https://www.${domain}/sitemap_index.xml`,
      `https://www.${domain}/sitemap-index.xml`,
    ];

    // Add language/region specific patterns for international sites
    const langPrefixes = ['en', 'en-us', 'en-gb', 'us'];
    for (const prefix of langPrefixes) {
      sitemapUrls.push(`https://${domain}/${prefix}/sitemap.xml`);
    }

    for (const sitemapUrl of sitemapUrls) {
      try {
        if (DEBUG_DAM) console.log('🔎 Trying:', sitemapUrl);
        const urls = await this.fetchAndParseSitemapUrl(sitemapUrl);
        if (urls && urls.length > 0) {
          if (DEBUG_DAM) console.log('✅ Found', urls.length, 'URLs from', sitemapUrl);
          return urls;
        }
      } catch (error) {
        continue;
      }
    }

    if (DEBUG_DAM) console.log('❌ No sitemap found for', domain);
    return null;
  },

  // Get sitemap URLs from robots.txt
  async getSitemapsFromRobotsTxt(domain: string): Promise<string[]> {
    const robotsUrls = [`https://${domain}/robots.txt`, `https://www.${domain}/robots.txt`];
    const sitemaps: string[] = [];

    for (const robotsUrl of robotsUrls) {
      try {
        const response = await fetch(robotsUrl);
        if (!response.ok) continue;

        const text = await response.text();
        const lines = text.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          // Look for Sitemap: directive (case-insensitive)
          if (trimmed.toLowerCase().startsWith('sitemap:')) {
            const sitemapUrl = trimmed.substring(8).trim();
            if (sitemapUrl && !sitemaps.includes(sitemapUrl)) {
              sitemaps.push(sitemapUrl);
            }
          }
        }

        // If we found sitemaps, no need to check www variant
        if (sitemaps.length > 0) break;
      } catch (error) {
        if (DEBUG_DAM) console.log('Could not fetch robots.txt from', robotsUrl);
        continue;
      }
    }

    return sitemaps;
  },

  // Fetch URLs from a list of sitemap URLs
  async fetchSitemapsFromList(sitemapUrls: string[]): Promise<string[]> {
    const allUrls: string[] = [];
    const maxSubSitemaps = 15; // Limit sub-sitemaps to prevent overwhelming large sites
    let processedCount = 0;

    for (let i = 0; i < sitemapUrls.length && processedCount < maxSubSitemaps; i++) {
      try {
        const urls = await this.fetchAndParseSitemapUrl(sitemapUrls[i]);
        if (urls && urls.length > 0) {
          allUrls.push(...urls);
          processedCount++;
        }
      } catch (error) {
        console.error('Failed to fetch sitemap:', sitemapUrls[i], error);
      }
    }

    return allUrls;
  },

  // Fetch and parse a single sitemap URL (handles index files recursively)
  async fetchAndParseSitemapUrl(sitemapUrl: string): Promise<string[] | null> {
    try {
      const response = await fetch(sitemapUrl);
      if (!response.ok) return null;

      const text = await response.text();
      const urlMatches = Array.from(text.matchAll(/<loc>(.*?)<\/loc>/g));
      const urls = urlMatches.map(match => match[1].trim());

      if (urls.length === 0) return null;

      const isSitemapIndex = text.includes('<sitemap>') || text.includes('<sitemapindex>');

      if (isSitemapIndex) {
        if (DEBUG_DAM) console.log('📂 Found sitemap index with', urls.length, 'sub-sitemaps');
        const allUrls: string[] = [];
        const maxSubSitemaps = 15; // Limit to prevent very long waits on huge sites

        for (let j = 0; j < Math.min(urls.length, maxSubSitemaps); j++) {
          try {
            console.log(
              `  📄 Fetching sub-sitemap ${j + 1}/${Math.min(
                urls.length,
                maxSubSitemaps
              )}: ${urls[j]}`
            );
            const subResponse = await fetch(urls[j]);
            if (!subResponse.ok) continue;

            const subText = await subResponse.text();
            const subMatches = Array.from(subText.matchAll(/<loc>(.*?)<\/loc>/g));
            const subUrls = subMatches.map(m => m[1].trim());
            allUrls.push(...subUrls);

            // Limit total URLs to prevent memory issues
            if (allUrls.length > 500000) {
              if (DEBUG_DAM) console.log('⚠️ Reached 500000 URL limit, stopping sitemap fetch');
              break;
            }
          } catch (e) {
            console.error('Failed to fetch sub-sitemap:', urls[j], e);
          }
        }

        if (urls.length > maxSubSitemaps) {
          console.log(
            `ℹ️ Note: Site has ${urls.length} sub-sitemaps, only processed first ${maxSubSitemaps}`
          );
        }

        return allUrls;
      }

      return urls;
    } catch (error) {
      return null;
    }
  },

  // Fetch and parse navigation structure from homepage
  async fetchNavigationStructure(domain: string): Promise<NavStructure | null> {
    try {
      const homepageUrls = [`https://${domain}`, `https://www.${domain}`];

      for (const url of homepageUrls) {
        try {
          const response = await fetch(url);
          if (!response.ok) continue;

          const html = await response.text();
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
  parseNavigation(html: string, domain: string): NavStructure {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const navStructure: NavStructure = {
      sections: [],
      blogSection: null,
      allNavUrls: new Set(),
    };

    // Find navigation element
    const navSelectors = [
      'nav[data-content-field="navigation"]',
      '.header-nav',
      '.header-nav-wrapper',
      '.header-menu',
      '[data-nc-group="top"]',
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
      '[class*="primary-menu"]',
    ];

    let navElement = null;
    for (const selector of navSelectors) {
      navElement = doc.querySelector(selector);
      if (navElement) {
        if (DEBUG_DAM) console.log('Found nav element with selector:', selector);
        break;
      }
    }

    if (!navElement) {
      if (DEBUG_DAM) console.log('No navigation found, using fallback');
      return this.createFallbackNavStructure(domain);
    }

    // Find all nav items
    const processedPaths = new Set<string>();

    const folderSelectors = [
      '.header-nav-item--folder',
      '.header-nav-folder-item',
      '.header-menu-nav-folder',
      '.menu-item-has-children',
      '.has-submenu',
      '.has-children',
      '.has-dropdown',
      '.dropdown',
      '.nav-item.dropdown',
      '[class*="dropdown"]',
      '[class*="submenu-parent"]',
      '[aria-haspopup="true"]',
      'li.parent',
      '[class*="has-mega-menu"]',
    ];

    let folders: NodeListOf<Element> | Element[] = [];
    for (const selector of folderSelectors) {
      const found = navElement.querySelectorAll(selector);
      if (found.length > 0) {
        folders = found;
        if (DEBUG_DAM)
          console.log('Found folders with selector:', selector, 'count:', found.length);
        break;
      }
    }

    // Process folders
    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];

      const titleEl = folder.querySelector(
        '.header-nav-folder-title, .header-menu-nav-folder-title, :scope > a, :scope > span, :scope > button, [class*="nav-link"], [class*="menu-link"]'
      );
      let folderName: string | null = null;

      if (titleEl) {
        folderName = titleEl.textContent?.trim() || null;
      } else {
        const firstText = folder.childNodes[0];
        if (firstText && firstText.textContent) {
          folderName = firstText.textContent.trim().split('\n')[0].trim();
        }
      }

      if (!folderName || folderName.length < 2) continue;
      if (folderName.toLowerCase() === 'search') continue;

      const childPaths: string[] = [];
      const contentEl = folder.querySelector(
        '.header-nav-folder-content, .header-menu-nav-folder-content, .sub-menu, .submenu, .dropdown-menu, [class*="submenu"], [class*="dropdown-content"], ul.children, :scope > ul'
      );

      if (contentEl) {
        const childLinks = contentEl.querySelectorAll('a[href]');
        for (let j = 0; j < childLinks.length; j++) {
          const href = childLinks[j].getAttribute('href');
          const normalized = this.normalizeUrl(href, domain);

          if (normalized && !processedPaths.has(normalized.pathname)) {
            childPaths.push(normalized.pathname);
            processedPaths.add(normalized.pathname);
            navStructure.allNavUrls.add(normalized.url);
          }
        }
      }

      if (childPaths.length > 0) {
        const isBlog =
          folderName.toLowerCase().includes('blog') || folderName.toLowerCase().includes('news');

        if (isBlog) {
          navStructure.blogSection = {
            name: folderName,
            pathnames: childPaths,
            isBlog: true,
          };
        } else {
          navStructure.sections.push({
            name: folderName,
            pathname: '', // Groups usually don't have a direct pathname
            url: '',
            pathnames: childPaths,
            isGroup: true,
          });
        }
        if (DEBUG_DAM)
          console.log(
            'Added dropdown group:',
            folderName,
            'with',
            childPaths.length,
            'child paths'
          );
      }
    }

    // Find individual links
    const allNavLinks = navElement.querySelectorAll('a[href]');
    const dropdownNames = new Set<string>();
    for (const section of navStructure.sections) {
      if (section.isGroup) {
        dropdownNames.add(section.name.toLowerCase());
      }
    }

    for (let i = 0; i < allNavLinks.length; i++) {
      const link = allNavLinks[i];
      const href = link.getAttribute('href');
      if (!href || href === '#') continue;

      const linkText = link.textContent?.trim() || '';

      if (dropdownNames.has(linkText.toLowerCase())) continue;
      if (!linkText || linkText.length < 2) continue;

      const lowerText = linkText.toLowerCase();
      if (
        lowerText === 'search' ||
        lowerText === 'menu' ||
        lowerText === 'cart' ||
        lowerText === 'close' ||
        lowerText.includes('skip')
      )
        continue;

      const normalized = this.normalizeUrl(href, domain);
      if (!normalized) continue;

      if (processedPaths.has(normalized.pathname)) continue;
      if (link.closest('.header-nav-folder-content, .header-menu-nav-folder-content')) continue;

      processedPaths.add(normalized.pathname);
      navStructure.allNavUrls.add(normalized.url);

      const isBlog =
        normalized.pathname.includes('/blog') ||
        normalized.pathname.includes('/news') ||
        lowerText.includes('blog') ||
        lowerText.includes('news');

      if (isBlog) {
        if (!navStructure.blogSection) {
          navStructure.blogSection = {
            name: linkText,
            pathname: normalized.pathname,
            url: normalized.url,
            isBlog: true,
          };
        }
      } else {
        navStructure.sections.push({
          name: linkText,
          pathname: normalized.pathname,
          url: normalized.url,
          isGroup: false,
        });
        if (DEBUG_DAM) console.log('Added individual link:', linkText);
      }
    }

    // Always add Home first
    navStructure.sections = navStructure.sections.filter(
      s => s.pathname !== '/' && s.name.toLowerCase() !== 'home'
    );

    navStructure.sections.unshift({
      name: 'Home',
      pathname: '/',
      url: `https://${domain}/`,
      isGroup: false,
    });
    navStructure.allNavUrls.add(`https://${domain}/`);

    return navStructure;
  },

  normalizeUrl(href: string | null, domain: string): { url: string; pathname: string } | null {
    if (!href || href.startsWith('#')) return null;

    let url;
    if (href.startsWith('/')) {
      url = `https://${domain}${href}`;
    } else if (href.startsWith('http')) {
      url = href;
    } else {
      url = `https://${domain}/${href}`;
    }

    try {
      const urlObj = new URL(url);
      const domainBase = domain.replace('www.', '');
      if (!urlObj.hostname.includes(domainBase)) {
        return null;
      }
      return {
        url: url,
        pathname: urlObj.pathname,
      };
    } catch (e) {
      return null;
    }
  },

  createFallbackNavStructure(domain: string): NavStructure {
    return {
      sections: [
        {
          name: 'Home',
          pathname: '/',
          url: `https://${domain}/`,
          isGroup: false,
        },
      ],
      blogSection: null,
      allNavUrls: new Set([`https://${domain}/`]),
    };
  },

  groupUrlsByNavigation(
    sitemapUrls: string[],
    navStructure: NavStructure,
    domain: string
  ): GroupedUrls {
    const grouped: GroupedUrls = {
      sections: {},
      blog: {
        name: 'Blog',
        urls: [],
        count: 0,
      },
      other: {
        name: 'Other Pages',
        urls: [],
        count: 0,
      },
    };

    if (navStructure && navStructure.sections) {
      for (const section of navStructure.sections) {
        const key = this.sanitizeKey(section.name);
        grouped.sections[key] = {
          name: section.name,
          pathname: section.pathname,
          pathnames: section.pathnames,
          isGroup: section.isGroup,
          urls: [],
          count: 0,
        };
      }
    }

    for (const url of sitemapUrls) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;

        if (this.isBlogUrl(pathname)) {
          grouped.blog.urls.push(url);
          grouped.blog.count++;
          continue;
        }

        let matched = false;

        for (const key in grouped.sections) {
          const section = grouped.sections[key];

          if (section.isGroup && section.pathnames) {
            for (const childPath of section.pathnames) {
              if (pathname === childPath || pathname.startsWith(childPath + '/')) {
                section.urls.push(url);
                section.count++;
                matched = true;
                break;
              }
            }
          } else if (section.pathname) {
            if (section.pathname === '/') {
              if (pathname === '/') {
                section.urls.push(url);
                section.count++;
                matched = true;
              }
            } else {
              const sectionPath = section.pathname.replace(/\.(html?|php|aspx?)$/i, '');
              const urlPath = pathname.replace(/\.(html?|php|aspx?)$/i, '');

              if (
                pathname === section.pathname ||
                urlPath === sectionPath ||
                urlPath.startsWith(sectionPath + '/')
              ) {
                section.urls.push(url);
                section.count++;
                matched = true;
              }
            }
          }
          if (matched) break;
        }

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

    for (const key in grouped.sections) {
      if (grouped.sections[key].count === 0 && key !== 'home') {
        delete grouped.sections[key];
      }
    }

    if (grouped.sections['home']) {
      if (grouped.sections['home'].count === 0) {
        grouped.sections['home'].urls.push(`https://${domain}/`);
        grouped.sections['home'].count = 1;
      }
    }

    return grouped;
  },

  isBlogUrl(pathname: string): boolean {
    const blogPatterns = ['/blog/', '/news/', '/articles/', '/posts/', '/insights/'];
    const lowerPath = pathname.toLowerCase();
    for (const pattern of blogPatterns) {
      if (lowerPath.includes(pattern)) return true;
    }
    return false;
  },

  sanitizeKey(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  },

  groupUrlsByPathPattern(sitemapUrls: string[], domain: string): GroupedUrls {
    if (DEBUG_DAM) console.log('📁 Grouping URLs by path pattern...');

    const grouped: GroupedUrls = {
      sections: {},
      blog: { name: 'Blog', urls: [], count: 0 },
      other: { name: 'Other Pages', urls: [], count: 0 },
    };

    const pathCounts: Record<string, number> = {};
    const urlsByPath: Record<string, any> = {};

    for (const url of sitemapUrls) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;

        if (this.isBlogUrl(pathname)) {
          grouped.blog.urls.push(url);
          grouped.blog.count++;
          continue;
        }

        const segments = pathname.split('/').filter(s => s.length > 0);

        if (segments.length === 0) {
          if (!grouped.sections['home']) {
            grouped.sections['home'] = {
              name: 'Home',
              pathname: '/',
              isGroup: false,
              isPathPattern: true,
              urls: [],
              count: 0,
            };
          }
          grouped.sections['home'].urls.push(url);
          grouped.sections['home'].count++;
          continue;
        }

        let groupPath;
        let groupName;

        if (segments.length >= 4 && (segments[0] === 'content' || segments[0] === 'www')) {
          let meaningfulIndex = 0;
          for (let j = 0; j < segments.length && j < 5; j++) {
            if (segments[j] !== 'content' && segments[j] !== 'www' && segments[j].length !== 2) {
              meaningfulIndex = j;
              break;
            }
          }
          groupPath = '/' + segments.slice(0, meaningfulIndex + 1).join('/');
          groupName = segments[meaningfulIndex];
        } else {
          groupPath = '/' + segments[0];
          groupName = segments[0];
        }

        groupName = groupName
          .replace(/[-_]/g, ' ')
          .replace(/\.(html?|php|aspx?)$/i, '')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');

        const key = this.sanitizeKey(groupName);

        if (!pathCounts[key]) {
          pathCounts[key] = 0;
          urlsByPath[key] = {
            name: groupName,
            pathname: groupPath,
            urls: [],
          };
        }

        pathCounts[key]++;
        urlsByPath[key].urls.push(url);
      } catch (e) {
        grouped.other.urls.push(url);
        grouped.other.count++;
      }
    }

    const sortedKeys = Object.keys(pathCounts).sort((a, b) => pathCounts[b] - pathCounts[a]);
    let addedCount = 0;

    for (let k = 0; k < sortedKeys.length && addedCount < 20; k++) {
      const key = sortedKeys[k];
      const count = pathCounts[key];

      if (count >= 5) {
        grouped.sections[key] = {
          name: urlsByPath[key].name,
          pathname: urlsByPath[key].pathname,
          isGroup: false,
          isPathPattern: true,
          urls: urlsByPath[key].urls,
          count: count,
        };
        addedCount++;
      } else {
        for (const u of urlsByPath[key].urls) {
          grouped.other.urls.push(u);
          grouped.other.count++;
        }
      }
    }

    for (let k = addedCount; k < sortedKeys.length; k++) {
      const key = sortedKeys[k];
      for (const u of urlsByPath[key].urls) {
        grouped.other.urls.push(u);
        grouped.other.count++;
      }
    }

    if (!grouped.sections['home']) {
      grouped.sections['home'] = {
        name: 'Home',
        pathname: '/',
        isGroup: false,
        isPathPattern: true,
        urls: [`https://${domain}/`],
        count: 1,
      };
    }

    return grouped;
  },

  checkDetectionQuality(
    navStructure: NavStructure,
    groupedUrls: GroupedUrls,
    totalSitemapUrls: number
  ): {
    isPoor: boolean;
    reason: string;
    matchPercent: number;
    otherPagesPercent: number;
  } {
    const originalNavCount =
      navStructure && navStructure.sections ? navStructure.sections.length : 0;
    const matchedSectionCount = Object.keys(groupedUrls.sections).length;
    const otherPagesCount = groupedUrls.other ? groupedUrls.other.count : 0;
    const otherPagesPercent = totalSitemapUrls > 0 ? (otherPagesCount / totalSitemapUrls) * 100 : 0;
    const matchPercent = originalNavCount > 0 ? (matchedSectionCount / originalNavCount) * 100 : 0;

    if (originalNavCount > 0 && matchPercent < 60) {
      return {
        isPoor: true,
        reason: `Only ${matchPercent.toFixed(0)}% of detected nav links matched sitemap URLs`,
        matchPercent: matchPercent,
        otherPagesPercent: otherPagesPercent,
      };
    }

    if (otherPagesPercent > 80) {
      return {
        isPoor: true,
        reason: `${otherPagesPercent.toFixed(0)}% of sitemap URLs are uncategorized`,
        matchPercent: matchPercent,
        otherPagesPercent: otherPagesPercent,
      };
    }

    return {
      isPoor: false,
      reason: 'Detection quality acceptable',
      matchPercent: matchPercent,
      otherPagesPercent: otherPagesPercent,
    };
  },
};
