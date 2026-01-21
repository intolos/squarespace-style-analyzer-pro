import { describe, it, expect } from 'vitest';
import { calculateContrastRatio, getWCAGLevel, rgbToHex } from '../../../src/utils/colorUtils';
import { groupSimilarColors, identifyGrays } from '../../../src/export/styleGuideColorsReport/analysis';

describe('Color Logic Tests', () => {
  describe('Contrast Ratio', () => {
    it('should calculate correct ratio for Black on White', () => {
      const ratio = calculateContrastRatio('#000000', '#FFFFFF');
      expect(ratio).toBeCloseTo(21, 1);
    });

    it('should calculate correct ratio for White on White', () => {
      const ratio = calculateContrastRatio('#FFFFFF', '#FFFFFF');
      expect(ratio).toBe(1);
    });

    it('should determine correct WCAG levels', () => {
      expect(getWCAGLevel(4.5, false)).toBe('AA');
      expect(getWCAGLevel(7, false)).toBe('AAA');
      expect(getWCAGLevel(3, true)).toBe('AA');
      expect(getWCAGLevel(2.5, false)).toBe('Fail');
    });
  });

  describe('Color Grouping', () => {
    it('should identify gray colors correctly', () => {
      const grays = identifyGrays(['#333333', '#FFFFFF', '#FF0000']);
      expect(grays).toContain('#333333');
      expect(grays).toContain('#FFFFFF');
      expect(grays).not.toContain('#FF0000');
    });

    it('should group similar shades together', () => {
      const colors = {
        '#000000': { count: 10, instances: [], usedAs: ['text'] },
        '#010101': { count: 5, instances: [], usedAs: ['text'] },
        '#FF0000': { count: 1, instances: [], usedAs: ['bg'] },
      };
      const groups = groupSimilarColors(colors as any);
      expect(groups.length).toBe(1);
      expect(groups[0].mainColor).toBe('#000000');
      expect(groups[0].variations).toContain('#010101');
    });
  });

  describe('Utility Functions', () => {
    it('should convert RGB to Hex', () => {
      expect(rgbToHex('rgb(0, 0, 0)')).toBe('#000000');
      expect(rgbToHex('rgb(255, 255, 255)')).toBe('#FFFFFF');
      expect(rgbToHex('rgba(255, 0, 0, 0.5)')).toBe('#FF0000');
    });

    it('should return null for invalid inputs', () => {
      expect(rgbToHex('invalid')).toBeNull();
      expect(rgbToHex('')).toBeNull();
      expect(rgbToHex(null)).toBeNull();
    });
  });
});
