import { getSectionInfo, getBlockInfo, generateSelector } from '../utils/domHelpers';

export function extractFilename(src: string | null): string | null {
  if (!src) return null;
  try {
    const cleanUrl = src.split('?')[0].split('#')[0];
    const segments = cleanUrl.split('/');
    const filename = segments[segments.length - 1];
    return decodeURIComponent(filename);
  } catch (e) {
    return null;
  }
}

export function isLikelyIcon(
  img: HTMLImageElement,
  src: string | null,
  imgWidth: number,
  imgHeight: number
): boolean {
  if (!src) return false;

  const fullPath = src.toLowerCase();
  const cleanFilename = extractFilename(src);
  const className = img.className || '';
  const classLower = className.toLowerCase();

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
  if (imgWidth > 0 && imgWidth <= 64 && imgHeight > 0 && imgHeight <= 64) {
    return true;
  }

  // Check 5: SVG icons with small dimensions and icon-related paths/classes
  if (fullPath.endsWith('.svg') && (imgWidth <= 64 || imgHeight <= 64)) {
    return true;
  }

  return false;
}

export function isGenericImageFilename(filename: string | null): string | null {
  if (!filename) return null;
  const lowerFilename = filename.toLowerCase();
  if (lowerFilename.endsWith('.svg')) return null;

  // Sequential numbered images
  if (/^(image|img|photo|pic|picture|foto)\d+\./i.test(filename)) return 'sequential';

  // Camera/phone defaults - covers most manufacturers
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

  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');

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

export function analyzeImages(
  results: any,
  navigationName: string,
  imageSelectors: string[]
): void {
  const selectorString =
    imageSelectors && imageSelectors.length > 0 ? imageSelectors.join(', ') : 'img';

  const allImages = document.querySelectorAll(selectorString);
  const seenImages = new Set<string>();

  for (let i = 0; i < allImages.length; i++) {
    const element = allImages[i];
    let img: HTMLImageElement | null = null;

    if (element.tagName === 'IMG') {
      img = element as HTMLImageElement;
    } else {
      // Handle wrapper elements by looking for an img inside
      img = element.querySelector('img');
    }

    if (!img) continue; // Skip if no image found

    // Basic visibility check
    const style = window.getComputedStyle(img);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity) < 0.1
    ) {
      continue;
    }

    const alt = img.getAttribute('alt');

    // Squarespace specific: Handle lazy loading and data attributes
    let src =
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

    const section = getSectionInfo(img);
    const block = getBlockInfo(img);

    let imgWidth = img.naturalWidth || img.width || 0;
    let imgHeight = img.naturalHeight || img.height || 0;

    // Squarespace specific: Parse dimensions from data attributes if not loaded yet
    if (imgWidth === 0 || imgHeight === 0) {
      const dims = img.getAttribute('data-image-dimensions');
      if (dims && dims.includes('x')) {
        const parts = dims.split('x');
        imgWidth = parseInt(parts[0]) || 0;
        imgHeight = parseInt(parts[1]) || 0;
      }
    }

    // Avoid tiny tracking pixels or spacers
    if (src && (imgWidth === 1 || imgHeight === 1) && !alt) {
      continue;
    }

    // Check if this is likely an icon - strict size check
    const isSmallImage = imgWidth > 0 && imgWidth <= 64 && imgHeight > 0 && imgHeight <= 64;

    const imageKey = src + '|' + (alt || '') + '|' + section + '|' + block;
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
      selector: generateSelector(img),
      width: imgWidth,
      height: imgHeight,
    });

    const isTrulyMissingAlt = !alt || alt.trim() === '';
    const shouldReportAlt = isTrulyMissingAlt && !isSmallImage;

    if (shouldReportAlt) {
      results.qualityChecks.missingAltText.push({
        url: window.location.href,
        pageTitle: document.title || 'Unknown',
        navigationName: navigationName,
        issue: 'Missing alt text on image',
        imageSrc: src,
        section: section,
        block: block,
        selector: generateSelector(img),
        width: imgWidth,
        height: imgHeight,
      });
    }

    if (!isSmallImage && src) {
      const filename = extractFilename(src);
      if (filename) {
        const pattern = isGenericImageFilename(filename);
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
            selector: generateSelector(img),
          });
        }
      }
    }
  }
}
