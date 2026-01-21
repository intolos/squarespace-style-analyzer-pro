import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../../../src/export/utils';
import { extractFontSize } from '../../../src/export/csv';

describe('Export Logic', () => {
  describe('escapeHtml', () => {
    it('should escape special HTML characters', () => {
      expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
      expect(escapeHtml('Click & Save')).toBe('Click &amp; Save');
      expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
      expect(escapeHtml("'single'")).toBe('&#39;single&#39;');
    });

    it('should return empty string for null or undefined', () => {
      expect(escapeHtml('')).toBe('');
      // @ts-ignore
      expect(escapeHtml(null)).toBe('');
    });
  });

  describe('extractFontSize', () => {
    it('should extract font size from standard string', () => {
      expect(extractFontSize('font-size: 16px;')).toBe(16);
      expect(extractFontSize('font-size:24.5px; margin: 10px;')).toBe(24.5);
    });

    it('should return null for invalid or missing font size', () => {
      expect(extractFontSize('color: red;')).toBeNull();
      expect(extractFontSize('')).toBeNull();
      expect(extractFontSize(null)).toBeNull();
    });
  });
});
