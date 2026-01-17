// contrast-checker.js
// Standalone contrast checker for popup window

// Initialize on load
window.addEventListener('DOMContentLoaded', function() {
  updateContrastCheck();
  setupEventListeners();
});

function setupEventListeners() {
  // Sync color picker with text input
  document.getElementById('fgColorPicker').addEventListener('input', function() {
    document.getElementById('fgColorInput').value = this.value.toUpperCase();
    updateContrastCheck();
  });

  document.getElementById('bgColorPicker').addEventListener('input', function() {
    document.getElementById('bgColorInput').value = this.value.toUpperCase();
    updateContrastCheck();
  });

  document.getElementById('fgColorInput').addEventListener('input', function() {
    const val = this.value;
    if (/^#[0-9A-F]{6}$/i.test(val)) {
      document.getElementById('fgColorPicker').value = val;
      updateContrastCheck();
    }
  });

  document.getElementById('bgColorInput').addEventListener('input', function() {
    const val = this.value;
    if (/^#[0-9A-F]{6}$/i.test(val)) {
      document.getElementById('bgColorPicker').value = val;
      updateContrastCheck();
    }
  });
}

function updateContrastCheck() {
  const fgColor = document.getElementById('fgColorInput').value;
  const bgColor = document.getElementById('bgColorInput').value;

  // Update preview
  const preview = document.getElementById('contrastPreview');
  preview.style.color = fgColor;
  preview.style.background = bgColor;

  // Calculate contrast ratio
  const ratio = calculateContrast(fgColor, bgColor);
  document.getElementById('ratioValue').textContent = ratio.toFixed(2);

  // Update WCAG badges
  const wcagAA = document.getElementById('wcagAA');
  const wcagAAA = document.getElementById('wcagAAA');

  if (ratio >= 4.5) {
    wcagAA.className = 'badge pass';
    wcagAA.innerHTML = '✓ AA';
  } else {
    wcagAA.className = 'badge fail';
    wcagAA.innerHTML = '✗ AA';
  }

  if (ratio >= 7.0) {
    wcagAAA.className = 'badge pass';
    wcagAAA.innerHTML = '✓ AAA';
  } else {
    wcagAAA.className = 'badge fail';
    wcagAAA.innerHTML = '✗ AAA';
  }
}

function calculateContrast(fg, bg) {
  // Convert hex to RGB
  const fgRGB = hexToRgb(fg);
  const bgRGB = hexToRgb(bg);

  // Calculate relative luminance
  const fgLum = getLuminance(fgRGB);
  const bgLum = getLuminance(bgRGB);

  // Calculate contrast ratio
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  return (lighter + 0.05) / (darker + 0.05);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 0, g: 0, b: 0 };
}

function getLuminance(rgb) {
  const rsRGB = rgb.r <= 0.03928 ? rgb.r / 12.92 : Math.pow((rgb.r + 0.055) / 1.055, 2.4);
  const gsRGB = rgb.g <= 0.03928 ? rgb.g / 12.92 : Math.pow((rgb.g + 0.055) / 1.055, 2.4);
  const bsRGB = rgb.b <= 0.03928 ? rgb.b / 12.92 : Math.pow((rgb.b + 0.055) / 1.055, 2.4);
  return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
}
