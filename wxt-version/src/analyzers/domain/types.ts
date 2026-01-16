import { ReportData } from '../../export/types';

export interface DomainAnalysisOptions {
  maxPages?: number;
  delayBetweenPages?: number;
  isPremium?: boolean;
  useMobileViewport?: boolean;
  mobileOnly?: boolean;
  timeout?: number;
}

export interface DomainAnalysisProgress {
  current: number;
  total: number;
  totalInSitemap?: number;
  currentUrl: string;
  percent?: number;
}

export interface FailedPage {
  url: string;
  reason: string;
  timeout?: number;
  timestamp: string;
}

export interface DomainAnalysisStats {
  totalPages: number;
  successfulPages: number;
  failedPages: number;
  failedPagesList: FailedPage[];
  cancelledAt?: number;
}

export interface DomainAnalysisResult {
  success: boolean;
  cancelled?: boolean;
  data: ReportData | null;
  stats: DomainAnalysisStats;
}
