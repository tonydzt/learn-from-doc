import type { PageIndexRecord, SiteRecord, ProgressRecord } from '../storage/db';
import type { AppSettings } from '../settings/app-settings';

// RuntimeMessage 是扩展内部的消息契约，类似后端项目里的 API DTO。
// popup/options/content script 不能直接调用彼此的函数，只能通过这些 message type 通信。
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

export type IndexRunProgressMessage = {
  type: 'INDEX_RUN_PROGRESS';
  payload: {
    phase: 'collecting' | 'measuring' | 'saving' | 'done';
    current: number;
    total: number;
    currentTitle?: string;
    currentUrl?: string;
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
  | { type: 'COLLECT_INDEX_LINKS' }
  | { type: 'START_INDEX'; tabId: number }
  | { type: 'GET_INDEX_OVERVIEWS' }
  | { type: 'GET_SITE_SNAPSHOT'; siteId: string }
  | { type: 'GET_SITE_PAGES'; siteId: string }
  | { type: 'GET_PAGE_RECORD'; siteId: string; url: string }
  | { type: 'GET_SITE_PROGRESS'; siteId: string }
  | { type: 'SAVE_PROGRESS_RECORD'; siteId: string; url: string; ranges: import('../progress/ranges').ViewedRange[]; contentHeight: number }
  | { type: 'DELETE_SITE_INDEX'; siteId: string }
  | { type: 'CLEAR_SITE_PROGRESS'; siteId: string }
  | { type: 'CLEAR_ALL_PROGRESS' }
  | { type: 'GET_APP_SETTINGS' }
  | { type: 'SAVE_APP_SETTINGS'; settings: Partial<AppSettings> }
  | { type: 'INDEX_PROGRESS_UPDATED'; siteId: string }
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
