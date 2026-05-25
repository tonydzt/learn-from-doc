import { browser } from 'wxt/browser';
import { getAdapterForPage } from '../adapters';
import { completeRangeAtPageEnd } from '../progress/completion';
import { addViewedRange, mergeRanges, viewedHeight, type ViewedRange } from '../progress/ranges';
import { scrollableAncestors } from '../progress/scroll-targets';
import { APP_SETTINGS_STORAGE_KEY, normalizeAppSettings } from '../settings/app-settings';
import { FLUSH_INTERVAL_MS } from '../shared/constants';
import { lfdDebug, lfdTrace } from '../shared/logger';
import { normalizePageUrl, siteIdFor } from '../shared/url';
import {
  isReadingTrackerOwner,
  shouldContinueTracking,
  shouldFlushTrackingProgress,
  shouldStartReadingTracker,
  shouldUsePrefetchedSiteSettings,
} from './reading-lifecycle';
import { afterHydration } from './hydration';
import { isArticleScrolledToEnd, visibleRange } from './reading-geometry';
import {
  renderProgressUi,
  renderReadingMap,
  removeProgressUi,
  removeReadingMap,
  type ProgressUiSnapshot,
} from './progress-ui';
import {
  getAppSettingsFromBackground,
  getPageFromBackground,
  getPagesFromBackground,
  getProgressForSiteFromBackground,
  getSiteSettingsFromBackground,
  saveProgressToBackground,
} from './runtime-client';
import { isSubdirectoryPage } from '../progress/calculations';

export type ReadingTrackerStop = () => Promise<void>;

function rangesChanged(current: ViewedRange[], next: ViewedRange[]): boolean {
  if (current.length !== next.length) return true;
  return current.some((range, index) => range.start !== next[index]?.start || range.end !== next[index]?.end);
}

export async function runReadingTracker(signal: AbortSignal, ownerId: string): Promise<ReadingTrackerStop | undefined> {
  const trackedUrl = normalizePageUrl(location.href);

  // 内容脚本可能因为 SPA 路由切换、重新注入等原因同时存在多个 tracker。
  // 这里每次继续执行前都确认两件事：当前实例仍是 owner，并且页面 URL 仍是启动时的 URL。
  const canContinue = () => shouldContinueTracking({
    isActiveOwner: isReadingTrackerOwner(document.documentElement, ownerId),
    trackedUrl,
    currentUrl: normalizePageUrl(location.href),
  });

  // 普通 flush 要求 tracker 还没被 abort，且 URL 没变；最终清理 flush 放宽 URL/abort 限制，
  // 只要仍是 owner 就尽量把最后一段阅读进度写回 background。
  const canFlush = (isFinalFlush: boolean) => shouldFlushTrackingProgress({
    isActiveOwner: isReadingTrackerOwner(document.documentElement, ownerId),
    isFinalFlush,
    isSignalAborted: signal.aborted,
    trackedUrl,
    currentUrl: normalizePageUrl(location.href),
  });

  // 水合前先尝试用 URL 可确定的 scope 预取设置；依赖 DOM 识别的 adapter（框架adapter） 此时可能还拿不到 scope。
  const initialScope = getAdapterForPage(location.href)?.getDocScope();
  const prefetchedSiteId = initialScope ? siteIdFor(initialScope.host, initialScope.scopeKey) : undefined;
  const prefetchedSiteSettings = prefetchedSiteId ? getSiteSettingsFromBackground(prefetchedSiteId) : undefined;

  // 等页面水合完成后再找正文节点，否则很多文档站的文章 DOM 可能还没渲染出来。
  await afterHydration();
  if (signal.aborted || !canContinue()) return undefined;

  // 水合后重新识别，scope 和 article 是真正启动 tracker 时采用的页面结果。
  const adapter = getAdapterForPage(location.href);
  const scope = adapter?.getDocScope();
  const article = adapter?.getArticleRoot();
  lfdDebug('reading tracker boot', {
    url: location.href,
    normalizedUrl: normalizePageUrl(location.href),
    adapterFound: Boolean(adapter),
    scope,
    articleFound: Boolean(article),
  });
  if (!adapter || !scope || !article) return undefined;

  const siteId = siteIdFor(scope.host, scope.scopeKey);
  // 只有预取的 scope 与正式 scope 属于同一站点范围，才能复用提前请求到的设置。
  const siteSettingsPromise = shouldUsePrefetchedSiteSettings(prefetchedSiteId, siteId) && prefetchedSiteSettings
    ? prefetchedSiteSettings
    : getSiteSettingsFromBackground(siteId);
  const pagePromise = getPageFromBackground(siteId, normalizePageUrl(location.href));
  const [siteSettings, page] = await Promise.all([siteSettingsPromise, pagePromise]);
  if (signal.aborted || !canContinue()) return undefined;

  if (!shouldStartReadingTracker(siteSettings.readingProgressEnabled)) {
    removeProgressUi();
    lfdDebug('reading tracker skipped: site reading progress disabled', {
      siteId,
      url: normalizePageUrl(location.href),
    });
    return undefined;
  }

  if (!page) {
    const pages = await getPagesFromBackground(siteId);
    lfdDebug('reading tracker skipped: page not indexed', {
      siteId,
      currentUrl: normalizePageUrl(location.href),
      indexedPageCount: pages.length,
      indexedUrls: pages.map((item) => item.url),
    });
    return undefined;
  }

  if (isSubdirectoryPage(page)) {
    removeReadingMap();
    lfdDebug('reading tracker skipped: subdirectory placeholder page', {
      siteId,
      url: page.url,
      contentHeight: page.contentHeight,
    });
    return undefined;
  }

  // 之后 UI 渲染需要站点的页面列表和全站进度；当前页采样需要 app 设置和当前页已读区间。
  const [sitePages, siteProgress] = await Promise.all([
    getPagesFromBackground(siteId),
    getProgressForSiteFromBackground(siteId),
  ]);
  if (signal.aborted || !canContinue()) return undefined;

  let uiSnapshot: ProgressUiSnapshot = {
    pages: sitePages,
    progress: siteProgress,
  };
  let settings = await getAppSettingsFromBackground();
  if (signal.aborted || !canContinue()) return undefined;

  // ranges 是当前页面已经读过的正文高度区间，dirty 表示内存里的 ranges 有新变化但还没保存。
  let ranges = mergeRanges(siteProgress.find((entry) => entry.url === page.url)?.viewedRanges ?? []);
  let dirty = false;
  let renderTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  lfdDebug('reading tracker started', {
    siteId,
    url: page.url,
    contentHeight: page.contentHeight,
    initialRanges: ranges,
  });

  // 插入阅读进度 UI函数
  const renderUi = () => renderProgressUi(siteId, settings.language, uiSnapshot);

  // 插入阅读地图函数
  const renderReadingMapIfEnabled = (range: ViewedRange | null) => {
    if (!settings.showReadingMap) {
      removeReadingMap();
      return;
    }
    renderReadingMap(ranges, range, page.contentHeight);
  };

  // 插入阅读进度 UI和阅读地图函数
  const renderPageChrome = async () => {
    if (signal.aborted || !canContinue()) return;

    // 顶部/侧边的总体进度 UI 依赖 uiSnapshot；阅读地图还需要当前视口在正文里的位置。
    await renderUi();
    renderReadingMapIfEnabled(visibleRange(article));
  };
  const scheduleRenderUi = () => {
    if (signal.aborted || !canContinue() || renderTimer) return;

    // scroll/mutation 触发可能很频繁，延迟合并渲染，避免每个事件都重绘 UI。
    renderTimer = globalThis.setTimeout(() => {
      renderTimer = undefined;
      void renderPageChrome();
    }, 300);
  };

  const sample = () => {
    if (signal.aborted || !canContinue()) return;

    // 把当前 viewport 与正文区域的交集转换成“已读区间”。如果已经滚到文章底部，
    // completeRangeAtPageEnd 会把末尾误差补齐，避免最后几像素永远算未读。
    const visible = visibleRange(article);
    const range = visible
      ? completeRangeAtPageEnd(visible, isArticleScrolledToEnd(article), page.contentHeight)
      : null;

    // 正文完全不在视口里时不记录进度，但仍同步阅读地图，让当前视口高亮消失。
    if (!range) {
      renderReadingMapIfEnabled(null);
      lfdTrace('reading sample skipped: article outside viewport', {
        articleRect: article.getBoundingClientRect().toJSON?.() ?? null,
      });
      return;
    }
    const nextRanges = addViewedRange(ranges, range);

    // 只有新增可见区间真正改变了 ranges，才标记 dirty、更新 UI 快照并安排重绘。
    // 这样滚动事件很多时不会反复保存和重绘相同的数据。
    if (rangesChanged(ranges, nextRanges)) {
      ranges = nextRanges;
      dirty = true;
      lfdTrace('reading sample recorded', {
        range,
        ranges,
        url: page.url,
      });
      uiSnapshot = {
        pages: uiSnapshot.pages,
        progress: [
          ...uiSnapshot.progress.filter((entry) => entry.url !== page.url),
          {
            siteId,
            url: page.url,
            viewedRanges: ranges,
            viewedHeight: viewedHeight(ranges, page.contentHeight),
            updatedAt: Date.now(),
          },
        ],
      };
      scheduleRenderUi();
    }
    renderReadingMapIfEnabled(range);
  };

  const flush = async (render = true, isFinalFlush = false) => {
    if (!canFlush(isFinalFlush)) return;

    // 没有新采样结果就不写 background，避免周期性 flush 制造无意义写入。
    if (!dirty) {
      lfdTrace('reading flush skipped: no dirty ranges', { url: page.url });
      return;
    }
    dirty = false;

    // 保存成功后用 background 返回的规范 record 更新 UI 快照，保证展示和持久化数据一致。
    const record = await saveProgressToBackground(siteId, page.url, ranges, page.contentHeight);
    lfdDebug('reading progress saved', {
      siteId,
      url: page.url,
      viewedHeight: record.viewedHeight,
      contentHeight: page.contentHeight,
      ranges: record.viewedRanges,
    });
    uiSnapshot = {
      pages: uiSnapshot.pages,
      progress: [
        ...uiSnapshot.progress.filter((entry) => entry.url !== record.url),
        record,
      ],
    };
    if (render && !signal.aborted && canContinue()) await renderPageChrome();
  };

  // 启动时先采样一次并立即保存，处理“页面打开时正文已经在视口中”的情况。
  sample();
  await flush();
  if (signal.aborted || !canContinue()) return undefined;

  await renderPageChrome();

  // 文档站可能有内层滚动容器，所以除了 window/document，也监听正文的可滚动祖先。
  const scrollTargets = new Set<EventTarget>([window, document, ...scrollableAncestors(article)]);
  scrollTargets.forEach((target) => {
    target.addEventListener('scroll', sample, { passive: true, capture: target === document, signal });
  });
  window.addEventListener('resize', sample, { passive: true, signal });
  const flushInterval = globalThis.setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    // 页面切到后台前尽快保存，降低浏览器挂起/关闭导致进度丢失的概率。
    if (document.visibilityState === 'hidden') void flush();
  }, { signal });
  window.addEventListener('pagehide', () => void flush(false), { signal });
  const onSettingsChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName !== 'local' || !changes[APP_SETTINGS_STORAGE_KEY]) return;
    settings = normalizeAppSettings(changes[APP_SETTINGS_STORAGE_KEY].newValue);
    if (canContinue()) void renderPageChrome();
  };
  browser.storage.onChanged.addListener(onSettingsChanged);

  // 正文或页面导航发生 DOM 变化时，重新渲染进度 UI；采样仍由滚动/resize 负责。
  const observer = new MutationObserver(scheduleRenderUi);
  observer.observe(document.body, { childList: true, subtree: true });

  return async () => {
    // stop 函数负责清掉本函数手动注册的资源；带 signal 的事件监听会随 abort 自动移除。
    globalThis.clearInterval(flushInterval);
    if (renderTimer) globalThis.clearTimeout(renderTimer);
    observer.disconnect();
    browser.storage.onChanged.removeListener(onSettingsChanged);

    // 如果 owner 已经换成新 tracker，旧 tracker 不再 flush/移除 UI，避免误删新实例的界面。
    if (!isReadingTrackerOwner(document.documentElement, ownerId)) return;
    await flush(false, true);
    removeProgressUi();
  };
}
