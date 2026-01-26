// export/qualityChecks.ts
// Quality Checks Calculation Logic for HTML Reports

import type { ReportData } from './types';
import { StyleComparisonUtils } from '../utils/styleComparisonUtils';
import { analyzeColorConsistency } from './styleGuideColorsReport/analysis';
import { exportMobileReport, MOBILE_CHECK_TYPES, formatIssueDescription } from './mobileReport'; // For formatIssueDescription if needed, or I'll duplicate/move the helper

// Helper to extract font size
function extractFontSize(styleDefinition: string | undefined): number | null {
  if (!styleDefinition) return null;
  const match = styleDefinition.match(/font-size:\s*([0-9.]+)px/);
  return match ? parseFloat(match[1]) : null;
}

// Get most common font size
function getMostCommonSize(data: ReportData, headingType: string): string | null {
  if (!data.headings[headingType] || !data.headings[headingType].locations) return null;

  const sizeCounts: Record<string, number> = {};
  let maxCount = 0;
  let mostCommonSize: string | null = null;

  for (const location of data.headings[headingType].locations) {
    const fontSize = extractFontSize(location.styleDefinition);
    if (fontSize) {
      const sizeStr = fontSize.toString();
      sizeCounts[sizeStr] = (sizeCounts[sizeStr] || 0) + 1;
      if (sizeCounts[sizeStr] > maxCount) {
        maxCount = sizeCounts[sizeStr];
        mostCommonSize = sizeStr;
      }
    }
  }

  return mostCommonSize;
}

// Check if mobile analysis was actually performed
function hasMobileAnalysisData(data: ReportData): boolean {
  if (!data) return false;

  const mobileIssues = data.mobileIssues;
  if (!mobileIssues) return false;

  // Check if there are any mobile issues
  const issues = mobileIssues.issues || [];
  if (issues.length > 0) return true;

  // Check if viewport meta was actually analyzed
  const viewportMeta = (mobileIssues as any).viewportMeta;
  if (viewportMeta && viewportMeta.content !== null && viewportMeta.content !== undefined) {
    return true;
  }

  // If viewport exists but was never analyzed, mobile analysis was still performed
  if (viewportMeta && (viewportMeta.exists === true || viewportMeta.isProper === true)) {
    return true;
  }

  return false;
}

// Helper to check if image source is likely an icon
function isLikelyIconSrc(src: string): boolean {
  if (!src) return false;

  // Extract filename without query params
  const cleanUrl = src.split('?')[0].split('#')[0];
  const urlParts = cleanUrl.split('/');
  const filename = urlParts[urlParts.length - 1];

  // Check if "icon" appears in filename
  if (filename.toLowerCase().includes('icon')) {
    return true;
  }

  // Check if path contains /icons/
  const lowerPath = src.toLowerCase();
  if (
    lowerPath.includes('/icons/') ||
    lowerPath.includes('/assets/icons/') ||
    lowerPath.includes('/images/icons/') ||
    lowerPath.includes('/img/icons/')
  ) {
    return true;
  }

  return false;
}

export interface QualityCheckResult {
  score: number;
  checks: Array<{
    passed: boolean;
    message: string;
    details: any[];
  }>;
}

export function calculateQualityChecks(
  data: ReportData,
  filenameBrand: string,
  exportQualityCheckReportFn: (
    data: ReportData,
    type: string,
    issues: any[],
    domain: string,
    brand: string
  ) => void
): QualityCheckResult {
  const checks: QualityCheckResult['checks'] = [];
  let passedCount = 0;
  let totalChecks = 9;

  const domain = data.metadata.domain.replace(/^www\./, '');

  // Check 1: Missing H1
  const missingH1 = data.qualityChecks?.missingH1 || [];
  const allHaveH1 = missingH1.length === 0;

  checks.push({
    passed: allHaveH1,
    message: allHaveH1
      ? 'All pages have H1 headings'
      : `${missingH1.length} page(s) missing H1 headings. <a href="#reports-nav" style="color: #667eea;">See the Styles Shown on Each Page report below.</a>`,
    details: allHaveH1
      ? []
      : missingH1.slice(0, 5).map(item => ({
          url: item.url,
          page: item.page,
          description: 'Missing H1 heading',
        })),
  });
  if (allHaveH1) passedCount++;

  // Check 2: Multiple H1
  const multipleH1 = data.qualityChecks?.multipleH1 || [];
  const noMultipleH1 = multipleH1.length === 0;

  checks.push({
    passed: noMultipleH1,
    message: noMultipleH1
      ? 'No pages have multiple H1 headings'
      : `${multipleH1.length} page(s) have multiple H1 headings. <a href="#reports-nav" style="color: #667eea;">See the Styles Shown on Each Page report below.</a>`,
    details: noMultipleH1
      ? []
      : multipleH1.slice(0, 5).map(item => ({
          url: item.url,
          page: item.page,
          description: `Multiple H1 headings (${item.count} found)`,
        })),
  });
  if (noMultipleH1) passedCount++;

  // Check 3: Broken Heading Hierarchy
  const brokenHierarchy = data.qualityChecks?.brokenHeadingHierarchy || [];
  const hierarchyCorrect = brokenHierarchy.length === 0;

  if (brokenHierarchy.length > 5) {
    setTimeout(() => {
      exportQualityCheckReportFn(
        data,
        'brokenHeadingHierarchy',
        brokenHierarchy,
        domain,
        filenameBrand
      );
    }, 1000);
    checks.push({
      passed: false,
      message: `${brokenHierarchy.length} heading hierarchy issue(s) found. See downloaded Heading Hierarchy report.`,
      details: [],
    });
  } else {
    checks.push({
      passed: hierarchyCorrect,
      message: hierarchyCorrect
        ? 'Heading hierarchy is correct on all pages'
        : `${brokenHierarchy.length} heading hierarchy issue(s) found`,
      details: hierarchyCorrect
        ? []
        : brokenHierarchy.map(item => ({
            url: item.url,
            page: item.page,
            description: item.description || item.issue || 'Broken heading hierarchy',
          })),
    });
  }
  if (hierarchyCorrect) passedCount++;

  // Check 4: Typography Style Inconsistency
  if (!data.qualityChecks) data.qualityChecks = {};
  data.qualityChecks.styleInconsistency = [];

  const checkStyleVariations = (dataObj: Record<string, any>, categoryName: string) => {
    for (const itemType in dataObj) {
      if (!dataObj[itemType] || !dataObj[itemType].locations) continue;

      const locations = dataObj[itemType].locations;
      if (locations.length === 0) continue;

      const variationCount = StyleComparisonUtils.getVariationCount(locations);

      if (variationCount >= 2) {
        let label;
        if (categoryName === 'Button') {
          label = itemType.charAt(0).toUpperCase() + itemType.slice(1) + ' Button';
        } else {
          label = itemType.replace('heading-', 'H').replace('paragraph-', 'P').toUpperCase();
        }

        const issueText = `${label} has ${variationCount} style variations (${locations.length} total instances)`;
        const description = `${label} uses ${variationCount} different styles. <a href="#reports-nav" style="color: #667eea;">See Aggregated Styles Report below.</a>`;

        data.qualityChecks!.styleInconsistency!.push({
          url: '',
          page: 'All Pages',
          issue: issueText,
          description: description,
          elementType: itemType,
          variationCount: variationCount,
          totalInstances: locations.length,
        });
      }
    }
  };

  checkStyleVariations(data.headings, 'Heading');
  checkStyleVariations(data.paragraphs, 'Paragraph');
  checkStyleVariations(data.buttons, 'Button');

  // Check hierarchical issues
  const headingComparisons = [
    { higher: 'heading-1', lower: 'heading-2', higherLabel: 'H1', lowerLabel: 'H2' },
    { higher: 'heading-2', lower: 'heading-3', higherLabel: 'H2', lowerLabel: 'H3' },
    { higher: 'heading-3', lower: 'heading-4', higherLabel: 'H3', lowerLabel: 'H4' },
    { higher: 'heading-4', lower: 'heading-5', higherLabel: 'H4', lowerLabel: 'H5' },
    { higher: 'heading-5', lower: 'heading-6', higherLabel: 'H5', lowerLabel: 'H6' },
  ];

  for (const comparison of headingComparisons) {
    const higherSize = getMostCommonSize(data, comparison.higher);
    const lowerSize = getMostCommonSize(data, comparison.lower);

    if (higherSize && lowerSize) {
      const higherSizeNum = parseFloat(higherSize);
      const lowerSizeNum = parseFloat(lowerSize);

      if (lowerSizeNum > higherSizeNum) {
        const issueText = `${comparison.lowerLabel} (${lowerSize}px) is larger than ${comparison.higherLabel} (${higherSize}px)`;
        const description = `${comparison.higherLabel} should be larger than ${comparison.lowerLabel}. Heading sizes should decrease as level increases.`;

        data.qualityChecks!.styleInconsistency!.push({
          url: '',
          page: 'All Pages',
          issue: issueText,
          description: description,
          higherLevel: comparison.higherLabel,
          higherSize: higherSize,
          lowerLevel: comparison.lowerLabel,
          lowerSize: lowerSize,
        });
      }
    }
  }

  const allStyleInconsistencies = data.qualityChecks.styleInconsistency!;
  const allStylesConsistent = allStyleInconsistencies.length === 0;

  const displayedInconsistencies = allStyleInconsistencies.slice(0, 5);
  const remainingCount = allStyleInconsistencies.length - 5;

  let details = displayedInconsistencies.map(item => ({
    url: item.url,
    page: item.page,
    description: item.description || item.issue,
  }));

  if (remainingCount > 0) {
    details.push({
      url: '',
      page: '',
      description: `...and ${remainingCount} more. <a href="#reports-nav" style="color: #667eea;">See Aggregated Styles Report below.</a>`,
    });
  }

  checks.push({
    passed: allStylesConsistent,
    message: allStylesConsistent
      ? 'Typography Styles are consistent across all headings, paragraphs, and buttons'
      : `Typography Style Inconsistencies in ${allStyleInconsistencies.length} element type(s)`,
    details: allStylesConsistent ? [] : details,
  });

  if (allStylesConsistent) passedCount++;

  // Check 5: Link Styling Consistency
  const linkLocations =
    data.links && data.links['in-content'] && data.links['in-content'].locations
      ? data.links['in-content'].locations
      : [];

  let linkStylesConsistent = true;
  let linkVariationCount = 0;
  let linkInconsistencyDetails: any[] = [];

  if (linkLocations.length > 0) {
    linkVariationCount = StyleComparisonUtils.getVariationCount(linkLocations);
    linkStylesConsistent = linkVariationCount <= 1;

    if (!linkStylesConsistent) {
      linkInconsistencyDetails.push({
        url: '',
        page: 'All Pages',
        description: `Links use ${linkVariationCount} different styles (${linkLocations.length} total instances). <a href="#reports-nav" style="color: #667eea;">See the Aggregated Styles Report below.</a>`,
      });
    }
  }

  checks.push({
    passed: linkStylesConsistent,
    message:
      linkLocations.length === 0
        ? 'No in-content links found to analyze'
        : linkStylesConsistent
          ? 'Link styling is consistent across all pages'
          : `Link styling inconsistencies found (${linkVariationCount} variations)`,
    details: linkInconsistencyDetails,
  });

  if (linkStylesConsistent) passedCount++;

  // Check 6: Missing Alt Text
  const images = (data as any).images || [];
  const imagesWithoutAlt = images.filter(
    (img: any) =>
      (!img.alt || img.alt === '(missing alt text)') &&
      img.src &&
      img.src.trim() !== '' &&
      !isLikelyIconSrc(img.src)
  );
  const allHaveAlt = imagesWithoutAlt.length === 0;

  const genericImageNames = data.qualityChecks?.genericImageNames || [];
  if (imagesWithoutAlt.length > 5 || genericImageNames.length > 5) {
    checks.push({
      passed: false,
      message: `${imagesWithoutAlt.length} image(s) missing alt text. See downloaded Images Analysis report.`,
      details: [],
    });
  } else {
    checks.push({
      passed: allHaveAlt,
      message: allHaveAlt
        ? 'All images have alt text'
        : `${imagesWithoutAlt.length} image(s) missing alt text`,
      details: allHaveAlt
        ? []
        : imagesWithoutAlt.map((img: any) => ({
            url: img.url || '',
            page: img.navigationName || 'Unknown',
            description: `Image missing alt text: <a href="${img.src}" target="_blank" style="color: #667eea; text-decoration: underline;">${img.src || 'Unknown source'}</a>`,
          })),
    });
  }
  if (allHaveAlt) passedCount++;

  // Check 7: Generic Image File Names
  const allDescriptiveNames = genericImageNames.length === 0;

  if (genericImageNames.length > 5) {
    checks.push({
      passed: false,
      message: `${genericImageNames.length} image(s) have generic file names. See downloaded Images Analysis report.`,
      details: [],
    });
  } else {
    checks.push({
      passed: allDescriptiveNames,
      message: allDescriptiveNames
        ? 'All images have descriptive file names'
        : `${genericImageNames.length} image(s) have generic file names`,
      details: allDescriptiveNames
        ? []
        : genericImageNames.map((img: any) => ({
            url: img.url,
            page: img.navigationName || 'Unknown',
            description: `${img.filename} (${img.pattern})`,
          })),
    });
  }
  if (allDescriptiveNames) passedCount++;

  // Check 8: Color Consistency
  // We need to cast data to any because analyzeColorConsistency expects a specific structure but uses 'any' mostly
  if (data.colorData && data.colorData.colors) {
    const analysis = analyzeColorConsistency(data as any);
    const colorScore = analysis.score;

    if (colorScore < 7) {
      checks.push({
        passed: false,
        message: `Color consistency: ${colorScore}/10 - ${analysis.issues.length + analysis.warnings.length} issue(s). See downloaded Brand Style Guide Colors report.`,
        details: analysis.issues.concat(analysis.warnings).map((issue: string) => ({
          url: data.metadata.domain || '',
          page: 'All Pages',
          description: issue,
        })),
      });
    } else {
      checks.push({
        passed: true,
        message: `Color Consistency Score: ${colorScore}/10. See Brand Style Guide Colors report for details.<br />Also, includes Quality Check for Accessibility for color contrast between text and background colors.`,
        details: [],
      });
      passedCount++;
    }
  } else {
    checks.push({
      passed: true,
      message: 'Color analysis data not available',
      details: [],
    });
    passedCount++;
  }

  // Check 9: Mobile Usability
  const mobileAnalysisPerformed = hasMobileAnalysisData(data);

  if (!mobileAnalysisPerformed) {
    totalChecks = 8;
    checks.push({
      passed: true,
      message: 'Mobile Usability was not analyzed',
      details: [],
    });
  } else {
    const mobileIssues = data.mobileIssues?.issues || [];
    const mobileErrors = mobileIssues.filter((issue: any) => issue.severity === 'error');
    const mobileWarnings = mobileIssues.filter((issue: any) => issue.severity === 'warning');
    const hasMobileIssues = mobileErrors.length > 0;

    const displayedIssues = mobileIssues.slice(0, 5);
    const hasMoreIssues = mobileIssues.length > 5;

    // Aggregate issues by type using the master list
    const issueCountsByType: Record<string, number> = {};
    for (const issue of mobileIssues) {
      const type = issue.type;
      issueCountsByType[type] = (issueCountsByType[type] || 0) + 1;
    }

    const details: any[] = [];
    let distinctTypesFound = 0;

    // Iterate through master list to ensure correct order and labeling
    for (const checkType of MOBILE_CHECK_TYPES) {
      const count = issueCountsByType[checkType.type];
      if (count > 0) {
        if (distinctTypesFound < 5) {
          details.push({
            url: '',
            page: 'All Pages',
            description: `${checkType.label} (${count})`, // e.g. "Touch Targets Too Small (3)"
          });
        }
        distinctTypesFound++;
      }
    }

    if (distinctTypesFound > 5) {
      details.push({
        url: '',
        page: '',
        description: `...and ${distinctTypesFound - 5} more issue types.`,
      });
    }

    if (mobileIssues.length > 0) {
      details.push({
        url: '',
        page: '',
        description: '<em>See Mobile Usability report for details.</em>',
      });
    }

    checks.push({
      passed: !hasMobileIssues,
      message:
        mobileIssues.length === 0
          ? 'Mobile Usability checks passed - no issues detected'
          : hasMobileIssues
            ? `Mobile Usability issues found (${mobileErrors.length} errors, ${mobileWarnings.length} warnings)`
            : `Mobile Usability warnings found (${mobileWarnings.length})`,
      details: details,
    });

    if (!hasMobileIssues) passedCount++;
  }

  const score = Math.round((passedCount / totalChecks) * 100);

  return { score, checks };
}
