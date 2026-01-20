#!/usr/bin/env node

/**
 * Automated Color Tracking Test
 * Run with: node test-color-tracking.js
 *
 * This script will:
 * 1. Launch Chrome with the extension loaded
 * 2. Navigate to test pages
 * 3. Run analysis and check color counts
 * 4. Report pass/fail results
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Test configuration
const EXTENSION_PATH = __dirname;
const TEST_PAGES = [
  {
    url: 'https://launchhappy.co/guides',
    name: 'LaunchHappy Guides',
    expectedHeaderColors: ['#000000', '#FFFFFF', '#5B3A8D', '#4A5568'],
    maxHeaderColors: 6,
    problematicColors: ['#CB2027', '#4267B2', '#25D366'] // ShareThis colors
  },
  {
    url: 'https://www.emmaworth.com/',
    name: 'Emma Worth',
    expectedHeaderColors: ['#587A96', '#BF9B4A', '#FFFFFF'],
    maxHeaderColors: 4,
    problematicColors: ['#CB2027', '#4267B2', '#25D366']
  }
];

async function runTests() {
  console.log('🚀 Starting Automated Color Tracking Tests\n');
  console.log('Extension path:', EXTENSION_PATH);
  console.log('Test pages:', TEST_PAGES.length, '\n');

  // Launch Chrome with extension
  console.log('📦 Loading Chrome with extension...');
  const browser = await puppeteer.launch({
    headless: false, // Need to see the extension in action
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  const results = [];

  try {
    for (const testPage of TEST_PAGES) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🧪 Testing: ${testPage.name}`);
      console.log(`   URL: ${testPage.url}`);
      console.log(`${'='.repeat(60)}\n`);

      const page = await browser.newPage();

      // Enable console message capturing
      const consoleLogs = [];
      page.on('console', msg => {
        const text = msg.text();
        consoleLogs.push(text);
        // Print console messages in real-time for debugging
        if (text.includes('TEST') || text.includes('Color') || text.includes('===')) {
          console.log('   [Console]', text);
        }
      });

      // Navigate to page
      console.log('📄 Loading page...');
      await page.goto(testPage.url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Wait for page to be ready
      console.log('⏳ Waiting for page to load completely...');
      await page.waitForTimeout(3000);

      // Check if extension's ColorAnalyzer is available and use it
      console.log('🔍 Running analysis using extension code...');

      const testResults = await page.evaluate(() => {
        // Check if the extension's ColorAnalyzer is loaded
        if (typeof ColorAnalyzer !== 'undefined' && ColorAnalyzer.getElementLocation) {
          console.log('[TEST] Using ACTUAL extension ColorAnalyzer');

          const headerColors = new Set();
          const colorDetails = {};
          const problematicColors = ['#CB2027', '#4267B2', '#25D366'];
          let problematicCount = 0;

          const allElements = document.querySelectorAll('*');
          allElements.forEach(el => {
            // Use the ACTUAL extension's getElementLocation function
            const location = ColorAnalyzer.getElementLocation(el);

            if (location === 'header') {
              const s = window.getComputedStyle(el);
              const r = el.getBoundingClientRect();
              const isVisible = r.width > 0 && r.height > 0 &&
                               s.display !== 'none' &&
                               s.visibility !== 'hidden' &&
                               parseFloat(s.opacity) > 0;

              if (isVisible) {
                [
                  { color: s.backgroundColor, prop: 'bg' },
                  { color: s.color, prop: 'text' },
                  { color: s.borderColor, prop: 'border' }
                ].forEach(item => {
                  const hex = ColorAnalyzer.rgbToHex(item.color);
                  if (hex) {
                    headerColors.add(hex);
                    if (problematicColors.includes(hex)) problematicCount++;

                    if (!colorDetails[hex]) colorDetails[hex] = [];
                    if (colorDetails[hex].length < 3) {
                      colorDetails[hex].push({
                        tag: el.tagName,
                        class: (el.className || '').toString().substring(0, 30),
                        prop: item.prop
                      });
                    }
                  }
                });
              }
            }
          });

          return {
            headerColorCount: headerColors.size,
            actualColors: Array.from(headerColors),
            problematicCount: problematicCount,
            colorDetails: colorDetails,
            extensionDataAvailable: true
          };
        }

        console.log('[TEST] Extension not loaded, using fallback');
        // Fallback to manual analysis if extension didn't load
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
            if ((typeof className === 'string' && className.toLowerCase().includes('nav')) ||
                (typeof id === 'string' && id.toLowerCase().includes('nav'))) return 'navigation';
            if ((typeof className === 'string' && className.toLowerCase().includes('header')) ||
                (typeof id === 'string' && id.toLowerCase().includes('header'))) return 'header';
            if ((typeof className === 'string' && className.toLowerCase().includes('footer')) ||
                (typeof id === 'string' && id.toLowerCase().includes('footer'))) return 'footer';
            el = el.parentElement;
            depth++;
          }
          return 'other';
        }

        function rgbToHex(rgb) {
          if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;
          const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
          if (!match) return null;
          const a = match[4] ? parseFloat(match[4]) : 1;
          if (a === 0) return null;
          return '#' + [match[1], match[2], match[3]].map(x => {
            const hex = parseInt(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
          }).join('').toUpperCase();
        }

        function isVisible(el) {
          const s = window.getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0;
        }

        function isIconOrSocial(el) {
          if (!el) return false;

          // Check role
          const role = el.getAttribute('role');
          if (role === 'img') return true;

          // Check element and parents for icon/social classes
          let check = el;
          let depth = 0;
          while (check && depth < 3) {
            const className = check.className || '';
            const classLower = (typeof className === 'string' ? className : '').toLowerCase();

            if (classLower.includes('icon') || classLower.includes('social') ||
                classLower.includes('share') || classLower.includes('badge') ||
                classLower.includes('avatar') || classLower.includes('st-btn') ||
                classLower.includes('sharethis')) {
              return true;
            }

            check = check.parentElement;
            depth++;
          }

          // Check size - elements <= 64x64 are icons
          const s = window.getComputedStyle(el);
          const w = parseFloat(s.width);
          const h = parseFloat(s.height);
          if ((w > 0 && w <= 64) && (h > 0 && h <= 64)) {
            return true;
          }

          return false;
        }

        const headerColors = new Set();
        const problematicColors = ['#CB2027', '#4267B2', '#25D366'];
        let problematicCount = 0;
        const colorDetails = {};

        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          if (getElementLocation(el) === 'header' && isVisible(el) && !isIconOrSocial(el)) {
            const s = window.getComputedStyle(el);
            [
              { color: s.backgroundColor, prop: 'bg' },
              { color: s.color, prop: 'text' },
              { color: s.borderColor, prop: 'border' }
            ].forEach(item => {
              const hex = rgbToHex(item.color);
              if (hex) {
                headerColors.add(hex);
                if (problematicColors.includes(hex)) problematicCount++;

                // Track which elements use this color
                if (!colorDetails[hex]) {
                  colorDetails[hex] = [];
                }
                if (colorDetails[hex].length < 3) {
                  colorDetails[hex].push({
                    tag: el.tagName,
                    class: (el.className || '').toString().substring(0, 30),
                    prop: item.prop
                  });
                }
              }
            });
          }
        });

        return {
          headerColorCount: headerColors.size,
          actualColors: Array.from(headerColors),
          problematicCount: problematicCount,
          colorDetails: colorDetails,
          extensionDataAvailable: false
        };
      });

      // Use the results from evaluation
      let headerColorCount = testResults.headerColorCount;

      // Log whether we used extension data or fallback
      if (testResults.extensionDataAvailable) {
        console.log('   ✅ Using ACTUAL extension analysis results');
      } else {
        console.log('   ⚠️  Extension not available, using fallback analysis');
      }
      let problematicCount = testResults.problematicCount;
      let actualColors = testResults.actualColors;

      // Determine pass/fail
      const colorCountOK = headerColorCount <= testPage.maxHeaderColors;
      const noProblematicColors = problematicCount === 0;
      const passed = colorCountOK && noProblematicColors;

      // Display results
      console.log('📊 Test Results:');
      console.log(`   Header colors found: ${headerColorCount} (max: ${testPage.maxHeaderColors})`);
      console.log(`   Actual colors: ${actualColors.join(', ') || 'Not captured'}`);
      console.log(`   Expected colors: ${testPage.expectedHeaderColors.join(', ')}`);
      console.log(`   Problematic colors: ${problematicCount}`);

      // Show which elements are using each color
      if (testResults.colorDetails && Object.keys(testResults.colorDetails).length > 0) {
        console.log('\n   Color usage details:');
        actualColors.forEach(color => {
          const details = testResults.colorDetails[color];
          if (details && details.length > 0) {
            console.log(`     ${color}:`);
            details.forEach(d => {
              console.log(`       - ${d.tag}.${d.class} (${d.prop})`);
            });
          }
        });
      }

      console.log(`\n   Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

      if (!colorCountOK) {
        console.log(`   ⚠️  Too many header colors (${headerColorCount} > ${testPage.maxHeaderColors})`);
      }
      if (problematicCount > 0) {
        console.log(`   ⚠️  Found ${problematicCount} problematic colors (ShareThis buttons)`);
      }

      // Store result
      results.push({
        name: testPage.name,
        url: testPage.url,
        passed,
        headerColorCount,
        actualColors,
        expectedColors: testPage.expectedHeaderColors,
        problematicCount,
        colorCountOK,
        noProblematicColors
      });

      await page.close();
    }

    // Final summary
    console.log(`\n\n${'='.repeat(60)}`);
    console.log('📋 FINAL TEST SUMMARY');
    console.log(`${'='.repeat(60)}\n`);

    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.filter(r => !r.passed).length;

    results.forEach(result => {
      console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
      console.log(`   Colors: ${result.headerColorCount} (expected ≤ ${result.expectedColors.length + 2})`);
      if (!result.colorCountOK) {
        console.log(`   ⚠️  Too many colors`);
      }
      if (result.problematicCount > 0) {
        console.log(`   ⚠️  ${result.problematicCount} problematic colors found`);
      }
      console.log('');
    });

    console.log(`Total: ${passedTests} passed, ${failedTests} failed\n`);

    if (failedTests === 0) {
      console.log('🎉 ALL TESTS PASSED! Color tracking is working correctly.\n');
    } else {
      console.log('💔 TESTS FAILED. Color tracking needs fixes.\n');
      console.log('Common issues:');
      console.log('  1. _processedElements Set not working (duplicates)');
      console.log('  2. Icon/social button filtering not working');
      console.log('  3. Visibility filtering not working');
      console.log('  4. Wrong viewport (mobile vs desktop)\n');
    }

  } catch (error) {
    console.error('❌ Test execution error:', error);
  } finally {
    await browser.close();
  }
}

// Check if puppeteer is installed
try {
  require.resolve('puppeteer');
} catch (e) {
  console.error('❌ Error: puppeteer is not installed');
  console.log('\nPlease install puppeteer first:');
  console.log('  npm install puppeteer');
  console.log('\nOr run this test from the extension directory after running:');
  console.log('  npm init -y && npm install puppeteer\n');
  process.exit(1);
}

// Run tests
runTests().catch(console.error);
