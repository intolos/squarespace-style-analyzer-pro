import { describe, it, expect } from 'vitest';
import { StyleComparisonUtils } from '../../../src/utils/styleComparisonUtils';

describe('StyleComparisonUtils', () => {
  describe('parseStyleDefinition', () => {
    it('should parse a standard style string', () => {
      const style = 'font-size: 16px; font-weight: bold; color: #ff0000;';
      const parsed = StyleComparisonUtils.parseStyleDefinition(style);
      expect(parsed).toEqual({
        'font-size': '16px',
        'font-weight': 'bold',
        'color': '#ff0000',
      });
    });

    it('should handle missing semicolons at the end', () => {
      const style = 'margin: 10px; padding: 5px';
      const parsed = StyleComparisonUtils.parseStyleDefinition(style);
      expect(parsed).toEqual({
        'margin': '10px',
        'padding': '5px',
      });
    });

    it('should handle extra whitespace', () => {
      const style = ' margin : 10px ; padding : 5px ';
      const parsed = StyleComparisonUtils.parseStyleDefinition(style);
      expect(parsed).toEqual({
        'margin': '10px',
        'padding': '5px',
      });
    });

    it('should return empty object for null or undefined', () => {
      expect(StyleComparisonUtils.parseStyleDefinition(undefined)).toEqual({});
      expect(StyleComparisonUtils.parseStyleDefinition('')).toEqual({});
    });
  });

  describe('filterColorProperties', () => {
    it('should remove color-related properties', () => {
      const styleObj = {
        'display': 'block',
        'color': 'red',
        'font-size': '12px',
        'background-color': 'blue',
        'border-color': 'green',
      };
      const filtered = StyleComparisonUtils.filterColorProperties(styleObj);
      expect(filtered).toEqual({
        'display': 'block',
        'font-size': '12px',
      });
    });
  });

  describe('getStyleDifferences', () => {
    it('should identify differing properties', () => {
      const base = 'font-size: 16px; display: block;';
      const comp = 'font-size: 18px; display: block; font-weight: bold;';
      const diffs = StyleComparisonUtils.getStyleDifferences(base, comp);
      expect(diffs).toContain('font-size');
      expect(diffs).toContain('font-weight');
      expect(diffs.length).toBe(2);
    });

    it('should ignore color differences', () => {
      const base = 'font-size: 16px; color: red;';
      const comp = 'font-size: 16px; color: blue;';
      const diffs = StyleComparisonUtils.getStyleDifferences(base, comp);
      expect(diffs).toEqual([]);
    });
  });

  describe('groupByStyleDefinition', () => {
    it('should group locations by their visual style', () => {
      const locations = [
        { styleDefinition: 'font-size: 16px; color: red;' },
        { styleDefinition: 'font-size: 16px; color: blue;' }, // same visual
        { styleDefinition: 'font-size: 18px; color: red;' }, // different visual
      ];
      const groups = StyleComparisonUtils.groupByStyleDefinition(locations);
      expect(groups.length).toBe(2);
      expect(groups[0].instances.length).toBe(2); // 16px group
      expect(groups[1].instances.length).toBe(1); // 18px group
    });
  });
});
