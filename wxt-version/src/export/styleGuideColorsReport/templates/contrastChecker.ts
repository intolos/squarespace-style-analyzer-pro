// templates/contrastChecker.ts - WCAG Contrast Checker Tool

/**
 * Contrast checker popup HTML
 * This is a standalone tool that opens in a popup window
 */
export const CONTRAST_CHECKER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WCAG Contrast Checker</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 12px; margin: 0; background: white; color: #2d3748; }
    .header { margin-bottom: 8px; border: none; }
    h2 { font-size: 1.3rem; color: #2d3748; margin: 0 0 5px 0; }
    .instructions { font-size: 0.85rem; color: #4a5568; line-height: 1.4; margin-bottom: 15px; background: #f7fafc; padding: 10px; border-radius: 6px; border: 1px solid #edf2f7; }
    .input-section { margin-bottom: 15px; padding: 5px 0; }
    .input-row { display: flex; align-items: center; margin-bottom: 8px; }
    .input-row:last-child { margin-bottom: 0; }
    label { flex: 0 0 140px; font-weight: 600; color: #4a5568; font-size: 0.85rem; margin: 0; }
    .color-inputs { flex: 1; display: flex; gap: 8px; align-items: center; }
    input[type="color"] { width: 40px; height: 30px; border: 1px solid #cbd5e0; border-radius: 4px; cursor: pointer; padding: 0; }
    input[type="text"] { width: 140px; padding: 4px 8px; border: 1px solid #cbd5e0; border-radius: 4px; font-family: monospace; font-size: 0.9rem; height: 30px; box-sizing: border-box; }
    .results-container { display: flex; gap: 10px; margin-bottom: 10px; }
    .result-box { flex: 1; background: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; display: flex; flex-direction: column; justify-content: center; align-items: center; }
    .preview-box { flex: 1; border: 1px solid #cbd5e0; border-radius: 6px; padding: 8px; display: flex; justify-content: center; align-items: center; font-size: 1.2rem; font-weight: 600; transition: all 0.2s; }
    .ratio-value { font-size: 2.0rem; font-weight: bold; color: #2d3748; line-height: 1; margin-bottom: 2px; }
    .ratio-label { font-size: 0.75rem; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; }
    .badges-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px; }
    .badge-item { display: flex; justify-content: space-between; align-items: center; background: white; padding: 6px 10px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 0.8rem; }
    .badge-label { font-weight: 500; color: #4a5568; }
    .badge-status { font-weight: bold; }
    .info { padding: 8px; background: #eef2ff; border-left: 3px solid #667eea; border-radius: 4px; font-size: 0.8rem; line-height: 1.4; color: #4a5568; }
  </style>
</head>
<body>
  <div class="header">
    <h2>🎨 WCAG Contrast Checker</h2>
  </div>
  <div class="input-section">
    <div class="input-row">
      <label>Foreground Text:</label>
      <div class="color-inputs"><input type="color" id="fgColorPicker" value="#000000"><input type="text" id="fgColorInput" value="#000000" maxlength="7"></div>
    </div>
    <div class="input-row">
      <label>Background:</label>
      <div class="color-inputs"><input type="color" id="bgColorPicker" value="#FFFFFF"><input type="text" id="bgColorInput" value="#FFFFFF" maxlength="7"></div>
    </div>
  </div>
  <div class="instructions">Make your browser window narrower so you can keep this Contrast Checker side-by-side. Click each color box to show a color picker icon (small eyedropper) to click on then click a color from your web page. Or you can click, or drag, on the color rectangle. Or enter a color hex code. A new Color Contrast Score is shown. Multiple options makes it easy to find an acceptable combination of colors.</div>
  <div class="results-container">
    <div class="result-box">
      <div id="ratioValue" class="ratio-value">21.00</div>
      <div class="ratio-label">Contrast Ratio</div>
    </div>
    <div id="contrastPreview" class="preview-box" style="color: #000000; background: #FFFFFF;">Sample Text</div>
  </div>
  <div class="badges-grid">
    <div class="badge-item"><span class="badge-label">AA Normal</span><span id="statusAANormal" class="badge-status">Pass</span></div>
    <div class="badge-item"><span class="badge-label">AA Large</span><span id="statusAALarge" class="badge-status">Pass</span></div>
    <div class="badge-item"><span class="badge-label">AAA Normal</span><span id="statusAAANormal" class="badge-status">Pass</span></div>
    <div class="badge-item"><span class="badge-label">AAA Large</span><span id="statusAAALarge" class="badge-status">Pass</span></div>
  </div>
  <div class="info">
    <strong>WCAG 2.1 Requirements:</strong><br>
    AA Normal: &ge;4.5:1 &bull; AA Large: &ge;3:1<br>
    AAA Normal: &ge;7:1 &bull; AAA Large: &ge;4.5:1<br>
    <span style="color: #718096; font-size: 0.75rem;">Large text: 18pt (24px) or 14pt (18.66px) bold.</span>
  </div>
  <script>
    var fgPicker = document.getElementById("fgColorPicker");
    var fgInput = document.getElementById("fgColorInput");
    var bgPicker = document.getElementById("bgColorPicker");
    var bgInput = document.getElementById("bgColorInput");
    var preview = document.getElementById("contrastPreview");
    var ratioValue = document.getElementById("ratioValue");
    var statusAANormal = document.getElementById("statusAANormal");
    var statusAALarge = document.getElementById("statusAALarge");
    var statusAAANormal = document.getElementById("statusAAANormal");
    var statusAAALarge = document.getElementById("statusAAALarge");
    function hexToRgb(hex) {
      var result = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
      return result ? { r: parseInt(result[1], 16) / 255, g: parseInt(result[2], 16) / 255, b: parseInt(result[3], 16) / 255 } : { r: 0, g: 0, b: 0 };
    }
    function getLuminance(rgb) {
      var rsRGB = rgb.r <= 0.03928 ? rgb.r / 12.92 : Math.pow((rgb.r + 0.055) / 1.055, 2.4);
      var gsRGB = rgb.g <= 0.03928 ? rgb.g / 12.92 : Math.pow((rgb.g + 0.055) / 1.055, 2.4);
      var bsRGB = rgb.b <= 0.03928 ? rgb.b / 12.92 : Math.pow((rgb.b + 0.055) / 1.055, 2.4);
      return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
    }
    function calculateContrast(fg, bg) {
      var fgLum = getLuminance(hexToRgb(fg));
      var bgLum = getLuminance(hexToRgb(bg));
      var lighter = Math.max(fgLum, bgLum);
      var darker = Math.min(fgLum, bgLum);
      return (lighter + 0.05) / (darker + 0.05);
    }
    function updateStatus(element, pass) {
      element.textContent = pass ? "PASS" : "FAIL";
      element.style.color = pass ? "#22543d" : "#c53030";
      element.parentElement.style.background = pass ? "#f0fff4" : "#fff5f5";
      element.parentElement.style.borderColor = pass ? "#9ae6b4" : "#feb2b2";
    }
    function updateCheck() {
      var fg = fgInput.value;
      var bg = bgInput.value;
      preview.style.color = fg;
      preview.style.background = bg;
      var ratio = calculateContrast(fg, bg);
      ratioValue.textContent = ratio.toFixed(2);
      updateStatus(statusAANormal, ratio >= 4.5);
      updateStatus(statusAALarge, ratio >= 3.0);
      updateStatus(statusAAANormal, ratio >= 7.0);
      updateStatus(statusAAALarge, ratio >= 4.5);
    }
    fgPicker.addEventListener("input", function() { fgInput.value = this.value.toUpperCase(); updateCheck(); });
    bgPicker.addEventListener("input", function() { bgInput.value = this.value.toUpperCase(); updateCheck(); });
    fgInput.addEventListener("input", function() { if (/^#[0-9a-f]{6}$/i.test(this.value)) { fgPicker.value = this.value; updateCheck(); } });
    bgInput.addEventListener("input", function() { if (/^#[0-9a-f]{6}$/i.test(this.value)) { bgPicker.value = this.value; updateCheck(); } });
    updateCheck();
  </script>
</body>
</html>`;

/**
 * Function to open the contrast checker in a popup window
 */
export function getContrastCheckerScript(): string {
  return `
    <script>
      function showContrastChecker() {
        const width = 450;
        const height = 700;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        
        const popup = window.open('', 'ContrastChecker', 'width=' + width + ',height=' + height + ',top=' + top + ',left=' + left + ',resizable=yes,scrollbars=yes,status=yes,menubar=no,toolbar=no');
        
        if (!popup) {
          alert('Please allow popups to use the Contrast Checker Tool.');
          return;
        }
        
        const popupDoc = popup.document;
        popupDoc.open();
        popupDoc.write(\`${CONTRAST_CHECKER_HTML.replace(/`/g, '\\`')}\`);
        popupDoc.close();
      }
    </script>
  `;
}
