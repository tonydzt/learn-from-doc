import { browser } from 'wxt/browser';
import { measurementTimeoutLogDetails } from '../../indexing/source-tab-log';
import { lfdDebug } from '../../shared/logger';
import type { IndexLinksResponse, IndexPageMeasuredMessage, RuntimeMessage, StartIndexResult } from '../../shared/messages';
import { normalizePageUrl, siteIdFor, withIndexingHash } from '../../shared/url';
import {
  deleteIndexCheckpoint,
  getIndexCheckpoint,
  getSite,
  replaceSitePages,
  saveIndexCheckpoint,
  type IndexCheckpointRecord,
  type PageIndexRecord,
  type SiteRecord,
} from '../../storage/db';
import type { BackgroundContext } from '../types';
import { isDebugIndexingLogsEnabled } from './settings';
import { injectContentScript, sendTabMessage } from './tabs';

const INDEX_TIMEOUT_MS = 30000;
const MEASUREMENT_TIMEOUT_MESSAGE = 'Timed out while measuring page.';

/**
 * 更新后台内存中的索引进度，并向popup页面广播最新进度消息。
 */
export async function emitIndexProgress(
  context: BackgroundContext,
  payload: Extract<RuntimeMessage, { type: 'INDEX_RUN_PROGRESS' }>['payload'],
) {
  context.indexRunProgress.set(payload);
  lfdDebug('index run progress', payload);
  await browser.runtime.sendMessage({
    type: 'INDEX_RUN_PROGRESS',
    payload,
  } satisfies RuntimeMessage).catch(() => undefined);
}

/**
 * 为单个测量任务创建等待 Promise：
 * - 正常路径：由外部测量回调触发 resolve
 * - 异常路径：超时后自动 reject 并清理 pending 状态
 */
function waitForMeasurement(
  context: BackgroundContext,
  tabId: number,
  url: string,
  startedAt: number,
): Promise<IndexPageMeasuredMessage['payload']> {
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      // 超时后先移除 pending，避免后续重复结算同一个测量任务。
      context.pendingMeasurements.delete(tabId);
      void isDebugIndexingLogsEnabled().then((enabled) => {
        if (!enabled) return;
        lfdDebug('measurement timed out', measurementTimeoutLogDetails({
          tabId,
          url,
          startedAt,
          now: Date.now(),
          timeoutMs: INDEX_TIMEOUT_MS,
        }));
      });
      reject(new Error(MEASUREMENT_TIMEOUT_MESSAGE));
    }, INDEX_TIMEOUT_MS);

    context.pendingMeasurements.set(tabId, { url, startedAt, resolve, reject, timeout });
  });
}

function hasMatchingCheckpointLinks(
  checkpoint: IndexCheckpointRecord,
  links: IndexLinksResponse['links'],
): boolean {
  return checkpoint.links.length === links.length
    && checkpoint.links.every((link, index) => link.url === links[index]?.url);
}

function checkpointForIndexRun(input: {
  site: SiteRecord;
  links: IndexLinksResponse['links'];
  pages: PageIndexRecord[];
  requiresIndexingLoadWait: boolean;
}): IndexCheckpointRecord {
  return {
    siteId: input.site.siteId,
    host: input.site.host,
    scopeKey: input.site.scopeKey,
    scopeTitle: input.site.scopeTitle,
    links: input.links,
    pages: input.pages,
    requiresIndexingLoadWait: input.requiresIndexingLoadWait,
    updatedAt: Date.now(),
    failedReason: 'indexing-error',
  };
}

/**
 * 主动拒绝并清理某个 tab 的 pending 测量任务。
 * 用于内容脚本注入失败等“提前失败”场景。
 */
function rejectPendingMeasurement(context: BackgroundContext, tabId: number, error: unknown): void {
  const pending = context.pendingMeasurements.get(tabId);
  if (!pending) return;
  context.pendingMeasurements.delete(tabId);
  globalThis.clearTimeout(pending.timeout);
  pending.reject(error instanceof Error ? error : new Error(String(error)));
}

/** 判断测量 tab 是否已经完成导航并落到目标 origin，避免把脚本注入到 about:blank 等中间态。 */
function isTabReadyForInjection(tab: chrome.tabs.Tab, targetOrigin: string): boolean {
  if (tab.status !== 'complete' || !tab.url) return false;
  try {
    return new URL(tab.url).origin === targetOrigin;
  } catch {
    return false;
  }
}

/** 新建后台测量 tab 后，先等目标页面加载完成，再注入会读取 DOM 的 content script。 */
async function waitForIndexingTab(tabId: number, targetUrl: string): Promise<void> {
  const targetOrigin = new URL(targetUrl).origin;
  const tab = await browser.tabs.get(tabId);
  if (isTabReadyForInjection(tab, targetOrigin)) return;

  await new Promise<void>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      browser.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error('Timed out waiting for indexing tab to finish loading.'));
    }, 10000);

    const onUpdated = (updatedTabId: number, _changeInfo: chrome.tabs.TabChangeInfo, updatedTab: chrome.tabs.Tab) => {
      if (updatedTabId !== tabId || !isTabReadyForInjection(updatedTab, targetOrigin)) return;
      globalThis.clearTimeout(timeout);
      browser.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    };

    browser.tabs.onUpdated.addListener(onUpdated);
  });
}

/**
 * 在隐藏标签页中打开目标文档并完成一次页面测量。
 * 无论成功失败，最终都会尝试关闭用于测量的标签页。
 */
async function measurePage(
  context: BackgroundContext,
  url: string,
  requiresIndexingLoadWait: boolean,
): Promise<{ tabId: number; payload: IndexPageMeasuredMessage['payload'] }> {
  const startedAt = Date.now();
  lfdDebug('opening indexing tab', { url });
  const indexingUrl = withIndexingHash(url);
  const tab = await browser.tabs.create({
    url: indexingUrl,
    active: false,
  });
  if (tab.id == null) throw new Error('Could not create indexing tab.');
  const tabCreatedAt = Date.now();
  const measurementPromise = waitForMeasurement(context, tab.id, url, startedAt);

  try {
    try {
      if (import.meta.env.FIREFOX || requiresIndexingLoadWait) {
        lfdDebug('indexing tab wait before injection', {
          tabId: tab.id,
          url: indexingUrl,
        });
        await waitForIndexingTab(tab.id, indexingUrl);
      }
      await injectContentScript(tab.id);
    } catch (error) {
      // 注入失败时立即拒绝等待中的测量 Promise，避免悬挂到超时。
      rejectPendingMeasurement(context, tab.id, error);
      await measurementPromise.catch(() => undefined);
      throw error;
    }
    const payload = await measurementPromise;
    const measuredAt = Date.now();
    if (await isDebugIndexingLogsEnabled()) {
      if (payload.skippedReason) {
        lfdDebug('indexing measurement skipped page', {
          tabId: tab.id,
          url,
          skippedReason: payload.skippedReason,
        });
      }
      lfdDebug('measured indexing tab', {
        url,
        tabId: tab.id,
        totalElapsedMs: measuredAt - startedAt,
        tabCreateMs: tabCreatedAt - startedAt,
        waitMeasurementMs: measuredAt - tabCreatedAt,
        timeoutMs: INDEX_TIMEOUT_MS,
        payload,
      });
    }
    return { tabId: tab.id, payload };
  } finally {
    // 测量标签页仅用于后台采样，结束后统一回收。
    await browser.tabs.remove(tab.id).catch(() => undefined);
  }
}

/**
 * 执行一次完整索引流程：
 * 1) 从当前页面侧边栏采集文档链接
 * 2) 逐页测量内容高度并组装页面索引
 * 3) 原子替换站点索引数据并广播进度
 */
export async function startIndex(context: BackgroundContext, tabId: number): Promise<StartIndexResult> {
  lfdDebug('start index', { tabId });
  await emitIndexProgress(context, {
    phase: 'collecting',
    current: 0,
    total: 0,
  });
  const indexLinks = await sendTabMessage<IndexLinksResponse>(tabId, { type: 'COLLECT_INDEX_LINKS' });

  if (indexLinks.links.length === 0) throw new Error('No document links found in the current sidebar.');
  lfdDebug('collected sidebar links', {
    count: indexLinks.links.length,
    first: indexLinks.links[0],
  });

  const siteId = siteIdFor(indexLinks.host, indexLinks.scopeKey);
  const now = Date.now();
  const existingSite = await getSite(siteId);
  // 已存在站点时保留 createdAt，仅刷新 updatedAt。
  const site: SiteRecord = {
    siteId,
    host: indexLinks.host,
    scopeKey: indexLinks.scopeKey,
    scopeTitle: indexLinks.scopeTitle,
    createdAt: existingSite?.createdAt ?? now,
    updatedAt: now,
  };

  const checkpoint = await getIndexCheckpoint(siteId);
  const canResumeCheckpoint = checkpoint ? hasMatchingCheckpointLinks(checkpoint, indexLinks.links) : false;
  if (checkpoint && !canResumeCheckpoint) await deleteIndexCheckpoint(siteId);

  const pages: PageIndexRecord[] = canResumeCheckpoint ? [...checkpoint.pages] : [];
  const requiresIndexingLoadWait = indexLinks.requiresIndexingLoadWait === true;
  await emitIndexProgress(context, {
    phase: 'measuring',
    current: pages.length,
    total: indexLinks.links.length,
    currentTitle: indexLinks.links[pages.length]?.title ?? indexLinks.links[0]?.title,
    currentUrl: indexLinks.links[pages.length]?.url ?? indexLinks.links[0]?.url,
  });
  for (let order = pages.length; order < indexLinks.links.length; order += 1) {
    const link = indexLinks.links[order];
    const measured = await measurePage(context, link.url, requiresIndexingLoadWait);
    pages.push({
      siteId,
      url: normalizePageUrl(measured.payload.url),
      title: link.title || measured.payload.title,
      order,
      contentHeight: measured.payload.contentHeight,
    });
    await saveIndexCheckpoint(checkpointForIndexRun({
      site,
      links: indexLinks.links,
      pages,
      requiresIndexingLoadWait,
    }));
    await emitIndexProgress(context, {
      phase: 'measuring',
      current: pages.length,
      total: indexLinks.links.length,
      currentTitle: indexLinks.links[order + 1]?.title ?? link.title,
      currentUrl: indexLinks.links[order + 1]?.url ?? link.url,
    });
  }

  // 用最新测量结果整体替换站点索引，避免新旧页面混杂。
  await emitIndexProgress(context, {
    phase: 'saving',
    current: pages.length,
    total: indexLinks.links.length,
  });
  await replaceSitePages(site, pages);
  await deleteIndexCheckpoint(siteId);
  lfdDebug('index saved', {
    siteId,
    pageCount: pages.length,
  });
  await emitIndexProgress(context, {
    phase: 'done',
    current: pages.length,
    total: indexLinks.links.length,
  });
  // 场景：创建/重建索引完成后，通知页面侧刷新阅读追踪状态。
  await browser.tabs.sendMessage(tabId, { type: 'INDEX_PROGRESS_UPDATED', siteId }).catch(() => undefined);
  return { ok: true, site, pages };
}
