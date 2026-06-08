import type { ViewedRange } from '../../progress/ranges';
import type { PageSettings } from '../../settings/page-settings';
import type { SiteSettings } from '../../settings/site-settings';

export type SiteRecord = {
  siteId: string;
  host: string;
  scopeKey: string;
  scopeTitle: string;
  createdAt: number;
  updatedAt: number;
};

export type PageIndexRecord = {
  siteId: string;
  url: string;
  title: string;
  order: number;
  contentHeight: number;
};

export type IndexCheckpointRecord = {
  siteId: string;
  host: string;
  scopeKey: string;
  scopeTitle: string;
  links: Array<{ url: string; title: string }>;
  pages: PageIndexRecord[];
  requiresIndexingLoadWait: boolean;
  updatedAt: number;
  failedReason: 'indexing-error' | 'measurement-timeout';
};

export type ProgressRecord = {
  siteId: string;
  url: string;
  viewedRanges: ViewedRange[];
  viewedHeight: number;
  updatedAt: number;
};

export type SiteSettingsRecord = SiteSettings & {
  siteId: string;
};

export type PageSettingsRecord = PageSettings & {
  siteId: string;
  url: string;
};

export type StoreName = 'sites' | 'pages' | 'progress' | 'siteSettings' | 'pageSettings' | 'indexCheckpoints';
