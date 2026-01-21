import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResultsManager } from '../../../src/managers/resultsManager';
import { ReportData } from '../../../src/export/types';

// Mock chrome.storage
const mockStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
};
(global as any).chrome = {
  storage: mockStorage,
};

describe('ResultsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizePath', () => {
    it('should strip trailing slashes', () => {
      expect(ResultsManager.normalizePath('/about/')).toBe('/about');
      expect(ResultsManager.normalizePath('/about///')).toBe('/about');
    });

    it('should return / for empty path or just slashes', () => {
      expect(ResultsManager.normalizePath('')).toBe('');
      expect(ResultsManager.normalizePath('/')).toBe('/');
      expect(ResultsManager.normalizePath('///')).toBe('/');
    });
  });

  describe('mergeResults', () => {
    const baseResults: any = {
      metadata: { domain: 'example.com', pathname: '/home', pagesAnalyzed: ['/home'] },
      headings: { 'h1': { locations: [{ url: '/home', styleDefinition: 'font-size: 24px;' }] } },
      paragraphs: {},
      buttons: {},
      siteStyles: {},
      colorPalette: { all: ['#000000'], backgrounds: [], text: [], borders: [] },
      images: [],
      qualityChecks: {},
    };

    it('should initialize with new results if accumulated is null', () => {
      const newResults: any = { ...baseResults, metadata: { ...baseResults.metadata, pathname: '/about' } as any };
      const { merged, alreadyAnalyzed } = ResultsManager.mergeResults(null, newResults);
      
      expect(alreadyAnalyzed).toBe(false);
      expect(merged.metadata.pagesAnalyzed).toContain('/about');
    });

    it('should detect already analyzed pages', () => {
      const acc = { ...baseResults, metadata: { ...baseResults.metadata, pagesAnalyzed: ['/home'] } as any };
      const { merged, alreadyAnalyzed } = ResultsManager.mergeResults(acc, baseResults);
      expect(alreadyAnalyzed).toBe(true);
      expect(merged).toBe(acc);
    });

    it('should merge headings across pages', () => {
      const newResults: any = {
        ...baseResults,
        metadata: { ...baseResults.metadata, pathname: '/about' } as any,
        headings: { 'h1': { locations: [{ url: '/about', styleDefinition: 'font-size: 24px;' }] } },
      };

      const { merged } = ResultsManager.mergeResults(baseResults, newResults);
      expect(merged.headings['h1'].locations.length).toBe(2);
      expect(merged.metadata.pagesAnalyzed).toContain('/about');
    });

    it('should merge color palettes uniquely', () => {
      const acc = { 
        ...baseResults, 
        metadata: { ...baseResults.metadata, pagesAnalyzed: ['/home'] } as any,
        colorPalette: { all: ['#000000'], backgrounds: [], text: [], borders: [] } 
      };
      const newR = { 
        ...baseResults, 
        metadata: { ...baseResults.metadata, pathname: '/about' } as any,
        colorPalette: { all: ['#000000', '#FFFFFF', '#FF0000'], backgrounds: [], text: [], borders: [] } 
      };
      
      const { merged } = ResultsManager.mergeResults(acc as any, newR as any);
      expect(merged.colorPalette?.all.length).toBe(3);
      expect(merged.colorPalette?.all).toContain('#FFFFFF');
    });

    it('should merge mobile issues correctly', () => {
      const acc: any = { ...baseResults, metadata: { ...baseResults.metadata, pagesAnalyzed: ['/home'] } };
      const newR: any = {
        ...baseResults,
        metadata: { ...baseResults.metadata, pathname: '/about' },
        mobileIssues: {
          viewportMeta: { exists: true, content: 'width=device-width', isProper: true },
          issues: [{ type: 'tap-target', element: 'button' }]
        }
      };

      const { merged } = ResultsManager.mergeResults(acc as any, newR);
      expect(merged.mobileIssues?.viewportMeta.exists).toBe(true);
      expect(merged.mobileIssues?.issues?.length).toBe(1);
    });
  });

  describe('countCategory', () => {
    it('should count total locations across subcategories', () => {
      const data = {
        'h1': { locations: [{}, {}] },
        'h2': { locations: [{}] },
        'h3': { locations: [] },
      };
      expect(ResultsManager.countCategory(data)).toBe(3);
    });
  });
});
