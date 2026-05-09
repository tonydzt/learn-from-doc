import type { PageIndexRecord, SiteRecord, ProgressRecord } from '../storage/db';
import type { AppSettings } from '../settings/app-settings';

export type PageContextResponse = {
  supported: boolean;
  indexed: boolean;
  host?: string;
  scopeKey?: string;
  scopeTitle?: string;
  site?: SiteRecord;
  currentUrl?: string;
  totalPercent?: number;
  pagePercent?: number;
  pageCount?: number;
  currentPageIndexed?: boolean;
  currentPageContentHeight?: number;
  currentViewedHeight?: number;
  currentViewedRangeCount?: number;
};

export type IndexLinksResponse = {
  host: string;
  scopeKey: string;
  scopeTitle: string;
  links: Array<{ url: string; title: string }>;
};

export type IndexPageMeasuredMessage = {
  type: 'INDEX_PAGE_MEASURED';
  payload: {
    url: string;
    title: string;
    contentHeight: number;
  };
};

export type IndexDebugStatusMessage = {
  type: 'INDEX_DEBUG_STATUS';
  payload: {
    ok: boolean;
    message: string;
    details?: unknown;
  };
};

export type IndexRunProgressMessage = {
  type: 'INDEX_RUN_PROGRESS';
  payload: {
    phase: 'collecting' | 'measuring' | 'saving' | 'done';
    current: number;
    total: number;
    currentTitle?: string;
    currentUrl?: string;
    debug: boolean;
  };
};

export type IndexOverview = {
  site: SiteRecord;
  pageCount: number;
  totalContentHeight: number;
  totalViewedHeight: number;
  totalPercent: number;
  updatedAt: number;
};

export type RuntimeMessage =
  | { type: 'GET_PAGE_CONTEXT' }
  | { type: 'COLLECT_INDEX_LINKS' }
  | { type: 'START_INDEX'; tabId: number; debug?: boolean }
  | { type: 'GET_INDEX_OVERVIEWS' }
  | { type: 'GET_SITE_SNAPSHOT'; siteId: string }
  | { type: 'GET_SITE_RECORD'; siteId: string }
  | { type: 'GET_SITE_PAGES'; siteId: string }
  | { type: 'GET_PAGE_RECORD'; siteId: string; url: string }
  | { type: 'GET_SITE_PROGRESS'; siteId: string }
  | { type: 'GET_PROGRESS_RECORD'; siteId: string; url: string }
  | { type: 'SAVE_PROGRESS_RECORD'; siteId: string; url: string; ranges: import('../progress/ranges').ViewedRange[]; contentHeight: number }
  | { type: 'DELETE_SITE_INDEX'; siteId: string }
  | { type: 'CLEAR_SITE_PROGRESS'; siteId: string }
  | { type: 'CLEAR_ALL_PROGRESS' }
  | { type: 'GET_APP_SETTINGS' }
  | { type: 'SAVE_APP_SETTINGS'; settings: Partial<AppSettings> }
  | { type: 'INDEX_PROGRESS_UPDATED'; siteId: string }
  | IndexDebugStatusMessage
  | IndexRunProgressMessage
  | IndexPageMeasuredMessage;

export type StartIndexResult = {
  ok: true;
  site: SiteRecord;
  pages: PageIndexRecord[];
} | {
  ok: false;
  error: string;
};

export type SiteSnapshot = {
  site: SiteRecord;
  pages: PageIndexRecord[];
  progress: ProgressRecord[];
};
