export function extractFontSize(styleDefinition: string | null): number | null {
  if (!styleDefinition) return null;
  const match = styleDefinition.match(/font-size:\s*([0-9.]+)px/);
  return match ? parseFloat(match[1]) : null;
}

function getMostCommonSize(data: any, headingType: string): number | null {
  if (!data.headings[headingType] || !data.headings[headingType].locations) return null;

  const sizeCounts: Record<number, number> = {};
  let maxCount = 0;
  let mostCommonSize: number | null = null;

  for (const location of data.headings[headingType].locations) {
    const fontSize = extractFontSize(location.styleDefinition);
    if (fontSize) {
      sizeCounts[fontSize] = (sizeCounts[fontSize] || 0) + 1;
      if (sizeCounts[fontSize] > maxCount) {
        maxCount = sizeCounts[fontSize];
        mostCommonSize = fontSize;
      }
    }
  }

  return mostCommonSize;
}

function calculateHierarchicalSizeIssues(data: any): void {
  const headingComparisons = [
    {
      higher: 'heading-1',
      lower: 'heading-2',
      higherLabel: 'H1',
      lowerLabel: 'H2',
    },
    {
      higher: 'heading-2',
      lower: 'heading-3',
      higherLabel: 'H2',
      lowerLabel: 'H3',
    },
    {
      higher: 'heading-3',
      lower: 'heading-4',
      higherLabel: 'H3',
      lowerLabel: 'H4',
    },
  ];

  for (const comparison of headingComparisons) {
    const higherSize = getMostCommonSize(data, comparison.higher);
    const lowerSize = getMostCommonSize(data, comparison.lower);

    if (higherSize && lowerSize) {
      if (lowerSize > higherSize) {
        const issueText =
          comparison.lowerLabel +
          ' headings (' +
          lowerSize +
          'px most common) are larger than ' +
          comparison.higherLabel +
          ' headings (' +
          higherSize +
          'px most common)';

        if (!data.qualityChecks) data.qualityChecks = {};
        if (!data.qualityChecks.fontSizeInconsistency)
          data.qualityChecks.fontSizeInconsistency = [];

        // Check if this issue already exists to avoid duplicates
        const exists = data.qualityChecks.fontSizeInconsistency.some(
          (item: any) =>
            item.issue === issueText ||
            (item.higherLevel === comparison.higherLabel &&
              item.lowerLevel === comparison.lowerLabel)
        );

        if (!exists) {
          data.qualityChecks.fontSizeInconsistency.push({
            url: data.metadata?.url || '',
            page: 'All Pages',
            issue: issueText,
            description:
              comparison.higherLabel +
              ' should be larger than ' +
              comparison.lowerLabel +
              '. Currently ' +
              comparison.higherLabel +
              ' is ' +
              higherSize +
              'px but ' +
              comparison.lowerLabel +
              ' is ' +
              lowerSize +
              'px.',
            higherLevel: comparison.higherLabel,
            higherSize: higherSize,
            lowerLevel: comparison.lowerLabel,
            lowerSize: lowerSize,
          });
        }
      }
    }
  }
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCSV(
  accumulatedResults: any,
  filenameBrand: string,
  showSuccess: (msg: string) => void,
  showError: (msg: string) => void
): void {
  if (!accumulatedResults) {
    // Assuming alert is available or should be handled by caller, but keeping alert for now as per original
    alert('No data to export. Please analyze a page first.');
    return;
  }

  // Calculate hierarchical font size issues before exporting
  calculateHierarchicalSizeIssues(accumulatedResults);

  const domain = accumulatedResults.metadata.domain.replace(/^www\./, '');

  let csv = 'URL,Navigation Name,Type,Category,Text,Style Definition,Page Title,Section,Block\n';

  let rows: any[] = [];

  // Add failed pages at the top if they exist
  if (accumulatedResults.failedPages && accumulatedResults.failedPages.length > 0) {
    for (const failedPage of accumulatedResults.failedPages) {
      const failedText = `This page failed to load during our analysis. This can occur due to differences in how pages load during automated analysis versus in a browser. After reviewing your reports, you can retry each failed page individually using the 'Analyze This Page' button.`;
      rows.push({
        url: failedPage.url || '',
        navigationName: failedPage.url ? new URL(failedPage.url).pathname : '',
        type: 'Failed Page',
        category: 'Timeout',
        text: failedText,
        styleDefinition: '',
        pageTitle: '',
        section: '',
        block: '',
      });
    }
  }

  for (const [headingType, data] of Object.entries(accumulatedResults.headings) as [
    string,
    any,
  ][]) {
    for (const loc of data.locations) {
      rows.push({
        url: loc.url || '',
        navigationName: loc.navigationName || '',
        type: 'Heading',
        category: headingType,
        text: (loc.text || '').replace(/"/g, '""'),
        styleDefinition: (loc.styleDefinition || '').replace(/"/g, '""'),
        pageTitle: (loc.pageTitle || '').replace(/"/g, '""'),
        section: loc.section || '',
        block: loc.block || '',
      });
    }
  }

  for (const [paragraphType, data] of Object.entries(accumulatedResults.paragraphs) as [
    string,
    any,
  ][]) {
    for (const loc of data.locations) {
      rows.push({
        url: loc.url || '',
        navigationName: loc.navigationName || '',
        type: 'Paragraph',
        category: paragraphType,
        text: (loc.text || '').replace(/"/g, '""'),
        styleDefinition: (loc.styleDefinition || '').replace(/"/g, '""'),
        pageTitle: (loc.pageTitle || '').replace(/"/g, '""'),
        section: loc.section || '',
        block: loc.block || '',
      });
    }
  }

  for (const [buttonType, data] of Object.entries(accumulatedResults.buttons) as [string, any][]) {
    for (const loc of data.locations) {
      rows.push({
        url: loc.url || '',
        navigationName: loc.navigationName || '',
        type: 'Button',
        category: buttonType,
        text: (loc.text || '').replace(/"/g, '""'),
        styleDefinition: (loc.styleDefinition || '').replace(/"/g, '""'),
        pageTitle: (loc.pageTitle || '').replace(/"/g, '""'),
        section: loc.section || '',
        block: loc.block || '',
      });
    }
  }

  // Add quality check errors
  if (accumulatedResults.qualityChecks) {
    for (const [checkType, issues] of Object.entries(accumulatedResults.qualityChecks) as [
      string,
      any[],
    ][]) {
      for (const issue of issues) {
        let errorDescription = '';

        let category = checkType;

        if (checkType === 'missingH1') {
          errorDescription = 'Missing H1 heading. See Website Analysis report for details.';
        } else if (checkType === 'multipleH1') {
          errorDescription = `Multiple H1 headings (${
            issue.count || 'unknown'
          } found). See Website Analysis report for details.`;
        } else if (checkType === 'brokenHeadingHierarchy') {
          category = 'broken Heading Hierarchy';
          errorDescription =
            (issue.issue || 'Broken heading hierarchy') +
            '. See Website Analysis report for details.';
        } else if (checkType === 'fontSizeInconsistency') {
          errorDescription =
            (issue.issue || issue.description || 'Font size inconsistency') +
            '. See Website Analysis report for details.';
        } else if (checkType === 'missingAltText') {
          category = 'missing Alt Text on image';
          errorDescription =
            'See downloaded Images Analysis report in the Missing Alt Text section for image links.';
        } else if (checkType === 'genericImageNames') {
          category = 'generic Image Names';
          errorDescription =
            'See downloaded Images Analysis report in the Generic Image Filenames section for image links.';
        } else if (checkType === 'styleInconsistency') {
          errorDescription =
            (issue.issue || issue.description || 'Style inconsistency detected') +
            '. See Website Analysis report for details.';
        } else {
          // More descriptive fallback
          const typeName = checkType.replace(/([A-Z])/g, ' $1').trim();
          errorDescription =
            (issue.issue || issue.description || issue.text || typeName) +
            '. See Website Analysis report for details.';
        }

        rows.push({
          url: issue.url || '',
          navigationName: issue.page || '',
          type: 'Quality Check',
          category: category,
          text: errorDescription,
          styleDefinition: '',
          pageTitle: '',
          section: issue.section || '',
          block: issue.block || '',
        });
      }
    }
  }

  rows.sort((a, b) => a.url.localeCompare(b.url));

  for (const row of rows) {
    csv += `"${row.url}","${row.navigationName}","${row.type}","${row.category}","${row.text}","${row.styleDefinition}","${row.pageTitle}","${row.section}","${row.block}"\n`;
  }

  const filename = `${domain} ${filenameBrand} website analysis spreadsheet.csv`;
  downloadFile(csv, filename, 'text/csv');
  showSuccess('CSV exported successfully!');
}
