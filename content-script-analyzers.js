// content-script-analyzers.js
// Element analyzers for buttons, headings, paragraphs, links, and images

var ContentScriptAnalyzers = (function () {
  'use strict';

  // ============================================
  // BUTTON ANALYSIS
  // ============================================

  async function analyzeButtons(results, navigationName, colorTracker, colorData) {
    var buttonSelectors = [
      'button:not([aria-hidden="true"])',
      'a.button',
      'a.btn',
      'a[class*="sqs-button"]',
      'a[class*="sqs-block-button"]',
      '.sqs-block-button-element',
      'a[href][class*="btn"]',
      'a[href][class*="button"]',
      'input[type="submit"]',
      'input[type="button"]',
      '.button-block a',
      'a[role="button"]',
      '.sqs-button-element--primary',
      '.sqs-button-element--secondary',
      '.sqs-button-element--tertiary',
    ];

    var buttons = document.querySelectorAll(buttonSelectors.join(', '));
    console.log('Found potential buttons:', buttons.length);

    var excludedPatterns = [
      'open menu',
      'skip to content',
      'skip to',
      'close menu',
      'folder:',
      'cookie',
      'large images',
      'all images',
      'images (>100kb)',
      'pause background',
      'play background',
      'background',
    ];
    var processedButtonKeys = new Set();

    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var text = (btn.innerText || btn.textContent || '').trim();

      if (!text || text.length === 0) {
        if (btn.getAttribute('aria-label')) {
          text = btn.getAttribute('aria-label').trim();
        }
        if (!text) continue;
      }

      var section = ContentScriptHelpers.getSectionInfo(btn);
      var block = ContentScriptHelpers.getBlockInfo(btn);

      // Skip accordion/FAQ buttons
      var ariaExpanded = btn.getAttribute('aria-expanded');
      var ariaControls = btn.getAttribute('aria-controls');
      var btnClasses = (btn.className || '').toLowerCase();
      var isAccordion = false;

      if (ariaExpanded !== null || ariaControls !== null) isAccordion = true;
      if (
        btnClasses.includes('accordion') ||
        btnClasses.includes('collapse') ||
        btnClasses.includes('toggle') ||
        btnClasses.includes('dropdown')
      )
        isAccordion = true;

      var parentEl = btn;
      for (var p = 0; p < 3; p++) {
        if (!parentEl) break;
        var parentClass = (parentEl.className || '').toLowerCase();
        if (
          parentClass.includes('accordion') ||
          parentClass.includes('faq') ||
          parentClass.includes('collapse')
        ) {
          isAccordion = true;
          break;
        }
        parentEl = parentEl.parentElement;
      }

      if (isAccordion) continue;

      // Check if button is in navigation/header/footer (for inventory filtering)
      parentEl = btn;
      var isInNav = false;
      for (var p = 0; p < 5; p++) {
        if (!parentEl) break;
        var parentTag = (parentEl.tagName || '').toLowerCase();
        if (parentTag === 'nav' || parentTag === 'header' || parentTag === 'footer') {
          isInNav = true;
          break;
        }
        parentEl = parentEl.parentElement;
      }
      // Don't skip nav buttons entirely - still need to check contrast!
      // Only skip from inventory if in nav

      // Skip excluded patterns
      var lowerText = text.toLowerCase();
      var isExcluded = false;
      for (var ep = 0; ep < excludedPatterns.length; ep++) {
        if (lowerText.includes(excludedPatterns[ep])) {
          isExcluded = true;
          break;
        }
      }
      if (isExcluded) continue;

      // Skip very short text
      if (text.length < 3 && !['ok', 'go'].includes(lowerText)) continue;
      if (text.length > 100) continue;

      var buttonKey = text + '|' + section + '|' + block;
      if (processedButtonKeys.has(buttonKey)) continue;

      var tagName = btn.tagName.toLowerCase();
      var hasHref = tagName === 'a' && btn.hasAttribute('href');
      var isButton = tagName === 'button' || tagName === 'input';
      var hasButtonRole = btn.getAttribute('role') === 'button';
      var hasButtonClass = (btn.className || '').toLowerCase().includes('button');

      if (!hasHref && !isButton && !hasButtonRole && !hasButtonClass) continue;

      // ALWAYS check contrast for all buttons (including nav/header/footer)
      // This ensures we catch accessibility issues everywhere, matching WAVE behavior
      var styleDefinition = await ContentScriptHelpers.getStyleDefinition(
        btn,
        'button',
        colorTracker,
        colorData
      );

      // Only add to button inventory if NOT in nav/header/footer
      if (!isInNav) {
        var btnClass = (btn.className || '').toLowerCase();

        var buttonType = 'other';
        if (
          btnClass.includes('primary') ||
          btnClass.includes('main-action') ||
          btnClass.includes('cta')
        ) {
          buttonType = 'primary';
        } else if (btnClass.includes('secondary') || btnClass.includes('outline')) {
          buttonType = 'secondary';
        } else if (
          btnClass.includes('tertiary') ||
          btnClass.includes('text-button') ||
          btnClass.includes('link-button')
        ) {
          buttonType = 'tertiary';
        }

        results.buttons[buttonType].locations.push({
          navigationName: navigationName,
          url: window.location.href,
          styleDefinition: styleDefinition,
          text: text.substring(0, 200),
          pageTitle: document.title || 'Unknown',
          section: section,
          block: block,
          element: tagName,
          classes: btn.className || '',
          selector: ContentScriptHelpers.generateSelector(btn),
        });

        processedButtonKeys.add(buttonKey);
      }
    }
  }

  // ============================================
  // HEADING ANALYSIS
  // ============================================

  async function analyzeHeadings(results, navigationName, colorTracker, colorData) {
    var headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    console.log('Found headings:', headings.length);

    var h1Count = 0;
    var headingSequence = [];
    var fontSizesByType = {
      'heading-1': [],
      'heading-2': [],
      'heading-3': [],
      'heading-4': [],
      'heading-5': [],
      'heading-6': [],
    };

    for (var i = 0; i < headings.length; i++) {
      var heading = headings[i];
      var tagName = heading.tagName.toLowerCase();
      var headingLevel = parseInt(tagName.charAt(1));
      var headingType = 'heading-' + headingLevel;

      if (tagName === 'h1') h1Count++;

      headingSequence.push(headingLevel);

      var text = heading.textContent.trim();
      var section = ContentScriptHelpers.getSectionInfo(heading);
      var block = ContentScriptHelpers.getBlockInfo(heading);
      var styleDefinition = await ContentScriptHelpers.getStyleDefinition(
        heading,
        'heading',
        colorTracker,
        colorData
      );
      var computed = window.getComputedStyle(heading);
      var fontSize = computed.fontSize;

      if (headingType in fontSizesByType) {
        fontSizesByType[headingType].push({
          size: fontSize,
          location: navigationName + ' - ' + section,
        });
      }

      if (headingType in results.headings) {
        results.headings[headingType].locations.push({
          navigationName: navigationName,
          url: window.location.href,
          styleDefinition: styleDefinition,
          text: text.substring(0, 200),
          pageTitle: document.title || 'Unknown',
          section: section,
          block: block,
          styles: heading.className || '',
          selector: ContentScriptHelpers.generateSelector(heading),
        });
      }
    }

    // Quality checks
    if (h1Count === 0) {
      results.qualityChecks.missingH1.push({
        page: navigationName,
        url: window.location.href,
      });
    }

    if (h1Count > 1) {
      results.qualityChecks.multipleH1.push({
        page: navigationName,
        url: window.location.href,
        count: h1Count,
      });
    }

    // Broken heading hierarchy check
    if (headingSequence.length > 0) {
      var lastLevel = 0;
      var lastHeadingText = '';

      for (var i = 0; i < headings.length; i++) {
        var heading = headings[i];
        var currentLevel = parseInt(heading.tagName.charAt(1));
        var currentText = heading.textContent.trim();
        var section = ContentScriptHelpers.getSectionInfo(heading);
        var block = ContentScriptHelpers.getBlockInfo(heading);

        if (lastLevel > 0 && currentLevel > lastLevel + 1) {
          var skippedLevels = [];
          for (var skip = lastLevel + 1; skip < currentLevel; skip++) {
            skippedLevels.push('H' + skip);
          }

          var issueText =
            'Broken hierarchy: H' +
            lastLevel +
            ' -> H' +
            currentLevel +
            ' (skipped ' +
            skippedLevels.join(', ') +
            ')';
          var description =
            'After "' +
            lastHeadingText.substring(0, 50) +
            (lastHeadingText.length > 50 ? '...' : '') +
            '" (H' +
            lastLevel +
            '), jumped to "' +
            currentText.substring(0, 50) +
            (currentText.length > 50 ? '...' : '') +
            '" (H' +
            currentLevel +
            ') in ' +
            section +
            ' / ' +
            block;

          results.qualityChecks.brokenHeadingHierarchy.push({
            url: window.location.href,
            page: navigationName,
            issue: issueText,
            description: description,
            afterHeading: lastHeadingText.substring(0, 100),
            afterHeadingType: 'H' + lastLevel,
            problemHeading: currentText.substring(0, 100),
            problemHeadingType: 'H' + currentLevel,
            section: section,
            block: block,
          });
        }

        lastLevel = currentLevel;
        lastHeadingText = currentText;
      }
    }

    // Font size inconsistency check
    var headingTypes = [
      'heading-1',
      'heading-2',
      'heading-3',
      'heading-4',
      'heading-5',
      'heading-6',
    ];
    for (var ht = 0; ht < headingTypes.length; ht++) {
      var headingType = headingTypes[ht];
      if (!results.headings[headingType] || !results.headings[headingType].locations) continue;

      var sizesMap = {};

      for (var loc = 0; loc < results.headings[headingType].locations.length; loc++) {
        var location = results.headings[headingType].locations[loc];
        var fontSize = ContentScriptHelpers.extractFontSize(location.styleDefinition);

        if (fontSize) {
          if (!sizesMap[fontSize]) {
            sizesMap[fontSize] = { count: 0, pages: [] };
          }
          sizesMap[fontSize].count++;
          if (sizesMap[fontSize].pages.indexOf(location.navigationName) === -1) {
            sizesMap[fontSize].pages.push(location.navigationName);
          }
        }
      }

      var uniqueSizes = Object.keys(sizesMap);
      if (uniqueSizes.length >= 3) {
        var distributionText = uniqueSizes
          .map(function (size) {
            return size + ' (' + sizesMap[size].count + ' times)';
          })
          .join(', ');

        var headingLabel = headingType.replace('heading-', 'H');
        var issueText =
          headingType.replace('-', ' ').toUpperCase() +
          ' appears in ' +
          uniqueSizes.length +
          ' different font sizes';
        var description =
          headingLabel +
          ' headings found in ' +
          uniqueSizes.length +
          ' different sizes: ' +
          distributionText +
          '. Review if these variations are intentional.';

        results.qualityChecks.fontSizeInconsistency.push({
          url: window.location.href,
          page: navigationName,
          headingType: headingType,
          issue: issueText,
          description: description,
          sizes: uniqueSizes,
          distribution: distributionText,
        });
      }
    }
  }

  // ============================================
  // PARAGRAPH ANALYSIS
  // ============================================

  async function analyzeParagraphs(
    results,
    navigationName,
    squarespaceThemeStyles,
    colorTracker,
    colorData
  ) {
    var paragraphs = document.querySelectorAll('p');
    console.log('Found paragraphs:', paragraphs.length);

    var paragraphsInLists = new Set();
    var listItems = document.querySelectorAll('li');
    for (var li = 0; li < listItems.length; li++) {
      var nestedPs = listItems[li].querySelectorAll('p');
      for (var np = 0; np < nestedPs.length; np++) {
        paragraphsInLists.add(nestedPs[np]);
      }
    }

    for (var j = 0; j < paragraphs.length; j++) {
      var p = paragraphs[j];

      if (paragraphsInLists.has(p)) continue;

      var text = p.textContent.trim();
      if (text.length > 10) {
        var paragraphType = 'paragraph-2';

        var pClasses = (p.className || '').toLowerCase();
        if (typeof p.className !== 'string' && p.getAttribute) {
          pClasses = (p.getAttribute('class') || '').toLowerCase();
        }

        if (
          pClasses.includes('paragraph-1') ||
          pClasses.includes('intro-text') ||
          pClasses.includes('hero-text') ||
          pClasses.includes('lead')
        ) {
          paragraphType = 'paragraph-1';
        } else if (
          pClasses.includes('paragraph-3') ||
          pClasses.includes('caption') ||
          pClasses.includes('quote') ||
          pClasses.includes('blockquote')
        ) {
          paragraphType = 'paragraph-3';
        } else if (pClasses.includes('paragraph-4') || pClasses.includes('footer-text')) {
          paragraphType = 'paragraph-4';
        } else {
          var parentEl = p.parentElement;
          var depth = 0;

          while (parentEl && depth < 5) {
            var parentClass = (parentEl.className || '').toLowerCase();
            if (typeof parentEl.className !== 'string' && parentEl.getAttribute) {
              parentClass = (parentEl.getAttribute('class') || '').toLowerCase();
            }

            if (
              parentClass.includes('hero') ||
              parentClass.includes('banner') ||
              parentClass.includes('intro')
            ) {
              paragraphType = 'paragraph-1';
              break;
            } else if (parentClass.includes('footer') || parentClass.includes('sidebar')) {
              paragraphType = 'paragraph-4';
              break;
            } else if (
              parentClass.includes('testimonial') ||
              parentClass.includes('quote') ||
              parentClass.includes('blockquote')
            ) {
              paragraphType = 'paragraph-3';
              break;
            }

            parentEl = parentEl.parentElement;
            depth++;
          }
        }

        var computed = window.getComputedStyle(p);
        var fontSize = parseFloat(computed.fontSize);

        var themeSizes = squarespaceThemeStyles.paragraphSizes || {};
        var p1Size = themeSizes['paragraph-1'] || 1.5 * 16;
        var p2Size = themeSizes['paragraph-2'] || 1.1 * 16;
        var p3Size = themeSizes['paragraph-3'] || 1.0 * 16;

        var distanceToP1 = Math.abs(fontSize - p1Size);
        var distanceToP2 = Math.abs(fontSize - p2Size);
        var distanceToP3 = Math.abs(fontSize - p3Size);

        var minDistance = Math.min(distanceToP1, distanceToP2, distanceToP3);
        if (minDistance === distanceToP1) {
          paragraphType = 'paragraph-1';
        } else if (minDistance === distanceToP3) {
          paragraphType = 'paragraph-3';
        } else {
          paragraphType = 'paragraph-2';
        }

        var section = ContentScriptHelpers.getSectionInfo(p);
        var block = ContentScriptHelpers.getBlockInfo(p);
        var styleDefinition = await ContentScriptHelpers.getStyleDefinition(
          p,
          'paragraph',
          colorTracker,
          colorData
        );

        results.paragraphs[paragraphType].locations.push({
          navigationName: navigationName,
          url: window.location.href,
          styleDefinition: styleDefinition,
          text: text.substring(0, 200),
          pageTitle: document.title || 'Unknown',
          section: section,
          block: block,
          styles: p.className || '',
          selector: ContentScriptHelpers.generateSelector(p),
        });
      }
    }

    // Analyze list items as paragraphs
    await analyzeListItems(results, navigationName, colorTracker, colorData);
  }

  async function analyzeListItems(results, navigationName, colorTracker, colorData) {
    var listItems = document.querySelectorAll('li');

    for (var i = 0; i < listItems.length; i++) {
      var listItem = listItems[i];
      var text = listItem.textContent.trim();

      if (text.length <= 10) continue;
      if (listItem.querySelector('p')) continue;

      var parentEl = listItem;
      var inNavigation = false;
      var depth = 0;

      while (parentEl && depth < 5) {
        var parentTag = (parentEl.tagName || '').toLowerCase();
        var parentClass = (parentEl.className || '').toLowerCase();

        if (parentTag === 'nav' || parentClass.includes('nav') || parentClass.includes('menu')) {
          inNavigation = true;
          break;
        }
        parentEl = parentEl.parentElement;
        depth++;
      }

      if (inNavigation) continue;

      var paragraphType = 'paragraph-2';

      parentEl = listItem;
      depth = 0;
      while (parentEl && depth < 5) {
        var parentClass = (parentEl.className || '').toLowerCase();

        if (
          parentClass.includes('hero') ||
          parentClass.includes('banner') ||
          parentClass.includes('intro')
        ) {
          paragraphType = 'paragraph-1';
          break;
        } else if (parentClass.includes('footer') || parentClass.includes('sidebar')) {
          paragraphType = 'paragraph-4';
          break;
        } else if (parentClass.includes('testimonial') || parentClass.includes('quote')) {
          paragraphType = 'paragraph-3';
          break;
        }
        parentEl = parentEl.parentElement;
        depth++;
      }

      if (paragraphType === 'paragraph-2') {
        var computed = window.getComputedStyle(listItem);
        var fontSize = parseFloat(computed.fontSize);
        var fontWeight = parseInt(computed.fontWeight);

        if (fontSize > 18 || fontWeight > 500) {
          paragraphType = 'paragraph-1';
        }
      }

      var section = ContentScriptHelpers.getSectionInfo(listItem);
      var block = ContentScriptHelpers.getBlockInfo(listItem);
      var styleDefinition = await ContentScriptHelpers.getStyleDefinition(
        listItem,
        'paragraph',
        colorTracker,
        colorData
      );

      results.paragraphs[paragraphType].locations.push({
        navigationName: navigationName,
        url: window.location.href,
        styleDefinition: styleDefinition,
        text: text.substring(0, 200),
        pageTitle: document.title || 'Unknown',
        section: section,
        block: block,
        styles: listItem.className || '',
        selector: ContentScriptHelpers.generateSelector(listItem),
      });
    }
  }

  // ============================================
  // LINK ANALYSIS
  // ============================================

  async function analyzeLinks(results, navigationName, colorTracker, colorData) {
    var contentAreas = document.querySelectorAll(
      'main, article, section, .content, .page-content, [role="main"], .sqs-block-content'
    );
    var processedLinkKeys = new Set();

    var excludeSelectors = [
      'nav a',
      'header a',
      'footer a',
      '.navigation a',
      '.menu a',
      '[class*="nav"] a',
      '[class*="footer"] a',
      '[class*="social"] a',
      '[class*="share"] a',
      'a.button',
      'a.btn',
      'a[class*="sqs-button"]',
      'a[class*="btn"]',
      'a[role="button"]',
      '.button-block a',
    ];

    for (var ca = 0; ca < contentAreas.length; ca++) {
      var contentArea = contentAreas[ca];
      var allLinks = contentArea.querySelectorAll('a[href]');

      for (var li = 0; li < allLinks.length; li++) {
        var link = allLinks[li];

        var shouldExclude = false;
        for (var ex = 0; ex < excludeSelectors.length; ex++) {
          if (
            link.matches(excludeSelectors[ex]) ||
            link.closest(excludeSelectors[ex].replace(' a', ''))
          ) {
            shouldExclude = true;
            break;
          }
        }
        if (shouldExclude) continue;

        var text = link.textContent.trim();
        if (text.length < 2 || text.length > 200) continue;

        var section = ContentScriptHelpers.getSectionInfo(link);
        var block = ContentScriptHelpers.getBlockInfo(link);
        var linkKey = text + '|' + section + '|' + block;

        if (processedLinkKeys.has(linkKey)) continue;
        processedLinkKeys.add(linkKey);

        var styleDefinition = await ContentScriptHelpers.getStyleDefinition(
          link,
          'text',
          colorTracker,
          colorData
        );
        var href = link.getAttribute('href') || '';

        results.links['in-content'].locations.push({
          navigationName: navigationName,
          url: window.location.href,
          text: text.substring(0, 200),
          href: href, // Remove 150 char truncation
          styleDefinition: styleDefinition,
          section: section,
          block: block,
          pageTitle: document.title || 'Unknown',
          selector: ContentScriptHelpers.generateSelector(link),
        });
      }
    }
  }

  // ============================================
  // IMAGE ANALYSIS
  // ============================================

  function isGenericImageFilename(filename) {
    if (!filename) return null;
    var lowerFilename = filename.toLowerCase();
    if (lowerFilename.endsWith('.svg')) return null;

    // Sequential numbered images
    if (/^(image|img|photo|pic|picture|foto)\d+\./i.test(filename)) return 'sequential';

    // Camera/phone defaults - covers most manufacturers
    // Canon: IMG_, Nikon: DSC/DSCN, Fuji: DSCF, Sony: DSC, Samsung: SAM/IMAG,
    // LG: LG_, Huawei: IMG_, Google Pixel: PXL_, OnePlus: IMG_, Xiaomi: IMG_,
    // GoPro: GOPR, DJI drones: DJI_, Generic: DCIM, P####, PIC
    if (
      /^(DSC|DSCN|DSCF|IMG|DCIM|SAM|IMAG|PIC|PHOTO|LG|PXL|GOPR|DJI|MVIMG|VID|MOV|MVI|PANO|BURST|HDR|PORTRAIT)[-_]?\d+/i.test(
        filename
      )
    )
      return 'camera-default';
    if (/^P\d{4,}\./i.test(filename)) return 'camera-default';
    if (/^\d{8}[-_]\d{6}/i.test(filename)) return 'camera-default'; // Timestamp format: 20231215_143022
    if (/^(IMG|PXL|MVIMG)[-_]\d{8}[-_]\d+/i.test(filename)) return 'camera-default'; // IMG_20231215_143022

    // Stock photo sites
    if (
      /^(shutterstock|istock|istockphoto|pexels|adobe[-_]?stock|dreamstime|depositphotos|gettyimages|getty[-_]?images|stock[-_]?photo|unsplash|pixabay|freepik|vecteezy|rawpixel|stocksy|alamy|123rf|bigstock|canstock|fotolia|thinkstock|corbis|envato|elements[-_]?envato|pond5|videvo|storyblocks|motion[-_]?array|twenty20|eyeem|500px|flickr[-_]?cc|creative[-_]?commons)/i.test(
        filename
      )
    )
      return 'stock-photo';

    // Generic placeholder names
    if (
      /^(untitled|picture|photo|image|imagen|foto|unnamed|unknown|default|placeholder|temp|test|sample|example|demo|dummy|filler|blank|empty|new[-_]?image|copy[-_]?of)\d*\./i.test(
        lowerFilename
      )
    )
      return 'generic-name';

    // Screenshots
    if (
      /^(screenshot|screen[-_]?shot|capture|screen[-_]?cap|screen[-_]?grab|snip|snipping)/i.test(
        filename
      )
    )
      return 'screenshot';
    if (/^(Screenshot|Captura|Bildschirmfoto|Schermafbeelding|Skjermbilde)[-_\s]/i.test(filename))
      return 'screenshot'; // Localized screenshot names

    var nameWithoutExt = filename.replace(/\.[^.]+$/, '');

    // Hash-based filenames (32+ hex chars)
    if (/^[a-f0-9]{32,}$/i.test(nameWithoutExt)) return 'hash';

    // Full UUID
    if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(nameWithoutExt))
      return 'uuid';

    // Short UUID-like patterns
    if (/^[a-f0-9]{8,12}(-[a-f0-9]{4,})+$/i.test(nameWithoutExt)) return 'uuid-short';

    // Squarespace defaults
    if (/^(sqs[-_]?image|hero[-_]?image)\d*\./i.test(filename)) return 'squarespace-default';

    return null;
  }

  function extractFilename(src) {
    if (!src) return null;
    try {
      var cleanUrl = src.split('?')[0].split('#')[0];
      var segments = cleanUrl.split('/');
      var filename = segments[segments.length - 1];
      return decodeURIComponent(filename);
    } catch (e) {
      return null;
    }
  }

  function isLikelyIcon(img, src, imgWidth, imgHeight) {
    if (!src) return false;

    var fullPath = src.toLowerCase();
    var cleanFilename = extractFilename(src);
    var className = img.className || '';
    var classLower = className.toLowerCase();

    // Check 0: Exclude logos (logos should always be checked for alt text)
    if (
      (cleanFilename && cleanFilename.toLowerCase().includes('logo')) ||
      classLower.includes('logo') ||
      fullPath.includes('/logo/')
    ) {
      return false;
    }

    // Check 1: Filename contains "icon"
    if (cleanFilename && cleanFilename.toLowerCase().includes('icon')) {
      return true;
    }

    // Check 2: Common icon paths
    if (
      fullPath.includes('/icons/') ||
      fullPath.includes('/assets/icons/') ||
      fullPath.includes('/images/icons/') ||
      fullPath.includes('/img/icons/')
    ) {
      return true;
    }

    // Check 3: Class names containing icon indicators
    if (
      classLower.includes('icon') ||
      classLower.includes('fa-') ||
      classLower.includes('material-icons') ||
      classLower.includes('glyphicon') ||
      classLower.includes('feather') ||
      classLower.includes('ionicon')
    ) {
      return true;
    }

    // Check 4: Small dimensions (≤64x64) - likely decorative icons
    // Updated threshold from 32x32 to 64x64 per user request
    if (imgWidth > 0 && imgWidth <= 64 && imgHeight > 0 && imgHeight <= 64) {
      return true;
    }

    // Check 5: SVG icons with small dimensions and icon-related paths/classes
    if (fullPath.endsWith('.svg') && (imgWidth <= 64 || imgHeight <= 64)) {
      return true;
    }

    return false;
  }

  function analyzeImages(results, navigationName) {
    var allImages = document.querySelectorAll('img');
    var seenImages = new Set(); // Track images to avoid duplicate reporting on same page

    for (var i = 0; i < allImages.length; i++) {
      var img = allImages[i];

      // Basic visibility check
      var style = window.getComputedStyle(img);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        parseFloat(style.opacity) < 0.1
      ) {
        continue;
      }

      var alt = img.getAttribute('alt');

      // Squarespace specific: Handle lazy loading and data attributes
      var src =
        img.src ||
        img.getAttribute('data-src') ||
        img.getAttribute('data-image') ||
        img.getAttribute('srcset')?.split(' ')[0] ||
        '';

      // Clean up relative URLs to absolute if needed
      if (src && !src.startsWith('http')) {
        try {
          src = new URL(src, window.location.href).href;
        } catch (e) {}
      }

      var section = ContentScriptHelpers.getSectionInfo(img);
      var block = ContentScriptHelpers.getBlockInfo(img);

      var imgWidth = img.naturalWidth || img.width || 0;
      var imgHeight = img.naturalHeight || img.height || 0;

      // Squarespace specific: Parse dimensions from data attributes if not loaded yet
      if (imgWidth === 0 || imgHeight === 0) {
        var dims = img.getAttribute('data-image-dimensions');
        if (dims && dims.includes('x')) {
          var parts = dims.split('x');
          imgWidth = parseInt(parts[0]) || 0;
          imgHeight = parseInt(parts[1]) || 0;
        }
      }

      // Avoid tiny tracking pixels or spacers
      if (src && (imgWidth === 1 || imgHeight === 1) && !alt) {
        continue;
      }

      // Check if this is likely an icon - Threshold updated to 64px as per user request
      // STRICT check: BOTH dimensions must be <= 64px to be considered a small icon automatically
      var isSmallImage = imgWidth > 0 && imgWidth <= 64 && imgHeight > 0 && imgHeight <= 64;

      // Check if this is likely an icon
      var isIcon = isLikelyIcon(img, src, imgWidth, imgHeight);

      // Create unique key for this image instance to avoid duplicate reporting
      var imageKey = src + '|' + (alt || '') + '|' + section + '|' + block;
      if (seenImages.has(imageKey)) continue;
      seenImages.add(imageKey);

      results.images.push({
        navigationName: navigationName,
        url: window.location.href,
        pageTitle: document.title || 'Unknown',
        src: src,
        alt: alt || '(missing alt text)',
        section: section,
        block: block,
        selector: ContentScriptHelpers.generateSelector(img),
        width: imgWidth,
        height: imgHeight,
      });

      // Flag as missing alt text if:
      // 1. Attribute is completely missing
      // 2. Attribute is empty (alt="") AND it's not a small icon (<= 64px)
      // NOTE: We report missing alt text if it's truly missing AND it is NOT a small icon.
      // Since isSmallImage now strictly requires BOTH dims <= 64, we will report for everything else (e.g. banners).
      var isTrulyMissingAlt = !alt || alt.trim() === '';
      var shouldReportAlt = isTrulyMissingAlt && !isSmallImage;

      if (shouldReportAlt) {
        results.qualityChecks.missingAltText.push({
          url: window.location.href,
          pageTitle: document.title || 'Unknown',
          navigationName: navigationName,
          issue: 'Missing alt text on image',
          imageSrc: src,
          section: section,
          block: block,
          selector: ContentScriptHelpers.generateSelector(img),
          width: imgWidth,
          height: imgHeight,
        });
      }

      if (!isSmallImage && src) {
        var filename = extractFilename(src);
        if (filename) {
          var pattern = isGenericImageFilename(filename);
          if (pattern) {
            results.qualityChecks.genericImageNames.push({
              url: window.location.href,
              navigationName: navigationName,
              src: src,
              filename: filename,
              width: imgWidth,
              height: imgHeight,
              pattern: pattern,
              section: section,
              block: block,
              selector: ContentScriptHelpers.generateSelector(img),
            });
          }
        }
      }
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  return {
    analyzeButtons: analyzeButtons,
    analyzeHeadings: analyzeHeadings,
    analyzeParagraphs: analyzeParagraphs,
    analyzeLinks: analyzeLinks,
    analyzeImages: analyzeImages,
  };
})();

// Make globally available for content scripts
if (typeof window !== 'undefined') {
  window.ContentScriptAnalyzers = ContentScriptAnalyzers;
}
