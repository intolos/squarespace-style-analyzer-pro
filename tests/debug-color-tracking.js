// Debug script to inject into page console to diagnose color tracking issues
// Copy and paste this entire script into the browser console while on the page

(function() {
  'use strict';

  console.log('=== COLOR TRACKING DEBUG SCRIPT ===');
  console.log('Analyzing page:', window.location.href);

  // Find all elements in header
  const headers = document.querySelectorAll('header, [class*="header"], [id*="header"]');
  console.log(`\n📍 Found ${headers.length} header elements:`, headers);

  const colorsByLocation = {
    header: new Set(),
    navigation: new Set(),
    footer: new Set(),
    other: new Set()
  };

  const colorDetails = [];

  // Helper function to get element location (same as extension)
  function getElementLocation(element) {
    let el = element;
    let depth = 0;

    while (el && depth < 15) {
      const tagName = el.tagName ? el.tagName.toLowerCase() : '';

      if (tagName === 'nav') return 'navigation';
      if (tagName === 'header') return 'header';
      if (tagName === 'footer') return 'footer';

      const className = el.className || '';
      const id = el.id || '';
      if (className.toLowerCase().includes('nav') ||
          id.toLowerCase().includes('nav') ||
          className.toLowerCase().includes('menu')) {
        return 'navigation';
      }

      if (className.toLowerCase().includes('header') ||
          id.toLowerCase().includes('header')) {
        return 'header';
      }

      if (className.toLowerCase().includes('footer') ||
          id.toLowerCase().includes('footer')) {
        return 'footer';
      }

      el = el.parentElement;
      depth++;
    }

    return 'other';
  }

  // Helper to check if element is visible
  function isElementVisible(element) {
    const computed = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    const hasVisibleDimensions = rect.width > 0 && rect.height > 0;
    const isDisplayed = computed.display !== 'none';
    const isVisible = computed.visibility !== 'hidden';
    const hasOpacity = parseFloat(computed.opacity) > 0;

    return hasVisibleDimensions && isDisplayed && isVisible && hasOpacity;
  }

  // Helper to check if element is icon/social
  function isIconOrSocial(element) {
    if (!element) return false;

    const role = element.getAttribute('role');
    if (role === 'img') return true;

    let checkElement = element;
    let depth = 0;
    while (checkElement && depth < 3) {
      const className = checkElement.className || '';
      const classLower = (typeof className === 'string' ? className : '').toLowerCase();

      if (classLower.includes('icon') || classLower.includes('social') ||
          classLower.includes('share') || classLower.includes('badge') ||
          classLower.includes('avatar') || classLower.includes('st-btn') ||
          classLower.includes('sharethis')) {
        return true;
      }

      checkElement = checkElement.parentElement;
      depth++;
    }

    // Check size
    const computed = window.getComputedStyle(element);
    const width = parseFloat(computed.width);
    const height = parseFloat(computed.height);
    if ((width > 0 && width <= 64) && (height > 0 && height <= 64)) {
      return true;
    }

    return false;
  }

  // Helper to convert rgb to hex
  function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;

    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) return null;

    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    const a = match[4] ? parseFloat(match[4]) : 1;

    if (a === 0) return null;

    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('').toUpperCase();
  }

  // Scan all elements
  const allElements = document.querySelectorAll('*');
  console.log(`\n🔍 Scanning ${allElements.length} total elements...`);

  allElements.forEach(element => {
    const location = getElementLocation(element);
    const visible = isElementVisible(element);
    const isIcon = isIconOrSocial(element);

    if (!visible || isIcon) return;

    const computed = window.getComputedStyle(element);
    const bgColor = computed.backgroundColor;
    const textColor = computed.color;
    const borderColor = computed.borderColor;

    const bgHex = rgbToHex(bgColor);
    const textHex = rgbToHex(textColor);
    const borderHex = rgbToHex(borderColor);

    if (bgHex) {
      colorsByLocation[location].add(bgHex);
      colorDetails.push({
        color: bgHex,
        location: location,
        element: element.tagName,
        property: 'background-color',
        visible: visible,
        isIcon: isIcon,
        classes: element.className,
        text: element.textContent?.substring(0, 50)
      });
    }

    if (textHex) {
      colorsByLocation[location].add(textHex);
      colorDetails.push({
        color: textHex,
        location: location,
        element: element.tagName,
        property: 'color',
        visible: visible,
        isIcon: isIcon,
        classes: element.className,
        text: element.textContent?.substring(0, 50)
      });
    }

    if (borderHex) {
      colorsByLocation[location].add(borderHex);
      colorDetails.push({
        color: borderHex,
        location: location,
        element: element.tagName,
        property: 'border-color',
        visible: visible,
        isIcon: isIcon,
        classes: element.className,
        text: element.textContent?.substring(0, 50)
      });
    }
  });

  console.log('\n📊 COLOR SUMMARY BY LOCATION:');
  console.log('Navigation colors:', colorsByLocation.navigation.size, Array.from(colorsByLocation.navigation));
  console.log('Header colors:', colorsByLocation.header.size, Array.from(colorsByLocation.header));
  console.log('Footer colors:', colorsByLocation.footer.size, Array.from(colorsByLocation.footer));
  console.log('Other colors:', colorsByLocation.other.size, Array.from(colorsByLocation.other));

  console.log('\n🎨 HEADER COLOR DETAILS:');
  const headerColors = colorDetails.filter(d => d.location === 'header');
  const headerColorGroups = {};
  headerColors.forEach(detail => {
    if (!headerColorGroups[detail.color]) {
      headerColorGroups[detail.color] = [];
    }
    headerColorGroups[detail.color].push(detail);
  });

  Object.entries(headerColorGroups).forEach(([color, details]) => {
    console.log(`\n${color} (${details.length} uses):`);
    details.slice(0, 5).forEach(d => {
      console.log(`  - ${d.element}.${d.classes} (${d.property}) - "${d.text}"`);
    });
    if (details.length > 5) {
      console.log(`  ... and ${details.length - 5} more`);
    }
  });

  console.log('\n✅ Debug complete. Check the logs above to see what colors are being detected in the header and why.');

  // Return data for further inspection
  return {
    colorsByLocation,
    colorDetails,
    headerColors: Array.from(colorsByLocation.header),
    headerColorDetails: headerColorGroups
  };
})();
