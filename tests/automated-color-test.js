// Automated color tracking test - runs automatically on page load
// This script will be injected as a content script for testing

(function() {
  'use strict';

  // Wait for page to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAutomatedTest);
  } else {
    runAutomatedTest();
  }

  function runAutomatedTest() {
    console.log('\n\n=== AUTOMATED COLOR TRACKING TEST ===');
    console.log('Page:', window.location.href);
    console.log('Time:', new Date().toISOString());

    // Test 1: Check if new code is loaded
    console.log('\n📋 TEST 1: Code Version Check');
    try {
      // Try to access the functions to see if they exist
      const hasHelpers = typeof ContentScriptHelpers !== 'undefined';
      const hasAnalyzer = typeof ColorAnalyzer !== 'undefined';
      console.log('  ✓ ContentScriptHelpers loaded:', hasHelpers);
      console.log('  ✓ ColorAnalyzer loaded:', hasAnalyzer);
    } catch (e) {
      console.error('  ✗ Error checking code:', e.message);
    }

    // Test 2: Count elements by location
    console.log('\n📋 TEST 2: Element Location Detection');
    const locationCounts = {
      header: 0,
      navigation: 0,
      footer: 0,
      other: 0
    };

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
        if ((className.toLowerCase && className.toLowerCase().includes('nav')) ||
            (id.toLowerCase && id.toLowerCase().includes('nav'))) {
          return 'navigation';
        }
        if ((className.toLowerCase && className.toLowerCase().includes('header')) ||
            (id.toLowerCase && id.toLowerCase().includes('header'))) {
          return 'header';
        }
        if ((className.toLowerCase && className.toLowerCase().includes('footer')) ||
            (id.toLowerCase && id.toLowerCase().includes('footer'))) {
          return 'footer';
        }
        el = el.parentElement;
        depth++;
      }
      return 'other';
    }

    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      const location = getElementLocation(el);
      locationCounts[location]++;
    });

    console.log('  Total elements by location:');
    console.log('    Header:', locationCounts.header);
    console.log('    Navigation:', locationCounts.navigation);
    console.log('    Footer:', locationCounts.footer);
    console.log('    Other:', locationCounts.other);

    // Test 3: Find header elements and their colors
    console.log('\n📋 TEST 3: Header Element Analysis');
    const headerElements = Array.from(allElements).filter(el => getElementLocation(el) === 'header');
    const headerColors = new Set();
    const headerColorDetails = {};

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

    function isElementVisible(element) {
      const computed = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 &&
             computed.display !== 'none' &&
             computed.visibility !== 'hidden' &&
             parseFloat(computed.opacity) > 0;
    }

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
            classLower.includes('share') || classLower.includes('st-btn') ||
            classLower.includes('sharethis')) {
          return true;
        }
        checkElement = checkElement.parentElement;
        depth++;
      }

      const computed = window.getComputedStyle(element);
      const width = parseFloat(computed.width);
      const height = parseFloat(computed.height);
      return (width > 0 && width <= 64) && (height > 0 && height <= 64);
    }

    let visibleCount = 0;
    let invisibleCount = 0;
    let iconCount = 0;

    headerElements.forEach(el => {
      const visible = isElementVisible(el);
      const isIcon = isIconOrSocial(el);

      if (!visible) {
        invisibleCount++;
        return;
      }
      if (isIcon) {
        iconCount++;
        return;
      }

      visibleCount++;
      const computed = window.getComputedStyle(el);
      const colors = [
        { hex: rgbToHex(computed.backgroundColor), property: 'background-color', value: computed.backgroundColor },
        { hex: rgbToHex(computed.color), property: 'color', value: computed.color },
        { hex: rgbToHex(computed.borderColor), property: 'border-color', value: computed.borderColor }
      ];

      colors.forEach(c => {
        if (c.hex) {
          headerColors.add(c.hex);
          if (!headerColorDetails[c.hex]) {
            headerColorDetails[c.hex] = {
              properties: new Set(),
              elements: [],
              count: 0
            };
          }
          headerColorDetails[c.hex].properties.add(c.property);
          headerColorDetails[c.hex].count++;
          if (headerColorDetails[c.hex].elements.length < 3) {
            headerColorDetails[c.hex].elements.push({
              tag: el.tagName,
              class: el.className,
              text: (el.textContent || '').substring(0, 30)
            });
          }
        }
      });
    });

    console.log(`  Header elements found: ${headerElements.length}`);
    console.log(`    - Visible & not icon: ${visibleCount}`);
    console.log(`    - Invisible (filtered): ${invisibleCount}`);
    console.log(`    - Icons (filtered): ${iconCount}`);
    console.log(`  \n  Unique header colors: ${headerColors.size}`);

    console.log('\n  Color breakdown:');
    Array.from(headerColors).sort().forEach(hex => {
      const details = headerColorDetails[hex];
      console.log(`    ${hex} (${details.count} uses, ${Array.from(details.properties).join(', ')})`);
      details.elements.forEach(el => {
        console.log(`      - ${el.tag}${el.class ? '.' + el.class.split(' ')[0] : ''}: "${el.text}"`);
      });
    });

    // Test 4: Check for specific problematic colors (ShareThis)
    console.log('\n📋 TEST 4: ShareThis/Social Button Detection');
    const shareThisColors = ['#CB2027', '#4267B2', '#25D366', '#1DA1F2', '#FF0000'];
    const foundProblematic = [];

    shareThisColors.forEach(color => {
      if (headerColors.has(color)) {
        foundProblematic.push(color);
        console.log(`  ✗ PROBLEM: Found social button color ${color} in header`);
        const details = headerColorDetails[color];
        details.elements.forEach(el => {
          console.log(`      From: ${el.tag}${el.class ? '.' + el.class.split(' ')[0] : ''}`);
        });
      }
    });

    if (foundProblematic.length === 0) {
      console.log('  ✓ No social button colors found in header');
    }

    // Test 5: Expected colors
    console.log('\n📋 TEST 5: Expected Color Check');
    const expectedColors = {
      'launchhappy.co': ['#000000', '#FFFFFF', '#5B3A8D', '#4A5568'],
      'emmaworth.com': ['#587A96', '#BF9B4A', '#FFFFFF']
    };

    const domain = window.location.hostname;
    const expected = Object.keys(expectedColors).find(key => domain.includes(key.split('.')[0]));

    if (expected) {
      console.log(`  Expected colors for ${expected}:`, expectedColors[expected]);
      console.log(`  Actual header colors:`, Array.from(headerColors).sort());

      const missing = expectedColors[expected].filter(c => !headerColors.has(c));
      const extra = Array.from(headerColors).filter(c => !expectedColors[expected].includes(c));

      if (missing.length > 0) {
        console.log(`  ⚠️  Missing expected colors:`, missing);
      }
      if (extra.length > 0) {
        console.log(`  ⚠️  Extra unexpected colors:`, extra);
      }
      if (missing.length === 0 && extra.length === 0) {
        console.log(`  ✓ Perfect match!`);
      }
    }

    // Summary
    console.log('\n\n=== TEST SUMMARY ===');
    console.log(`Total header colors: ${headerColors.size}`);
    console.log(`Problematic colors found: ${foundProblematic.length}`);
    console.log(`Header elements processed: ${visibleCount} (filtered out ${invisibleCount} invisible + ${iconCount} icons)`);

    if (headerColors.size <= 6 && foundProblematic.length === 0) {
      console.log('✅ TEST PASSED: Header colors look correct!');
    } else {
      console.log('❌ TEST FAILED: Too many header colors or social buttons detected');
    }
    console.log('=== END TEST ===\n\n');
  }
})();
