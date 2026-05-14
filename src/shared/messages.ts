import type { PageIndexRecord, SiteRecord, ProgressRecord } from '../storage/db';
import type { AppSettings } from '../settings/app-settings';
import type { SiteSettings } from '../settings/site-settings';
import type { PortableData, PortableImportPreview, PortableSerializedData } from '../storage/portable-data';

// RuntimeMessage 是扩展内部的消息契约，类似后端项目里的 API DTO。
// popup/options/content script 不能直接调用彼此的函数，只能通过这些 message type 通信。
export type IndexLinksResponse = {
  host: string;
  scopeKey: string;
  scopeTitle: string;
  links: Array<{ url: string; title: string }>;
};

export type PageAdapterContext = {
  supported: boolean;
  host?: string;
  scopeKey?: string;
  scopeTitle?: string;
  adapterId?: string;
  adapterKind?: 'site' | 'framework';
  frameworkName?: string;
  indexable?: boolean;
};

export type IndexPageMeasuredMessage = {
  type: 'INDEX_PAGE_MEASURED';
  payload: {
    url: string;
    title: string;
    contentHeight: number;
    skippedReason?: string;
    timing?: {
      afterHydrationMs: number;
      articleMeasureMs: number;
      navigationLoadMs?: number;
      resourceCount?: number;
      topImageDurations?: number[];
    };
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
  | { type: 'GET_PAGE_ADAPTER_CONTEXT' }
  | { type: 'HAS_ORIGIN_PERMISSION'; origin: string }
  | { type: 'GET_INDEXED_SCOPE_FOR_URL'; url: string }
  | { type: 'COLLECT_INDEX_LINKS' }
  | { type: 'START_INDEX'; tabId: number }
  | { type: 'GET_INDEX_RUN_PROGRESS' }
  | { type: 'GET_INDEX_OVERVIEWS' }
  | { type: 'GET_SITE_SNAPSHOT'; siteId: string }
  | { type: 'GET_SITE_PAGES'; siteId: string }
  | { type: 'GET_PAGE_RECORD'; siteId: string; url: string }
  | { type: 'GET_SITE_PROGRESS'; siteId: string }
  | { type: 'GET_SITE_SETTINGS'; siteId: string }
  | { type: 'SAVE_SITE_SETTINGS'; siteId: string; settings: Partial<SiteSettings> }
  | { type: 'SAVE_PROGRESS_RECORD'; siteId: string; url: string; ranges: import('../progress/ranges').ViewedRange[]; contentHeight: number }
  | { type: 'DELETE_SITE_INDEX'; siteId: string }
  | { type: 'CLEAR_SITE_PROGRESS'; siteId: string }
  | { type: 'CLEAR_ALL_PROGRESS' }
  | { type: 'GET_APP_SETTINGS' }
  | { type: 'SAVE_APP_SETTINGS'; settings: Partial<AppSettings> }
  | { type: 'EXPORT_PORTABLE_DATA'; scope: 'all' | 'site'; siteId?: string; includeProgress: boolean }
  | { type: 'PREVIEW_PORTABLE_IMPORT'; payload: PortableData }
  | { type: 'IMPORT_PORTABLE_DATA'; payload: PortableData; overwriteSiteIds: string[] }
  | { type: 'INDEX_PROGRESS_UPDATED'; siteId: string }
  | { type: 'SITE_SETTINGS_UPDATED'; siteId: string; settings: SiteSettings }
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

export type PortableExportResult = PortableSerializedData & {
  fileName: string;
};

export type PortableImportPreviewResult = {
  payload: PortableData;
  preview: PortableImportPreview;
};

export type PortableImportResultMessage = {
  importedCount: number;
  skipped: string[];
};
