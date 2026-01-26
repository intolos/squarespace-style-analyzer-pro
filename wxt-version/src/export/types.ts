import { ColorData } from '../analyzers/colors';

export interface AccumulatedResults {
  metadata: {
    domain: string;
    title?: string;
    description?: string;
    pathname?: string;
    pagesAnalyzed?: string[];
    url?: string;
  };
  siteStyles?: Record<string, { locations: any[] }>;
  colorPalette?: {
    all: string[];
    backgrounds: string[];
    text: string[];
    borders: string[];
  };
  images?: any[];
  mobileIssues?: {
    issues?: any[];
    viewportMeta?: {
      exists: boolean;
      content: string | null;
      isProper: boolean;
    };
  };
  colorData: ColorData;
  devToolsColorSummary?: {
    summary: { count: number; colors: string[] };
    background: { count: number; colors: string[] };
    text: { count: number; colors: string[] };
    fill: { count: number; colors: string[] };
    border: { count: number; colors: string[] };
  };
  themeStyles?: {
    colors?: {
      styleDefinition?: string;
    };
  };
  squarespaceThemeStyles?: {
    miscFont?: string;
    miscFontStyle?: string;
    headingStyles?: Record<string, string>;
    paragraphStyles?: Record<string, string>;
  };
  headings: Record<string, { locations: Array<{ styleDefinition?: string }> }>;
  paragraphs: Record<string, { locations: Array<{ styleDefinition?: string }> }>;
  buttons: Record<string, { locations: Array<{ text?: string; styleDefinition?: string }> }>;
  qualityChecks?: {
    missingAltText?: any[];
    genericImageNames?: any[];
    missingH1?: Array<{ url: string; page: string }>;
    multipleH1?: Array<{ url: string; page: string; count: number }>;
    brokenHeadingHierarchy?: any[];
    fontSizeInconsistency?: any[];
    styleInconsistency?: any[];
    [key: string]: any[] | undefined;
  };
  domainAnalysis?: boolean;
  failedPages?: {
    url: string;
    reason: string;
    timeout?: number;
    timestamp?: string;
  }[];
  [key: string]: any; // Allow for other properties
}

export interface ReportLocation {
  url: string;
  path?: string;
  navigationName?: string;
  selector?: string;
  text?: string;
  styleDefinition?: string;
  section?: string;
  block?: string;
  fullUrl?: string; // Sometimes computed
}

export interface ReportTypeData {
  locations: ReportLocation[];
  displayName?: string;
}

export interface ReportData extends AccumulatedResults {
  links?: Record<string, ReportTypeData>;
  qualityChecks?: {
    missingAltText?: any[];
    genericImageNames?: any[];
    missingH1?: Array<{ url: string; page: string }>;
    multipleH1?: Array<{ url: string; page: string; count: number }>;
    brokenHeadingHierarchy?: any[];
    fontSizeInconsistency?: any[];
    styleInconsistency?: any[];
  };
  headings: Record<string, ReportTypeData>;
  paragraphs: Record<string, ReportTypeData>;
  buttons: Record<string, ReportTypeData>;
}
