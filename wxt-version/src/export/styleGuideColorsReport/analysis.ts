// analysis.ts - Color analysis logic

import type { ColorAnalysis, ColorGroup, RGB, ReportData, ColorData } from './types';

/**
 * Analyze color consistency and generate score
 */
export function analyzeColorConsistency(data: ReportData): ColorAnalysis {
  const colorData = data.colorData;
  const colors = colorData.colors;
  const allColors = Object.keys(colors);
  const totalColors = allColors.length;

  let score = 10.0;
  const issues: string[] = [];
  const warnings: string[] = [];
  const deductions: Array<{ reason: string; points: number }> = [];

  // 1. Count total colors
  if (totalColors > 50) {
    const deduction = 3.0;
    score -= deduction;
    deductions.push({
      reason: `Excessive colors: ${totalColors} total (recommend 10-15)`,
      points: deduction,
    });
    issues.push(
      `Excessive colors detected: ${totalColors} colors found (professional sites typically use 10-15)`
    );
  } else if (totalColors > 35) {
    const deduction = 2.0;
    score -= deduction;
    deductions.push({
      reason: `Too many colors: ${totalColors} total (recommend 10-15)`,
      points: deduction,
    });
  } else if (totalColors > 25) {
    const deduction = 1.0;
    score -= deduction;
    deductions.push({
      reason: `High color count: ${totalColors} total (recommend 10-15)`,
      points: deduction,
    });
  }

  // 2. Group similar colors and detect variations
  const colorGroups = groupSimilarColors(colors);

  colorGroups.forEach(group => {
    if (group.variations.length > 8) {
      const deduction = 1.5;
      score -= deduction;
      deductions.push({
        reason: `Color family with ${group.variations.length} variations (consolidate similar shades)`,
        points: deduction,
      });
      issues.push(`Color family has ${group.variations.length} variations`);
    } else if (group.variations.length > 5) {
      const deduction = 1.0;
      score -= deduction;
      deductions.push({
        reason: `Color family with ${group.variations.length} variations`,
        points: deduction,
      });
    }
  });

  // 3. Detect grays/neutrals
  const grays = identifyGrays(allColors);
  if (grays.length > 12) {
    const deduction = 1.5;
    score -= deduction;
    deductions.push({
      reason: `Too many gray shades: ${grays.length} (recommend 3-5)`,
      points: deduction,
    });
    issues.push(`Too many gray shades: ${grays.length}`);
  } else if (grays.length > 8) {
    const deduction = 1.0;
    score -= deduction;
    deductions.push({
      reason: `Many gray shades: ${grays.length} (recommend 3-5)`,
      points: deduction,
    });
  }

  // 4. Detect outliers (colors used 1-2 times)
  const outliers = allColors.filter(color => colors[color].count <= 2);
  if (outliers.length > 10) {
    const deduction = 2.0;
    score -= deduction;
    deductions.push({
      reason: `${outliers.length} outlier colors (may be accidental)`,
      points: deduction,
    });
    issues.push(`${outliers.length} outlier colors detected (may be accidental)`);
  } else if (outliers.length > 5) {
    const deduction = 1.0;
    score -= deduction;
    deductions.push({ reason: `${outliers.length} outlier colors`, points: deduction });
  }

  // 5. Check contrast failures - deduplicate by exact location
  const seenFailures = new Set<string>();
  const contrastFailures = colorData.contrastPairs.filter(pair => {
    if (pair.passes) return false;

    // Create unique key for this specific element instance
    const key = pair.page + '|' + pair.section + '|' + pair.block + '|' + pair.location;

    if (seenFailures.has(key)) {
      return false;
    }
    seenFailures.add(key);
    return true;
  });

  if (contrastFailures.length > 5) {
    const deduction = 1.5;
    score -= deduction;
    deductions.push({
      reason: `${contrastFailures.length} WCAG contrast failures`,
      points: deduction,
    });
    issues.push(`${contrastFailures.length} accessibility contrast failures (WCAG)`);
  } else if (contrastFailures.length > 2) {
    const deduction = 0.5;
    score -= deduction;
    deductions.push({
      reason: `${contrastFailures.length} WCAG contrast issues`,
      points: deduction,
    });
    warnings.push(`${contrastFailures.length} accessibility contrast issues`);
  }

  // Ensure score is between 0 and 10
  score = Math.max(0, Math.min(10, score));

  return {
    score: Math.round(score * 10) / 10,
    totalColors,
    colorGroups,
    grays,
    outliers,
    contrastFailures,
    issues,
    warnings,
    deductions,
  };
}

/**
 * Group similar colors using RGB distance
 */
export function groupSimilarColors(colors: Record<string, ColorData>): ColorGroup[] {
  const allColors = Object.keys(colors);
  const groups: ColorGroup[] = [];
  const processed = new Set<string>();

  // Similarity threshold (15% of max RGB distance)
  const threshold = 441 * 0.15; // sqrt(255^2 + 255^2 + 255^2) * 0.15

  allColors.forEach(color1 => {
    if (processed.has(color1)) return;

    const group: ColorGroup = {
      mainColor: color1,
      mainCount: colors[color1].count,
      variations: [color1],
      totalInstances: colors[color1].count,
    };

    allColors.forEach(color2 => {
      if (color1 === color2 || processed.has(color2)) return;

      const distance = calculateColorDistance(color1, color2);
      if (distance < threshold) {
        group.variations.push(color2);
        group.totalInstances += colors[color2].count;
        processed.add(color2);

        // Update main color to most frequently used
        if (colors[color2].count > group.mainCount) {
          group.mainColor = color2;
          group.mainCount = colors[color2].count;
        }
      }
    });

    processed.add(color1);

    // Only add groups with multiple variations
    if (group.variations.length > 1) {
      groups.push(group);
    }
  });

  return groups;
}

/**
 * Calculate Euclidean distance between two colors
 */
export function calculateColorDistance(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);

  if (!rgb1 || !rgb2) return Infinity;

  const rDiff = rgb1.r - rgb2.r;
  const gDiff = rgb1.g - rgb2.g;
  const bDiff = rgb1.b - rgb2.b;

  return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
}

/**
 * Convert hex to RGB
 */
export function hexToRgb(hex: string): RGB | null {
  hex = hex.replace('#', '');
  if (hex.length !== 6) return null;

  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

/**
 * Identify gray colors
 */
export function identifyGrays(colors: string[]): string[] {
  return colors.filter(color => {
    const rgb = hexToRgb(color);
    if (!rgb) return false;
    // Gray if R, G, B are within 15 of each other
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    return max - min < 15;
  });
}

/**
 * Reconstruct devToolsColorSummary if missing
 */
export function ensureDevToolsSummary(data: ReportData): void {
  const colors = data.colorData.colors;
  const allColors = Object.keys(colors);

  if (!data.devToolsColorSummary) {
    console.log('SSA: Reconstructing devToolsColorSummary for Style Guide...');
    data.devToolsColorSummary = {
      summary: { count: allColors.length, colors: allColors.sort() },
      background: { count: 0, colors: [] },
      text: { count: 0, colors: [] },
      fill: { count: 0, colors: [] },
      border: { count: 0, colors: [] },
    };

    for (const hex in colors) {
      const usedAs = colors[hex].usedAs || [];
      if (usedAs.includes('background')) {
        data.devToolsColorSummary.background.colors.push(hex);
        data.devToolsColorSummary.background.count++;
      }
      if (usedAs.includes('text')) {
        data.devToolsColorSummary.text.colors.push(hex);
        data.devToolsColorSummary.text.count++;
      }
      if (usedAs.includes('fill')) {
        data.devToolsColorSummary.fill.colors.push(hex);
        data.devToolsColorSummary.fill.count++;
      }
      if (usedAs.includes('border')) {
        data.devToolsColorSummary.border.colors.push(hex);
        data.devToolsColorSummary.border.count++;
      }
    }

    // Sort sub-categories
    data.devToolsColorSummary.background.colors.sort();
    data.devToolsColorSummary.text.colors.sort();
    data.devToolsColorSummary.fill.colors.sort();
    data.devToolsColorSummary.border.colors.sort();
  }
}
