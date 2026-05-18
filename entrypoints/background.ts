import { browser } from 'wxt/browser';
import { createIndexRunProgressStore } from '../src/indexing/run-progress';
import { indexedScopeForUrl } from '../src/indexing/indexed-scope';
import { indexFailureConsolePayload, measurementTimeoutLogDetails } from '../src/indexing/source-tab-log';
import { totalProgressPercent } from '../src/progress/calculations';
import { lfdDebug, lfdTrace } from '../src/shared/logger';
import type {
  IndexOverview,
  IndexPageMeasuredMessage,
  PortableExportResult,
  PortableImportPreviewResult,
  PortableImportResultMessage,
  RuntimeMessage,
  SiteSnapshot,
  StartIndexResult,
} from '../src/shared/messages';
import { indexedAutoInjectTargetForUrl } from '../src/shared/origin-permissions';
import { normalizePageUrl, siteIdFor, withIndexingHash } from '../src/shared/url';
import {
  clearAllProgress,
  clearSiteProgress,
  deleteSiteIndex,
  getAllSites,
  getPage,
  getPages,
  getProgressForSite,
  getSiteSettings,
  getSite,
  replaceSitePages,
  replacePortableSiteData,
  saveProgress,
  saveSiteSettings,
  type SiteSettingsRecord,
  type PageIndexRecord,
  type SiteRecord,
} from '../src/storage/db';
import {
  buildPortableData,
  importPortableData,
  parsePortableData,
  portableFileName,
  portableImportPreview,
  serializePortableData,
  type PortableDataScope,
  type PortableSiteBundle,
} from '../src/storage/portable-data';
import { getAppSettings, saveAppSettings } from '../src/storage/settings';

const INDEX_TIMEOUT_MS = 30000;

// 后端类比：background 是扩展里的“后端服务/API 层”。
// popup、options、content script 都通过 runtime message 找它读写数据或触发索引。
type PendingMeasurement = {
  url: string;
  startedAt: number;
  resolve: (payload: IndexPageMeasuredMessage['payload']) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof globalThis.setTimeout>;
};

// 索引时 background 会打开一个临时 tab 测量正文高度。
// 这个 Map 用 tabId 把“等待中的 Promise”和“测量页面回传的消息”配对。
const pendingMeasurements = new Map<number, PendingMeasurement>();
const indexRunProgress = createIndexRunProgressStore();

function errorDetails(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }
  return { message: String(error) };
}

async function isDebugIndexingLogsEnabled(): Promise<boolean> {
  return (await getAppSettings()).debugIndexingLogs;
}

// 向指定 tab 的 content script 发送消息，并把返回值转换成调用方期望的类型。
function sendTabMessage<T>(tabId: number, message: RuntimeMessage): Promise<T> {
  return browser.tabs.sendMessage(tabId, message) as Promise<T>;
}

async function injectContentScript(tabId: number): Promise<void> {
  const file = browser.runtime.getManifest().content_scripts?.[0]?.js?.[0];
  if (!file) throw new Error('Content script file not found.');
  const scriptFile = file as NonNullable<Parameters<typeof browser.scripting.executeScript>[0]['files']>[number];
  await browser.scripting.executeScript({
    target: { tabId },
    files: [scriptFile],
  });
}

async function hasContentScript(tabId: number): Promise<boolean> {
  try {
    const context = await sendTabMessage<{ supported: boolean }>(tabId, { type: 'GET_PAGE_ADAPTER_CONTEXT' });
    return Boolean(context?.supported);
  } catch {
    return false;
  }
}

async function injectContentScriptIfMissing(tabId: number): Promise<void> {
  if (await hasContentScript(tabId)) return;
  await injectContentScript(tabId);
}

async function maybeInjectIndexedTab(tabId: number | undefined, url: string | undefined): Promise<void> {
  if (tabId == null || !url) return;
  const target = indexedAutoInjectTargetForUrl(url, await getAllSites());
  if (!target) return;
  const hasPermission = await browser.permissions.contains({ origins: [target.originPattern] });
  if (!hasPermission) return;
  await injectContentScriptIfMissing(tabId);
}

// 向 popup/options 等扩展页面广播索引进度；没有接收方时忽略错误。
async function emitIndexProgress(payload: Extract<RuntimeMessage, { type: 'INDEX_RUN_PROGRESS' }>['payload']) {
  indexRunProgress.set(payload);
  lfdDebug('index run progress', payload);
  await browser.runtime.sendMessage({
    type: 'INDEX_RUN_PROGRESS',
    payload,
  } satisfies RuntimeMessage).catch(() => undefined);
}

async function logIndexFailureToSourceTab(tabId: number, error: unknown): Promise<void> {
  const [label, details] = indexFailureConsolePayload(errorDetails(error));
  await browser.scripting.executeScript({
    target: { tabId },
    func: (message, payload) => {
      console.error(message, payload);
    },
    args: [label, details],
  }).catch((logError) => {
    lfdDebug('failed to log index error to source tab', {
      tabId,
      originalError: details,
      logError: errorDetails(logError),
    });
  });
}

// 汇总所有已索引站点的概览数据，供 popup 和 options 管理页展示。
async function getIndexOverviews(): Promise<IndexOverview[]> {
  const sites = await getAllSites();
  const overviews = await Promise.all(sites.map(async (site) => {
    const [pages, progress] = await Promise.all([
      getPages(site.siteId),
      getProgressForSite(site.siteId),
    ]);
    const contentHeightByUrl = new Map(pages.map((page) => [page.url, Math.max(0, page.contentHeight)]));
    return {
      site,
      pageCount: pages.length,
      totalContentHeight: pages.reduce((sum, page) => sum + page.contentHeight, 0),
      totalViewedHeight: progress.reduce((sum, record) => {
        const contentHeight = contentHeightByUrl.get(record.url);
        if (contentHeight == null) return sum;
        return sum + Math.min(Math.max(0, record.viewedHeight), contentHeight);
      }, 0),
      totalPercent: totalProgressPercent(pages, progress),
      updatedAt: site.updatedAt,
    };
  }));
  return overviews.sort((a, b) => b.updatedAt - a.updatedAt);
}

// 读取单个站点的完整快照：站点元数据、页面索引、阅读进度。
async function getSiteSnapshot(siteId: string): Promise<SiteSnapshot | undefined> {
  const site = await getSite(siteId);
  if (!site) return undefined;
  const [pages, progress] = await Promise.all([
    getPages(siteId),
    getProgressForSite(siteId),
  ]);
  return { site, pages, progress };
}

async function getPortableSiteBundle(site: SiteRecord, includeProgress: boolean): Promise<PortableSiteBundle> {
  const [pages, progress, siteSettings] = await Promise.all([
    getPages(site.siteId),
    includeProgress ? getProgressForSite(site.siteId) : Promise.resolve([]),
    getSiteSettings(site.siteId) as Promise<SiteSettingsRecord>,
  ]);
  return {
    site,
    pages,
    siteSettings,
    ...(includeProgress ? { progress } : {}),
  };
}

async function exportPortableData(scope: PortableDataScope, siteId: string | undefined, includeProgress: boolean): Promise<PortableExportResult> {
  const exportedAt = Date.now();
  const sites = scope === 'all'
    ? await getAllSites()
    : siteId
      ? [await getSite(siteId)].filter((site): site is SiteRecord => Boolean(site))
      : [];
  if (scope === 'site' && sites.length === 0) throw new Error('No site index selected for export.');

  const payload = buildPortableData({
    scope,
    includeProgress,
    exportedAt,
    ...(scope === 'all' ? { appSettings: await getAppSettings() } : {}),
    sites: await Promise.all(sites.map((site) => getPortableSiteBundle(site, includeProgress))),
  });
  const serialized = await serializePortableData(payload);
  return {
    ...serialized,
    fileName: portableFileName({
      scope,
      exportedAt,
      fileExtension: serialized.fileExtension,
      site: scope === 'site' ? sites[0] : undefined,
    }),
  };
}

async function previewPortableImport(payload: Awaited<ReturnType<typeof parsePortableData>>): Promise<PortableImportPreviewResult> {
  const existing = new Set((await getAllSites()).map((site) => site.siteId));
  return {
    payload,
    preview: portableImportPreview(payload, existing),
  };
}

async function applyPortableImport(payload: Awaited<ReturnType<typeof parsePortableData>>, overwriteSiteIds: string[]): Promise<PortableImportResultMessage> {
  const existing = new Set((await getAllSites()).map((site) => site.siteId));
  const result = importPortableData(payload, {
    existingSiteIds: existing,
    overwriteSiteIds: new Set(overwriteSiteIds),
  });

  for (const site of result.imported) {
    await replacePortableSiteData(site);
    await notifyIndexUpdated(site.site.siteId);
  }
  if (result.appSettings) {
    await saveAppSettings(result.appSettings);
  }

  return {
    importedCount: result.imported.length,
    skipped: result.skipped,
  };
}

// 等待某个测量 tab 回传 INDEX_PAGE_MEASURED；超时则清理等待状态并报错。
function waitForMeasurement(tabId: number, url: string, startedAt: number): Promise<IndexPageMeasuredMessage['payload']> {
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      pendingMeasurements.delete(tabId);
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
      reject(new Error('Timed out while measuring page.'));
    }, INDEX_TIMEOUT_MS);

    pendingMeasurements.set(tabId, { url, startedAt, resolve, reject, timeout });
  });
}

function rejectPendingMeasurement(tabId: number, error: unknown): void {
  const pending = pendingMeasurements.get(tabId);
  if (!pending) return;
  pendingMeasurements.delete(tabId);
  globalThis.clearTimeout(pending.timeout);
  pending.reject(error instanceof Error ? error : new Error(String(error)));
}

// 打开一个带索引 hash 的临时 tab，让 content script 测量页面正文高度。
async function measurePage(url: string): Promise<{ tabId: number; payload: IndexPageMeasuredMessage['payload'] }> {
  const startedAt = Date.now();
  lfdDebug('opening indexing tab', { url });
  const tab = await browser.tabs.create({
    url: withIndexingHash(url),
    active: false,
  });
  if (tab.id == null) throw new Error('Could not create indexing tab.');
  const tabCreatedAt = Date.now();
  const measurementPromise = waitForMeasurement(tab.id, url, startedAt);

  try {
    try {
      await injectContentScript(tab.id);
    } catch (error) {
      rejectPendingMeasurement(tab.id, error);
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
    // finally 确保测量成功或失败后都会清理临时 tab。
    await browser.tabs.remove(tab.id).catch(() => undefined);
  }
}

// 创建或重建当前文档范围的索引：收集导航链接、逐页测量正文高度、保存 pages。
async function startIndex(tabId: number): Promise<StartIndexResult> {
  lfdDebug('start index', { tabId });
  await emitIndexProgress({
    phase: 'collecting',
    current: 0,
    total: 0,
  });
  const indexLinks = await sendTabMessage<{
    host: string;
    scopeKey: string;
    scopeTitle: string;
    links: Array<{ url: string; title: string }>;
  }>(tabId, { type: 'COLLECT_INDEX_LINKS' });

  if (indexLinks.links.length === 0) throw new Error('No document links found in the current sidebar.');
  lfdDebug('collected sidebar links', {
    count: indexLinks.links.length,
    first: indexLinks.links[0],
  });

  const siteId = siteIdFor(indexLinks.host, indexLinks.scopeKey);
  const now = Date.now();
  const existingSite = await getSite(siteId);
  // 重建索引时保留 createdAt，只刷新 updatedAt，表示这是同一个文档范围的新索引版本。
  const site: SiteRecord = {
    siteId,
    host: indexLinks.host,
    scopeKey: indexLinks.scopeKey,
    scopeTitle: indexLinks.scopeTitle,
    createdAt: existingSite?.createdAt ?? now,
    updatedAt: now,
  };

  const pages: PageIndexRecord[] = [];
  await emitIndexProgress({
    phase: 'measuring',
    current: 0,
    total: indexLinks.links.length,
    currentTitle: indexLinks.links[0]?.title,
    currentUrl: indexLinks.links[0]?.url,
  });
  for (const [order, link] of indexLinks.links.entries()) {
    // 串行测量，避免一次性打开大量文档页；每个页面只负责回传正文高度，不记录阅读进度。
    const measured = await measurePage(link.url);
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
      total: indexLinks.links.length,
      currentTitle: indexLinks.links[order + 1]?.title ?? link.title,
      currentUrl: indexLinks.links[order + 1]?.url ?? link.url,
    });
  }

  await emitIndexProgress({
    phase: 'saving',
    current: pages.length,
    total: indexLinks.links.length,
  });
  await replaceSitePages(site, pages);
  lfdDebug('index saved', {
    siteId,
    pageCount: pages.length,
  });
  await emitIndexProgress({
    phase: 'done',
    current: pages.length,
    total: indexLinks.links.length,
  });
  // 通知原始阅读页索引已更新，让 content script 重新启动/刷新阅读 tracker。
  await browser.tabs.sendMessage(tabId, { type: 'INDEX_PROGRESS_UPDATED', siteId }).catch(() => undefined);
  return { ok: true, site, pages };
}

async function notifySiteSettingsUpdated(siteId: string, settings: Awaited<ReturnType<typeof saveSiteSettings>>) {
  const tabs = await browser.tabs.query({});
  await Promise.all(tabs.map((tab) => {
    if (tab.id == null) return undefined;
    return browser.tabs.sendMessage(tab.id, {
      type: 'SITE_SETTINGS_UPDATED',
      siteId,
      settings,
    } satisfies RuntimeMessage).catch(() => undefined);
  }));
}

async function notifyIndexUpdated(siteId: string) {
  const tabs = await browser.tabs.query({});
  await Promise.all(tabs.map((tab) => {
    if (tab.id == null) return undefined;
    return browser.tabs.sendMessage(tab.id, { type: 'INDEX_PROGRESS_UPDATED', siteId } satisfies RuntimeMessage).catch(() => undefined);
  }));
}

export default defineBackground(() => {
  // WXT 的 defineBackground 会把这里注册成 MV3 service worker 入口。
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    void maybeInjectIndexedTab(tabId, tab.url).catch((error) => {
      lfdDebug('failed to auto-inject indexed tab after update', {
        tabId,
        url: tab.url,
        error: errorDetails(error),
      });
    });
  });

  browser.tabs.onActivated.addListener((activeInfo) => {
    void browser.tabs.get(activeInfo.tabId).then((tab) => {
      return maybeInjectIndexedTab(tab.id, tab.url);
    }).catch((error) => {
      lfdDebug('failed to auto-inject indexed tab after activation', {
        tabId: activeInfo.tabId,
        error: errorDetails(error),
      });
    });
  });

  // onMessage 相当于一个按 message.type 分发的轻量 RPC router。
  browser.runtime.onMessage.addListener((message: RuntimeMessage, sender) => {
    lfdTrace('runtime message received in background', {
      type: message.type,
      senderTabId: sender.tab?.id,
    });
    if (message.type === 'INDEX_PAGE_MEASURED') {
      // 测量页无法直接 resolve background 里的 Promise，只能发消息回来；
      // sender.tab.id 是这次异步测量的关联 ID。
      const tabId = sender.tab?.id;
      const pending = tabId == null ? undefined : pendingMeasurements.get(tabId);
      void isDebugIndexingLogsEnabled().then((enabled) => {
        if (!enabled) return;
        lfdDebug('measurement message received', {
          tabId,
          matched: Boolean(pending),
          payload: message.payload,
        });
      });
      if (!pending || tabId == null) return { ok: false, matched: false };
      pendingMeasurements.delete(tabId);
      globalThis.clearTimeout(pending.timeout);
      pending.resolve(message.payload);
      return { ok: true, matched: true };
    }

    // options 管理页使用：获取所有站点索引的概览列表。
    if (message.type === 'GET_INDEX_OVERVIEWS') return getIndexOverviews();

    // popup 使用：新打开时快速恢复当前索引运行进度，不等待下一次广播。
    if (message.type === 'GET_INDEX_RUN_PROGRESS') return indexRunProgress.get();

    // content script 使用：permissions API 只在扩展上下文里可靠可用。
    if (message.type === 'HAS_ORIGIN_PERMISSION') {
      return browser.permissions.contains({ origins: [message.origin] });
    }

    // popup/content script 使用：无持久 host permission 时，已索引 scope 允许 activeTab 临时注入后正常工作。
    if (message.type === 'GET_INDEXED_SCOPE_FOR_URL') {
      return getAllSites().then((sites) => indexedScopeForUrl(message.url, sites));
    }

    // popup/options 管理页使用：一次拿到当前站点的 site/pages/progress。
    if (message.type === 'GET_SITE_SNAPSHOT') return getSiteSnapshot(message.siteId);

    // content script 使用：判断当前文档范围是否已经创建过索引。
    // content script 和页面内进度 UI 使用：读取某个文档范围下的全部页面索引。
    if (message.type === 'GET_SITE_PAGES') return getPages(message.siteId);

    // content script 使用：判断当前 URL 是否是已索引页面。
    if (message.type === 'GET_PAGE_RECORD') return getPage(message.siteId, message.url);

    // content script 和页面内进度 UI 使用：读取某个文档范围下的全部阅读进度。
    if (message.type === 'GET_SITE_PROGRESS') return getProgressForSite(message.siteId);

    // options/content script 使用：读取某个文档范围的站点级配置。
    if (message.type === 'GET_SITE_SETTINGS') return getSiteSettings(message.siteId);

    // options 管理页使用：保存站点级配置，并通知已打开的阅读页刷新状态。
    if (message.type === 'SAVE_SITE_SETTINGS') {
      return saveSiteSettings(message.siteId, message.settings).then(async (settings) => {
        await notifySiteSettingsUpdated(message.siteId, settings);
        return settings;
      });
    }

    // content script 使用：滚动采样后保存当前页面的阅读进度。
    if (message.type === 'SAVE_PROGRESS_RECORD') {
      return saveProgress(message.siteId, message.url, message.ranges, message.contentHeight);
    }

    // options/content script 使用：读取扩展全局设置，例如是否显示右侧阅读地图。
    if (message.type === 'GET_APP_SETTINGS') return getAppSettings();

    // options 管理页使用：保存扩展全局设置。
    if (message.type === 'SAVE_APP_SETTINGS') return saveAppSettings(message.settings);

    // options 管理页使用：导出本地索引和配置为便携备份/分享文件。
    if (message.type === 'EXPORT_PORTABLE_DATA') return exportPortableData(message.scope, message.siteId, message.includeProgress);

    // options 管理页使用：导入前解析文件并报告本地冲突。
    if (message.type === 'PREVIEW_PORTABLE_IMPORT') return previewPortableImport(message.payload);

    // options 管理页使用：根据用户确认的覆盖列表导入便携数据。
    if (message.type === 'IMPORT_PORTABLE_DATA') return applyPortableImport(message.payload, message.overwriteSiteIds);

    // options 管理页使用：清空当前选中站点的阅读进度，保留页面索引。
    if (message.type === 'CLEAR_SITE_PROGRESS') {
      return clearSiteProgress(message.siteId).then(() => ({ ok: true }));
    }

    // options 管理页使用：清空所有站点的阅读进度，保留所有页面索引。
    if (message.type === 'CLEAR_ALL_PROGRESS') {
      return clearAllProgress().then(() => ({ ok: true }));
    }

    // options 管理页使用：删除当前选中站点的索引和对应阅读进度。
    if (message.type === 'DELETE_SITE_INDEX') {
      return deleteSiteIndex(message.siteId).then(() => ({ ok: true }));
    }

    // 非 background 负责处理的消息返回 undefined，让浏览器继续按普通无响应消息处理。
    if (message.type !== 'START_INDEX') return undefined;

    // popup 使用：点击创建/重建索引时触发完整索引流程。
    return startIndex(message.tabId).catch(async (error: unknown) => {
      indexRunProgress.clearSoon();
      await logIndexFailureToSourceTab(message.tabId, error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Indexing failed.',
      };
    });
  });
});
