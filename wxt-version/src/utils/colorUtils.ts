export interface ColorTracker {
  backgrounds: Set<string>;
  text: Set<string>;
  borders: Set<string>;
  all: Set<string>;
}

export interface ColorPalette {
  backgrounds: string[];
  text: string[];
  borders: string[];
  all: string[];
}

export function normalizeColor(colorStr: string | null | undefined): string | null {
  if (!colorStr || colorStr === 'rgba(0, 0, 0, 0)' || colorStr === 'transparent') return null;
  return colorStr;
}

export function createColorTracker(): ColorTracker {
  return {
    backgrounds: new Set(),
    text: new Set(),
    borders: new Set(),
    all: new Set(),
  };
}

export function addColor(
  colorTracker: ColorTracker,
  color: string | null | undefined,
  type: keyof ColorTracker
) {
  const normalized = normalizeColor(color);
  if (normalized) {
    // We only add to the specific type set, and 'all'.
    // Typescript ensures 'type' is valid key, but we need to check if it is 'all'.
    if (type !== 'all') {
      colorTracker[type].add(normalized);
    }
    colorTracker.all.add(normalized);
  }
}

export function finalizeColorPalette(colorTracker: ColorTracker): ColorPalette {
  return {
    backgrounds: Array.from(colorTracker.backgrounds),
    text: Array.from(colorTracker.text),
    borders: Array.from(colorTracker.borders),
    all: Array.from(colorTracker.all),
  };
}

export function rgbToHex(rgb: string | null): string | null {
  if (!rgb) return null;
  if (rgb.startsWith('#')) return rgb.toUpperCase();

  const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
  if (!match) return null;

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);

  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

export function hexToRgb(hex: string | null): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  hex = hex.replace('#', '');
  if (hex.length !== 6) return null;

  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

export function calculateLuminance(hexColor: string | null): number {
  if (!hexColor) return 0;
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return 0;

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 2), 16) / 255;
  const b = parseInt(hex.substring(4, 2), 16) / 255;

  const adjust = (val: number) =>
    val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);

  const R = adjust(r);
  const G = adjust(g);
  const B = adjust(b);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function calculateContrastRatio(color1: string, color2: string): number {
  const lum1 = calculateLuminance(color1);
  const lum2 = calculateLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getWCAGLevel(ratio: number, isLargeText: boolean): 'AAA' | 'AA' | 'Fail' {
  if (isLargeText) {
    if (ratio >= 4.5) return 'AAA';
    if (ratio >= 3.0) return 'AA';
    return 'Fail';
  } else {
    if (ratio >= 7.0) return 'AAA';
    if (ratio >= 4.5) return 'AA';
    return 'Fail';
  }
}

export function isTransparentColor(colorValue: string | null | undefined): boolean {
  if (!colorValue) return true;
  const val = colorValue.toLowerCase().trim();
  return (
    val === 'transparent' || val === 'rgba(0, 0, 0, 0)' || val === 'inherit' || val === 'initial'
  );
}
