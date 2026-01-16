// types.ts - Type definitions for color report

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ColorGroup {
  mainColor: string;
  mainCount: number;
  variations: string[];
  totalInstances: number;
}

export interface ScoreDeduction {
  reason: string;
  points: number;
}

export interface ColorAnalysis {
  score: number;
  totalColors: number;
  colorGroups: ColorGroup[];
  grays: string[];
  outliers: string[];
  contrastFailures: ContrastFailure[];
  issues: string[];
  warnings: string[];
  deductions: ScoreDeduction[];
}

export interface ContrastFailure {
  textColor: string;
  backgroundColor: string;
  ratio: number;
  wcagLevel: string;
  passes: boolean;
  page: string;
  section: string;
  block: string;
  location: string;
  element: string;
  elementText?: string;
  selector?: string;
}

export interface DevToolsColorSummary {
  summary: { count: number; colors: string[] };
  background: { count: number; colors: string[] };
  text: { count: number; colors: string[] };
  fill: { count: number; colors: string[] };
  border: { count: number; colors: string[] };
}

export interface ColorInstance {
  page: string;
  pageTitle: string;
  section: string;
  block: string;
  context: string;
  selector?: string;
}

export interface ColorData {
  count: number;
  instances: ColorInstance[];
  usedAs?: string[];
}

export interface ReportData {
  metadata: {
    domain: string;
    url?: string;
  };
  colorData: {
    colors: Record<string, ColorData>;
    contrastPairs: ContrastFailure[];
  };
  devToolsColorSummary?: DevToolsColorSummary;
}
