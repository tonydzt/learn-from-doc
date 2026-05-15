import type { ViewedRange } from '../../progress/ranges';
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

export type StoreName = 'sites' | 'pages' | 'progress' | 'siteSettings';
