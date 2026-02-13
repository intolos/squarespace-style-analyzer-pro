import { ACCORDION_STYLES, ACCORDION_SCRIPT, REPORT_SCRIPTS } from '../../reportStyles';

export const COLOR_REPORT_STYLES = `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #2d3748;
      background: #f8fafc;
      margin: 0px;
      padding: 20px;
    }

    ${ACCORDION_STYLES}

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    .header {
      text-align: center;
      margin-bottom: 50px;
      padding-bottom: 10px;
      border-bottom: 3px solid #667eea;
    }
    
    .header h1 {
      font-size: 2.7rem;
      color: #2d3748;
      margin: 0 0 10px 0;
    }
    
    .header p {
      color: #7180D8;
      font-size: 1.8rem;
    }

    .quality-score {
      background: #667eea;
      color: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
      text-align: center;
    }
    
    .quality-score h2 {
      font-size: 1.9rem;
      margin-bottom: 20px;
    }
    
    .score-circle {
      font-size: 3rem;
      font-weight: bold;
      margin: 20px 0;
    }
    
    .quality-score p {
      font-size: 1.1rem;
      margin: 10px 0;
      opacity: 0.95;
    }
    
    .section {
      margin-bottom: 40px;
    }
    
    .section h2 {
      font-size: 1.8rem;
      color: #2d3748;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .color-swatch-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    
    /* IMPORTANT: Swatch hover overlay — shows "Click for details" on top of the swatch.
       Uses position:relative on .color-swatch and absolute overlay on .swatch. */
    .color-swatch {
      text-align: center;
      position: relative;
      cursor: pointer;
    }

    .swatch {
      width: 100%;
      height: 80px;
      border-radius: 8px;
      border: 2px solid #e2e8f0;
      margin-bottom: 8px;
      position: relative;
      transition: border-color 0.2s;
    }

    /* Hover overlay on the swatch itself */
    .swatch::after {
      content: 'Click for details';
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.55);
      color: #fff;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 6px;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
    }

    .color-swatch:hover .swatch::after {
      opacity: 1;
    }

    /* Active swatch highlight — indigo border when drawer is open */
    .color-swatch.swatch-active .swatch {
      border-color: #667eea;
      border-width: 3px;
      box-shadow: 0 0 0 2px rgba(102,126,234,0.3);
    }

    .swatch-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #2d3748;
      font-family: monospace;
    }

    .swatch-count {
      font-size: 0.75rem;
      color: #718096;
    }

    /* --- Merged Badge with popup --- */
    .merged-badge {
      display: block;
      width: fit-content;
      margin: 3px auto 0 auto;
      font-size: 0.65rem;
      color: #667eea;
      background: #ebf4ff;
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
      position: relative;
    }

    .badge-popup {
      display: none;
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background: #1a202c;
      color: #e2e8f0;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.72rem;
      line-height: 1.6;
      white-space: nowrap;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      pointer-events: none;
    }

    /* IMPORTANT: Triangle arrow pointing down from the popup to the badge */
    .badge-popup::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 6px solid transparent;
      border-top-color: #1a202c;
    }

    .merged-badge:hover .badge-popup {
      display: block;
      pointer-events: auto;
    }

    /* --- Instance Drawer (full-width, below swatch row) --- */
    .instance-drawer {
      display: none;
      grid-column: 1 / -1;
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin-top: 10px;
      position: relative;
    }

    .instance-drawer.drawer-open {
      display: block;
    }

    /* IMPORTANT: Upward triangle indicator connecting drawer to its swatch.
       Positioned via JS using --triangle-left custom property. */
    .instance-drawer::before {
      content: '';
      position: absolute;
      top: -10px;
      left: var(--triangle-left, 50px);
      border: 10px solid transparent;
      border-bottom-color: #f7fafc;
    }

    .instance-drawer::after {
      content: '';
      position: absolute;
      top: -12px;
      left: var(--triangle-left, 50px);
      border: 10px solid transparent;
      border-bottom-color: #e2e8f0;
      z-index: -1;
    }

    /* Page group header inside the drawer */
    .instance-page-group {
      margin-bottom: 16px;
    }

    .instance-page-group:last-child {
      margin-bottom: 0;
    }

    .instance-page-header {
      font-size: 0.85rem;
      font-weight: 700;
      color: #2d3748;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
    }

    .instance-page-header a {
      color: #667eea;
      text-decoration: underline;
      font-weight: 400;
      font-size: 0.78rem;
      margin-left: 8px;
    }

    /* 5-column responsive grid for instance cards */
    .instance-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
    }

    @media (max-width: 1100px) {
      .instance-grid { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 700px) {
      .instance-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 480px) {
      .instance-grid { grid-template-columns: 1fr; }
    }

    /* Instance card */
    .instance-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 0.75rem;
      line-height: 1.5;
      color: #000 !important;
    }


    .instance-card-tag {
      font-weight: 700;
      color: #000 !important;
      font-size: 0.78rem;
    }

    .instance-card-prop {
      color: #667eea;
      font-family: monospace;
      font-size: 0.7rem;
    }

    .instance-card-location {
      color: #000 !important;
      margin-bottom: 5px;
      font-weight: 500;
    }

    .instance-card-context {
      color: #000 !important;
      font-style: italic;
      font-size: 0.73rem;
      margin-top: 4px;
      word-break: break-word;
    }

    .instance-card-meta {
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px solid #edf2f7;
      font-family: monospace;
      font-size: 0.68rem;
      color: #000 !important;
    }

    .instance-card-actions {
      margin-top: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .instance-card-actions a.locate-btn {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 3px 8px;
      background: #667eea;
      color: white;
      border-radius: 4px;
      text-decoration: none;
      font-size: 0.68rem;
      font-weight: 600;
    }

    /* Selector popup link */
    .selector-link {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      cursor: pointer;
      color: #667eea;
      font-size: 0.68rem;
      font-weight: 600;
      background: none;
      border: none;
      padding: 3px 8px;
      border-radius: 4px;
      font-family: inherit;
    }

    .selector-link:hover {
      background: #ebf4ff;
    }

    /* Selector popup (floating) */
    .selector-popup {
      display: none;
      position: fixed;
      background: #1a202c;
      color: #e2e8f0;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 0.78rem;
      line-height: 1.5;
      z-index: 200;
      max-width: 500px;
      word-break: break-all;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      font-family: monospace;
    }

    .selector-popup.popup-visible {
      display: block;
    }

    .selector-popup-copy {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 10px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 0.72rem;
      cursor: pointer;
      font-family: inherit;
    }

    .selector-popup-copy:hover {
      background: #5a67d8;
    }

    /* Styles popup (floating, white BG, black text) */
    .styles-popup {
      display: none;
      position: fixed;
      background: white;
      color: black;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 0.85rem;
      line-height: 1.5;
      z-index: 201;
      width: 380px;
      max-width: 380px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      border: 1px solid #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-sizing: border-box;
    }

    .styles-popup.popup-visible {
      display: block;
    }
    
    .styles-row {
      display: flex;
      justify-content: flex-start;
      align-items: flex-start;
      gap: 0;
      margin-bottom: 6px;
      border-bottom: 1px solid #f7fafc;
      padding-bottom: 4px;
      min-width: 0;
    }

    .styles-label {
      color: #000;
      font-size: 0.78rem;
      font-weight: 700;
      flex-shrink: 0;
    }

    .styles-value {
      display: block !important;
      flex: 1 1 auto;
      min-width: 0;
      margin-left: 8px;
      text-align: left;
      color: #000 !important;
      font-family: monospace;
      font-size: 0.82rem;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
      white-space: normal !important;
      max-width: 280px;
    }

    
    .color-category-section {
      background: #f7fafc;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      border-left: 4px solid #667eea;
    }

    .color-group {
      background: #f7fafc;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      border-left: 4px solid #667eea;
    }
    
    .color-group h3 {
      font-size: 1.3rem;
      margin-bottom: 15px;
      color: #2d3748;
    }
    
    .color-variations {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
    }
    
    .variation-item {
      display: flex;
      align-items: center;
      gap: 8px;
      background: white;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    
    .variation-swatch {
      width: 30px;
      height: 30px;
      border-radius: 4px;
      border: 1px solid #cbd5e0;
    }
    
    .variation-info {
      font-size: 0.85rem;
    }
    
    .variation-hex {
      font-family: monospace;
      font-weight: 600;
      color: #2d3748;
    }
    
    .variation-count {
      color: #718096;
    }
    
    .outlier-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    
    .outlier-item {
      background: #fff5f5;
      padding: 15px;
      border-radius: 6px;
      border-left: 3px solid #e53e3e;
    }
    
    .outlier-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    
    .outlier-swatch {
      width: 40px;
      height: 40px;
      border-radius: 4px;
      border: 1px solid #cbd5e0;
    }
    
    .outlier-info {
      font-size: 0.9rem;
    }
    
    .outlier-hex {
      font-family: monospace;
      font-weight: 600;
      color: #2d3748;
    }
    
    .outlier-location {
      font-size: 0.85rem;
      color: #718096;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #fed7d7;
    }
    
    .contrast-issue {
      background: #fff5f5;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 15px;
      border-left: 4px solid #e53e3e;
      transition: background 0.2s;
    }
    
    .contrast-issue:hover {
      background: #fed7d7;
    }
    
    .contrast-header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 10px;
      width: 100%;
    }

    .contrast-inspect {
      margin-left: auto;
    }
    
    .contrast-colors {
      display: flex;
      gap: 5px;
    }
    
    .contrast-swatch {
      width: 50px;
      height: 50px;
      border-radius: 4px;
      border: 1px solid #cbd5e0;
    }
    
    .contrast-info {
      flex: 1;
    }
    
    .contrast-ratio {
      font-size: 1.1rem;
      font-weight: 600;
      color: #e53e3e;
    }
    
    .contrast-location {
      font-size: 0.85rem;
      color: #718096;
      margin-top: 8px;
    }
    
    .page-breakdown {
      background: #f7fafc;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 15px;
      border-left: 4px solid #667eea;
    }
    
    .page-breakdown h3 {
      font-size: 1.2rem;
      color: #2d3748;
      margin-bottom: 10px;
    }
    
    .page-url {
      font-size: 0.85rem;
      color: #718096;
      margin-bottom: 15px;
      word-break: break-all;
    }
    
    .page-colors {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .page-color-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: white;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    
    .page-color-swatch {
      width: 20px;
      height: 20px;
      border-radius: 3px;
      border: 1px solid #cbd5e0;
    }
    
    .issues-list {
      list-style: none;
      padding: 0;
    }
    
    .issues-list li {
      background: #fff5f5;
      padding: 12px 15px;
      margin-bottom: 10px;
      border-radius: 6px;
      border-left: 4px solid #e53e3e;
      color: #742a2a;
      transition: background 0.2s;
    }
    
    .issues-list li:hover {
      background: #fed7d7;
    }
    
    .warnings-list {
      list-style: none;
      padding: 0;
    }
    
    .warnings-list li {
      background: #fffaf0;
      padding: 12px 15px;
      margin-bottom: 10px;
      border-radius: 6px;
      border-left: 4px solid #ed8936;
      color: #7c2d12;
      transition: background 0.2s;
    }
    
    .warnings-list li:hover {
      background: #feebc8;
    }
`;

export { ACCORDION_SCRIPT, REPORT_SCRIPTS };
