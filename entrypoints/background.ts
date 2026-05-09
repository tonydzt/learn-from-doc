import { browser } from 'wxt/browser';
import { indexLinksForMode, shouldKeepMeasuredTabOpen, shouldOpenMeasuredTabActive } from '../src/indexing/debug-options';
import { totalProgressPercent } from '../src/progress/calculations';
import { lfdDebug, lfdTrace } from '../src/shared/logger';
import type { IndexOverview, IndexPageMeasuredMessage, RuntimeMessage, SiteSnapshot, StartIndexResult } from '../src/shared/messages';
import { normalizePageUrl, siteIdFor, withIndexingHash } from '../src/shared/url';
import {
  clearAllProgress,
  clearSiteProgress,
  deleteSiteIndex,
  getAllSites,
  getPage,
  getPages,
  getProgress,
  getProgressForSite,
  getSite,
  replaceSitePages,
  saveProgress,
  type PageIndexRecord,
  type SiteRecord,
} from '../src/storage/db';
import { getAppSettings, saveAppSettings } from '../src/storage/settings';

const INDEX_TIMEOUT_MS = 30000;

type PendingMeasurement = {
  resolve: (payload: IndexPageMeasuredMessage['payload']) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof globalThis.setTimeout>;
};

const pendingMeasurements = new Map<number, PendingMeasurement>();

function sendTabMessage<T>(tabId: number, message: RuntimeMessage): Promise<T> {
  return browser.tabs.sendMessage(tabId, message) as Promise<T>;
}

async function emitIndexProgress(payload: Extract<RuntimeMessage, { type: 'INDEX_RUN_PROGRESS' }>['payload']) {
  lfdDebug('index run progress', payload);
  await browser.runtime.sendMessage({
    type: 'INDEX_RUN_PROGRESS',
    payload,
  } satisfies RuntimeMessage).catch(() => undefined);
}

async function getIndexOverviews(): Promise<IndexOverview[]> {
  const sites = await getAllSites();
  const overviews = await Promise.all(sites.map(async (site) => {
    const [pages, progress] = await Promise.all([
      getPages(site.siteId),
      getProgressForSite(site.siteId),
    ]);
    return {
      site,
      pageCount: pages.length,
      totalContentHeight: pages.reduce((sum, page) => sum + page.contentHeight, 0),
      totalViewedHeight: progress.reduce((sum, record) => sum + record.viewedHeight, 0),
      totalPercent: totalProgressPercent(pages, progress),
      updatedAt: site.updatedAt,
    };
  }));
  return overviews.sort((a, b) => b.updatedAt - a.updatedAt);
}

async function getSiteSnapshot(siteId: string): Promise<SiteSnapshot | undefined> {
  const site = await getSite(siteId);
  if (!site) return undefined;
  const [pages, progress] = await Promise.all([
    getPages(siteId),
    getProgressForSite(siteId),
  ]);
  return { site, pages, progress };
}

function waitForMeasurement(tabId: number): Promise<IndexPageMeasuredMessage['payload']> {
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      pendingMeasurements.delete(tabId);
      lfdDebug('measurement timed out', { tabId, timeoutMs: INDEX_TIMEOUT_MS });
      reject(new Error('Timed out while measuring page.'));
    }, INDEX_TIMEOUT_MS);

    pendingMeasurements.set(tabId, { resolve, reject, timeout });
  });
}

async function measurePage(url: string, debug: boolean): Promise<{ tabId: number; payload: IndexPageMeasuredMessage['payload'] }> {
  lfdDebug('opening indexing tab', { url, debug });
  const tab = await browser.tabs.create({
    url: withIndexingHash(url, debug),
    active: shouldOpenMeasuredTabActive(debug),
  });
  if (tab.id == null) throw new Error('Could not create indexing tab.');

  try {
    const payload = await waitForMeasurement(tab.id);
    lfdDebug('measured indexing tab', { tabId: tab.id, payload, debug });
    return { tabId: tab.id, payload };
  } finally {
    if (shouldKeepMeasuredTabOpen(debug)) {
      lfdDebug('debug mode: keeping indexing tab open', { tabId: tab.id });
    } else {
      await browser.tabs.remove(tab.id).catch(() => undefined);
    }
  }
}

async function startIndex(tabId: number, debug = false): Promise<StartIndexResult> {
  lfdDebug('start index', { tabId, debug });
  await emitIndexProgress({
    phase: 'collecting',
    current: 0,
    total: 0,
    debug,
  });
  const indexLinks = await sendTabMessage<{
    host: string;
    scopeKey: string;
    scopeTitle: string;
    links: Array<{ url: string; title: string }>;
  }>(tabId, { type: 'COLLECT_INDEX_LINKS' });

  if (indexLinks.links.length === 0) {
    return { ok: false, error: 'No document links found in the current sidebar.' };
  }
  lfdDebug('collected sidebar links', {
    count: indexLinks.links.length,
    first: indexLinks.links[0],
    debug,
  });

  const siteId = siteIdFor(indexLinks.host, indexLinks.scopeKey);
  const now = Date.now();
  const existingSite = await getSite(siteId);
  const site: SiteRecord = {
    siteId,
    host: indexLinks.host,
    scopeKey: indexLinks.scopeKey,
    scopeTitle: indexLinks.scopeTitle,
    createdAt: existingSite?.createdAt ?? now,
    updatedAt: now,
  };

  const pages: PageIndexRecord[] = [];
  const measuredTabIds: number[] = [];
  const selectedLinks = indexLinksForMode(indexLinks.links, debug);
  await emitIndexProgress({
    phase: 'measuring',
    current: 0,
    total: selectedLinks.length,
    currentTitle: selectedLinks[0]?.title,
    currentUrl: selectedLinks[0]?.url,
    debug,
  });
  for (const [order, link] of selectedLinks.entries()) {
    const measured = await measurePage(link.url, debug);
    measuredTabIds.push(measured.tabId);
    pages.push({
      siteId,
      url: normalizePageUrl(measured.payload.url),
      title: link.title || measured.payload.title,
      order,
      contentHeight: measured.payload.contentHeight,
    });
    await emitIndexProgress({
      phase: 'measuring',
      current: pages.length,
      total: selectedLinks.length,
      currentTitle: selectedLinks[order + 1]?.title ?? link.title,
      currentUrl: selectedLinks[order + 1]?.url ?? link.url,
      debug,
    });
  }

  await emitIndexProgress({
    phase: 'saving',
    current: pages.length,
    total: selectedLinks.length,
    debug,
  });
  await replaceSitePages(site, pages);
  lfdDebug('index saved', {
    siteId,
    pageCount: pages.length,
    debug,
  });
  await emitIndexProgress({
    phase: 'done',
    current: pages.length,
    total: selectedLinks.length,
    debug,
  });
  if (debug && selectedLinks.length > 0) {
    await Promise.all(measuredTabIds.map((measuredTabId) => {
      return browser.tabs.sendMessage(measuredTabId, {
        type: 'INDEX_DEBUG_STATUS',
        payload: {
          ok: true,
          message: 'Background saved debug index.',
          details: { siteId, pageCount: pages.length, pages },
        },
      } satisfies RuntimeMessage).catch(() => undefined);
    }));
  }
  await browser.tabs.sendMessage(tabId, { type: 'INDEX_PROGRESS_UPDATED', siteId }).catch(() => undefined);
  return { ok: true, site, pages };
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: RuntimeMessage, sender) => {
    lfdTrace('runtime message received in background', {
      type: message.type,
      senderTabId: sender.tab?.id,
    });
    if (message.type === 'INDEX_PAGE_MEASURED') {
      const tabId = sender.tab?.id;
      const pending = tabId == null ? undefined : pendingMeasurements.get(tabId);
      lfdDebug('measurement message received', {
        tabId,
        matched: Boolean(pending),
        payload: message.payload,
      });
      if (!pending || tabId == null) return { ok: false, matched: false };
      pendingMeasurements.delete(tabId);
      globalThis.clearTimeout(pending.timeout);
      pending.resolve(message.payload);
      return { ok: true, matched: true };
    }
    if (message.type === 'GET_INDEX_OVERVIEWS') return getIndexOverviews();
    if (message.type === 'GET_SITE_SNAPSHOT') return getSiteSnapshot(message.siteId);
    if (message.type === 'GET_SITE_RECORD') return getSite(message.siteId);
    if (message.type === 'GET_SITE_PAGES') return getPages(message.siteId);
    if (message.type === 'GET_PAGE_RECORD') return getPage(message.siteId, message.url);
    if (message.type === 'GET_SITE_PROGRESS') return getProgressForSite(message.siteId);
    if (message.type === 'GET_PROGRESS_RECORD') return getProgress(message.siteId, message.url);
    if (message.type === 'SAVE_PROGRESS_RECORD') {
      return saveProgress(message.siteId, message.url, message.ranges, message.contentHeight);
    }
    if (message.type === 'GET_APP_SETTINGS') return getAppSettings();
    if (message.type === 'SAVE_APP_SETTINGS') return saveAppSettings(message.settings);
    if (message.type === 'CLEAR_SITE_PROGRESS') {
      return clearSiteProgress(message.siteId).then(() => ({ ok: true }));
    }
    if (message.type === 'CLEAR_ALL_PROGRESS') {
      return clearAllProgress().then(() => ({ ok: true }));
    }
    if (message.type === 'DELETE_SITE_INDEX') {
      return deleteSiteIndex(message.siteId).then(() => ({ ok: true }));
    }
    if (message.type !== 'START_INDEX') return undefined;
    return startIndex(message.tabId, message.debug === true).catch((error: unknown) => ({
      ok: false,
      error: error instanceof Error ? error.message : 'Indexing failed.',
    }));
  });
});
