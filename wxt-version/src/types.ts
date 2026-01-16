import { ColorData } from './analyzers/colors';

export interface Location {
  page: string;
  pageTitle: string;
  location: string; // selector
  selector: string;
  elementText: string;
  section: string;
  block: string;
  styleDefinition?: string;
  element?: string; // HTML string
  elementScreenshot?: string;
  elementContext?: string;
}

export interface TypeCategory {
  styleDefinition?: string;
  locations: Location[];
  displayName?: string;
}

export interface ThemeStyles {
  typography: { styleDefinition: string; locations: Location[] };
  colors: { styleDefinition: string; locations: Location[] };
  spacing: { styleDefinition: string; locations: Location[] };
  buttons: { styleDefinition: string; locations: Location[] };
}

export interface ButtonCategory extends TypeCategory {
  // Buttons might have specific extras
}

export interface Buttons {
  primary: ButtonCategory;
  secondary: ButtonCategory;
  tertiary: ButtonCategory;
  other: ButtonCategory;
  [key: string]: ButtonCategory;
}

export interface Links {
  'in-content': TypeCategory;
}

export interface ColorPalette {
  backgrounds: string[];
  text: string[];
  borders: string[];
  all: string[];
}

export interface Headings {
  'heading-1': TypeCategory;
  'heading-2': TypeCategory;
  'heading-3': TypeCategory;
  'heading-4': TypeCategory;
  'heading-5': TypeCategory;
  'heading-6': TypeCategory;
  [key: string]: TypeCategory;
}

export interface Paragraphs {
  'paragraph-1': TypeCategory;
  'paragraph-2': TypeCategory;
  'paragraph-3': TypeCategory;
  'paragraph-4': TypeCategory;
  [key: string]: TypeCategory;
}

export interface QualityChecks {
  missingH1: any[];
  multipleH1: any[];
  brokenHeadingHierarchy: any[];
  fontSizeInconsistency: any[];
  missingAltText: any[];
  genericImageNames: any[];
  styleInconsistency?: any[];
}

export interface MobileIssues {
  viewportMeta: { exists: boolean; content: string | null; isProper: boolean };
  issues: any[];
}

export interface AnalysisMetadata {
  url: string;
  domain: string;
  title: string;
  pathname: string;
  timestamp: string;
}

export interface SquarespaceThemeStyles {
  // Define loosely based on what's captured
  [key: string]: any;
}

export interface AnalysisResult {
  themeStyles: ThemeStyles;
  siteStyles: Record<string, any>;
  buttons: Buttons;
  links: Links;
  images: any[];
  colorPalette: ColorPalette;
  colorData: ColorData;
  headings: Headings;
  paragraphs: Paragraphs;
  qualityChecks: QualityChecks;
  mobileIssues: MobileIssues;
  metadata: AnalysisMetadata;
  squarespaceThemeStyles?: SquarespaceThemeStyles;
  devToolsColorSummary?: any;
}
