// analysis.ts - Color analysis logic

import type {
  ColorAnalysis,
  ColorGroup,
  RGB,
  ReportData,
  ColorData,
  DevToolsColorSummary,
} from './types';
import { calculateRedmeanDistance } from '../../utils/colorUtils';

/**
 * Analyze color consistency and generate score
 */
export function analyzeColorConsistency(data: ReportData): ColorAnalysis {
  // IMPORTANT: Refine color keys to ensure the "Master" color for each group
  // is the one with the highest usage count (Majority Rule), not just the first one found.
  refineColorKeys(data);

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

      // IMPORTANT: Use Redmean perceptual distance for consistency with
      // scan-time fuzzy matching. This threshold is broader than the 2.3 merge
      // threshold because this groups "Color Families" (intentional variations),
      // not browser rendering artifacts.
      const distance = calculateRedmeanDistance(color1, color2);
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
/**
 * Reconstruct devToolsColorSummary from colorData.
 * This ensures the summary matches the keys in colorData.colors, especially
 * after refineColorKeys has modified them (fuzzy matching consolidation).
 */
export function ensureDevToolsSummary(data: ReportData): void {
  const colors = data.colorData.colors;
  const allColors = Object.keys(colors);

  // Initialize empty summary
  const summary: DevToolsColorSummary = {
    summary: { count: 0, colors: [] },
    background: { count: 0, colors: [] },
    text: { count: 0, colors: [] },
    fill: { count: 0, colors: [] },
    border: { count: 0, colors: [] },
  };

  allColors.forEach(hex => {
    const colorData = colors[hex];

    // Add to 'summary' (all colors)
    summary.summary.colors.push(hex);

    // Add to specific categories based on 'usedAs'
    if (colorData.usedAs) {
      if (colorData.usedAs.includes('background')) {
        summary.background.colors.push(hex);
      }
      if (colorData.usedAs.includes('text')) {
        summary.text.colors.push(hex);
      }
      if (colorData.usedAs.includes('fill') || colorData.usedAs.includes('stroke')) {
        summary.fill.colors.push(hex);
      }
      if (colorData.usedAs.includes('border')) {
        summary.border.colors.push(hex);
      }
    }
  });

  // Update counts
  summary.summary.count = summary.summary.colors.length;
  summary.background.count = summary.background.colors.length;
  summary.text.count = summary.text.colors.length;
  summary.fill.count = summary.fill.colors.length;
  summary.border.count = summary.border.colors.length;

  // Overwrite existing summary
  data.devToolsColorSummary = summary;
}

/**
 * Refine color keys based on Majority Rule and Semantic Tie-Breakers.
 * Ensures the "Master" color for a fuzzy-matched group is the most representative one.
 */
function refineColorKeys(data: ReportData): void {
  const colorData = data.colorData;
  const colors = colorData.colors;
  const currentKeys = Object.keys(colors);

  currentKeys.forEach(currentKey => {
    const entry = colors[currentKey];
    if (!entry.instances || entry.instances.length === 0) return;

    // 1. Count occurrences of each original hex
    const hexCounts: Record<string, { count: number; bestScore: number }> = {};

    // Initialize with current key (for instances that might lack originalHex)
    hexCounts[currentKey] = { count: 0, bestScore: 0 };

    entry.instances.forEach(inst => {
      const hex = inst.originalHex || currentKey;
      if (!hexCounts[hex]) {
        hexCounts[hex] = { count: 0, bestScore: 0 };
      }
      hexCounts[hex].count++;

      const score = getElementScore(inst.element);
      if (score > hexCounts[hex].bestScore) {
        hexCounts[hex].bestScore = score;
      }
    });

    // 2. Find the best hex
    let bestHex = currentKey;
    let maxCount = -1;
    let maxScore = -1;

    Object.keys(hexCounts).forEach(hex => {
      const { count, bestScore } = hexCounts[hex];

      if (count > maxCount) {
        maxCount = count;
        maxScore = bestScore;
        bestHex = hex;
      } else if (count === maxCount) {
        // Tie-breaker: Semantic Importance
        if (bestScore > maxScore) {
          maxScore = bestScore;
          bestHex = hex;
        }
      }
    });

    // 3. Swap key if needed
    if (bestHex !== currentKey) {
      // Create new entry
      colors[bestHex] = entry; // Move reference

      // Update mergedColors set
      if (!colors[bestHex].mergedColors) {
        colors[bestHex].mergedColors = [];
      }

      // Add the old key to merged set/array
      if (colors[bestHex].mergedColors instanceof Set) {
        (colors[bestHex].mergedColors as Set<string>).add(currentKey);
        (colors[bestHex].mergedColors as Set<string>).delete(bestHex);
      } else if (Array.isArray(colors[bestHex].mergedColors)) {
        const set = new Set(colors[bestHex].mergedColors as string[]);
        set.add(currentKey);
        set.delete(bestHex);
        colors[bestHex].mergedColors = Array.from(set);
      } else {
        // Was likely serialized as an empty object {}
        colors[bestHex].mergedColors = [currentKey];
      }

      // Delete old entry
      delete colors[currentKey];

      // Note: We don't need to update allColors/backgroundColors sets here because
      // ReportData does not store them. They are reconstructed later by
      // ensureDevToolsSummary() based on the keys in 'colors'.
    }
  });
}

/**
 * Get semantic score for an element tag (Tie-Breaker Logic)
 */
function getElementScore(tagName: string): number {
  if (!tagName) return 1;
  const tag = tagName.toUpperCase();

  // Headings: Highest priority (likely brand colors)
  if (/^H[1-6]$/.test(tag)) return 100;

  // Interactive: High priority
  if (tag === 'BUTTON' || tag === 'A') return 50;

  // Content: Medium priority
  if (tag === 'P' || tag === 'SPAN' || tag === 'STRONG' || tag === 'EM') return 20;

  // Containers/Structure: Low priority
  return 1;
}
