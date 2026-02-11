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
    
    .color-swatch {
      text-align: center;
    }
    
    .swatch {
      width: 100%;
      height: 80px;
      border-radius: 8px;
      border: 2px solid #e2e8f0;
      margin-bottom: 8px;
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
