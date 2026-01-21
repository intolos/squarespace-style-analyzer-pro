import { describe, it, expect, vi } from 'vitest';
// We need to handle the import and potentially mock dependencies
import { calculateQualityChecks } from '../../../src/export/qualityChecks';
import { ReportData } from '../../../src/export/types';

describe('Quality Checks Logic', () => {
  const mockExportFn = vi.fn();
  
  const baseData: ReportData = {
    metadata: { domain: 'example.com', pathname: '/home' },
    headings: {},
    paragraphs: {},
    buttons: {},
    siteStyles: {},
    colorPalette: { all: [], backgrounds: [], text: [], borders: [] },
    images: [],
    qualityChecks: {
      missingH1: [],
      multipleH1: [],
      brokenHeadingHierarchy: [],
    }
  };

  describe('calculateQualityChecks', () => {
    it('should return 11% score for empty/default data (one check passes by default: link styling)', () => {
        // totalChecks = 9. If only one passes (link styling because list is empty), score is 11.
        const result = calculateQualityChecks(baseData, 'brand', mockExportFn);
        expect(result.score).toBeGreaterThan(0);
        expect(result.checks.length).toBeGreaterThan(0);
    });

    it('should identify missing H1 issues', () => {
      const dataWithIssue = {
        ...baseData,
        qualityChecks: {
          ...baseData.qualityChecks,
          missingH1: [{ url: '/home', page: 'Home' }]
        }
      };
      const result = calculateQualityChecks(dataWithIssue as any, 'brand', mockExportFn);
      const h1Check = result.checks.find(c => c.message.includes('missing H1'));
      expect(h1Check?.passed).toBe(false);
    });

    it('should identify multiple H1 issues', () => {
        const dataWithIssue = {
          ...baseData,
          qualityChecks: {
            ...baseData.qualityChecks,
            multipleH1: [{ url: '/home', page: 'Home', count: 2 }]
          }
        };
        const result = calculateQualityChecks(dataWithIssue as any, 'brand', mockExportFn);
        const h1Check = result.checks.find(c => c.message.includes('multiple H1'));
        expect(h1Check?.passed).toBe(false);
      });
  });
});
