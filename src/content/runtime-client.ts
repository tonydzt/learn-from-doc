import { browser } from 'wxt/browser';
import type { AppSettings } from '../settings/app-settings';
import type { SiteSettings } from '../settings/site-settings';
import type { RuntimeMessage } from '../shared/messages';
import type { PageIndexRecord, ProgressRecord, SiteRecord } from '../storage/db';
import type { ViewedRange } from '../progress/ranges';

export function sendRuntimeMessage<T = unknown>(message: RuntimeMessage): Promise<T> {
  return browser.runtime.sendMessage(message) as Promise<T>;
}

export function getPagesFromBackground(siteId: string): Promise<PageIndexRecord[]> {
  return sendRuntimeMessage<PageIndexRecord[]>({ type: 'GET_SITE_PAGES', siteId });
}

export function getPageFromBackground(siteId: string, url: string): Promise<PageIndexRecord | undefined> {
  return sendRuntimeMessage<PageIndexRecord | undefined>({ type: 'GET_PAGE_RECORD', siteId, url });
}

export function getProgressForSiteFromBackground(siteId: string): Promise<ProgressRecord[]> {
  return sendRuntimeMessage<ProgressRecord[]>({ type: 'GET_SITE_PROGRESS', siteId });
}

export function getSiteSettingsFromBackground(siteId: string): Promise<SiteSettings> {
  return sendRuntimeMessage<SiteSettings>({ type: 'GET_SITE_SETTINGS', siteId });
}

export function saveProgressToBackground(
  siteId: string,
  url: string,
  ranges: ViewedRange[],
  contentHeight: number,
): Promise<ProgressRecord> {
  return sendRuntimeMessage<ProgressRecord>({ type: 'SAVE_PROGRESS_RECORD', siteId, url, ranges, contentHeight });
}

export function deletePageProgressFromBackground(siteId: string, url: string): Promise<{ ok: true }> {
  return sendRuntimeMessage<{ ok: true }>({ type: 'DELETE_PAGE_PROGRESS', siteId, url });
}

export function getAppSettingsFromBackground(): Promise<AppSettings> {
  return sendRuntimeMessage<AppSettings>({ type: 'GET_APP_SETTINGS' });
}

export function originPatternForCurrentPage(): string {
  return `${location.origin}/*`;
}

export function hasOriginPermissionFromBackground(): Promise<boolean> {
  return sendRuntimeMessage<boolean>({ type: 'HAS_ORIGIN_PERMISSION', origin: originPatternForCurrentPage() });
}

export function getIndexedScopeForCurrentPage(): Promise<SiteRecord | null> {
  return sendRuntimeMessage<SiteRecord | null>({ type: 'GET_INDEXED_SCOPE_FOR_URL', url: location.href });
}
