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
  deletePageProgressFromBackground,
  getPageFromBackground,
  getPageSettingsFromBackground,
  getPagesFromBackground,
  getProgressForSiteFromBackground,
  getSiteSettingsFromBackground,
  saveProgressToBackground,
} from './runtime-client';
import { isSubdirectoryPage } from '../progress/calculations';

export type ReadingTrackerStop = (options?: { removeUi?: boolean }) => Promise<void>;

function rangesChanged(current: ViewedRange[], next: ViewedRange[]): boolean {
  if (current.length !== next.length) return true;
  return current.some((range, index) => range.start !== next[index]?.start || range.end !== next[index]?.end);
}

const INITIAL_ARTICLE_STABILITY_MS = 350;

export async function runReadingTracker(signal: AbortSignal): Promise<ReadingTrackerStop | undefined> {
  const trackedUrl = normalizePageUrl(location.href);
  const scrollDocument = document;
  const pageLocation = window.location;

  // tracker 只在启动时的 normalized URL 上继续运行；SPA 切换或 abort 后停止普通采样/保存。
  const canContinue = () => shouldContinueTracking({
    isSignalAborted: signal.aborted,
    trackedUrl,
    currentUrl: normalizePageUrl(pageLocation.href),
  });

  // 普通 flush 要求 tracker 还没被 abort，且 URL 没变；最终清理 flush 放宽 URL/abort 限制，
  // 尽量把最后一段阅读进度写回 background。
  const canFlush = (isFinalFlush: boolean) => shouldFlushTrackingProgress({
    isFinalFlush,
    isSignalAborted: signal.aborted,
    trackedUrl,
    currentUrl: normalizePageUrl(pageLocation.href),
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
  let article = adapter?.getArticleRoot();
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
  const normalizedUrl = normalizePageUrl(location.href);
  const pagePromise = getPageFromBackground(siteId, normalizedUrl);
  const appSettingsPromise = getAppSettingsFromBackground();
  const pageSettingsPromise = getPageSettingsFromBackground(siteId, normalizedUrl);
  const [siteSettings, pageSettings, page, initialSettings] = await Promise.all([
    siteSettingsPromise,
    pageSettingsPromise,
    pagePromise,
    appSettingsPromise,
  ]);
  if (signal.aborted || !canContinue()) return undefined;

  const recordingEnabled = shouldStartReadingTracker({
    siteReadingProgressEnabled: siteSettings.readingProgressEnabled,
    pageReadingProgressEnabled: pageSettings.readingProgressEnabled,
    defaultPageReadingProgressEnabled: initialSettings.defaultPageReadingProgressEnabled,
  });
  if (siteSettings.readingProgressEnabled === false) {
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
  let settings = initialSettings;
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

// ------------- start: 这一段是用来优化某些页面，加载时通过content script获取到正文的articel dom节点，但是水合之后，这个articel dom节点会被替换掉，但是tracker持有的还是老的dom，导致阅读进度记录失效 -----------------
  // 这个函数值用来在打日志时，计算日志相关的字段值
  // 日志里保留旧/新正文节点的尺寸，方便判断是 DOM 被替换还是节点临时变成 0x0。
  const articleRectSnapshot = (element: HTMLElement | null) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  };

  // 某些文档站水合后会替换正文 DOM；旧节点可能还被 tracker 缓存着，但已经断开或没有布局尺寸。
  const isUsableArticle = (element: HTMLElement | null): element is HTMLElement => {
    if (!element?.isConnected) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  let scrollTargets = new Set<EventTarget>();
  const removeScrollListeners = () => {
    scrollTargets.forEach((target) => {
      target.removeEventListener('scroll', sample, target === scrollDocument);
    });
    scrollTargets = new Set();
  };
  const bindScrollListeners = (root: HTMLElement) => {
    removeScrollListeners();
    // article 变了以后，可滚动祖先也可能变；先清旧监听，再按当前正文节点重绑。
    scrollTargets = new Set<EventTarget>([window, scrollDocument, ...scrollableAncestors(root)]);
    scrollTargets.forEach((target) => {
      target.addEventListener('scroll', sample, { passive: true, capture: target === scrollDocument });
    });
  };

  const currentArticle = (reason: 'render' | 'sample' | 'mutation'): HTMLElement | null => {
    if (isUsableArticle(article)) return article;

    // 使用前发现正文节点失效时，重新通过 adapter 定位。这样滚动采样不会继续拿 0x0 旧节点算进度。
    const previous = article;
    const next = adapter.getArticleRoot();
    lfdDebug('reading tracker article root refreshed', {
      siteId,
      url: page.url,
      reason,
      previousConnected: previous?.isConnected ?? false,
      previousRect: articleRectSnapshot(previous),
      nextFound: Boolean(next),
      nextRect: articleRectSnapshot(next),
    });
    article = next;
    if (article) bindScrollListeners(article);
    return article;
  };

// ------------- end: 上面这一段是用来优化某些页面，加载时通过content script获取到正文的articel dom节点，但是水合之后，这个articel dom节点会被替换掉，但是tracker持有的还是老的dom，导致阅读进度记录失效 -----------------

  // 插入阅读进度 UI函数
  const renderUi = () => renderProgressUi(siteId, settings.language, uiSnapshot, {
    onDeletePageProgress: (url) => void deletePageProgress(url),
  });

  // 处理从 progress-ui 点击删除图标触发的删除请求。
  // 需要与当前 tracker 的内存状态同步：
  // 1) 如果删除的是当前页，重置 ranges/dirty，防止后续 flush 又写回被删除的进度。
  // 2) 从 uiSnapshot.progress 中移除该记录，后续重渲染才能反映出进度被清除。
  const deletePageProgress = async (url: string) => {
    if (!canContinue()) return;
    try {
      await deletePageProgressFromBackground(siteId, url);
    } catch (error) {
      lfdDebug('delete page progress failed', { siteId, url, error });
      return;
    }
    if (url === page.url) {
      ranges = [];
      dirty = false;
    }
    uiSnapshot = {
      pages: uiSnapshot.pages,
      progress: uiSnapshot.progress.filter((entry) => entry.url !== url),
    };
    if (!signal.aborted && canContinue()) await renderPageChrome();
  };

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
    const root = currentArticle('render');
    renderReadingMapIfEnabled(root ? visibleRange(root) : null);
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
    const root = currentArticle('sample');
    const visible = root ? visibleRange(root) : null;
    const range = visible
      ? completeRangeAtPageEnd(visible, isArticleScrolledToEnd(root), page.contentHeight)
      : null;

    // 正文完全不在视口里时不记录进度，但仍同步阅读地图，让当前视口高亮消失。
    if (!range) {
      renderReadingMapIfEnabled(null);
      lfdTrace('reading sample skipped: article outside viewport', {
        articleRect: articleRectSnapshot(root),
      });
      return;
    }
    const nextRanges = addViewedRange(ranges, range);
    if (!recordingEnabled) {
      renderReadingMapIfEnabled(range);
      lfdTrace('reading sample skipped: page recording disabled', {
        range,
        url: page.url,
      });
      return;
    }

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

// ------------- start: 这一段是用来优化某些Material for MkDocs框架的网站，开启了instant navigation，路由切换时URL可能已经变成新页面，但旧正文 DOM 还没被替换，导致采样时把旧页面的阅读进度带到了新页面的问题 -----------------

  // 对显式开启 requiresStableInitialArticle 的站点，首次采样后短暂观察正文节点。
  // 如果这段时间内正文被替换，说明首次采样可能读到了上一页的正文，调用方需要丢弃这次采样。
  const waitForInitialArticleReplacement = (sampledArticle: HTMLElement): Promise<boolean> => {
    if (!adapter.requiresStableInitialArticle) return Promise.resolve(false);

    return new Promise((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof globalThis.setTimeout> | undefined;

      const done = (wasReplaced: boolean) => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        if (timer) globalThis.clearTimeout(timer);
        resolve(wasReplaced);
      };

      const check = () => {
        if (signal.aborted || !canContinue()) {
          done(false);
          return;
        }
        const next = adapter.getArticleRoot();
        if (next && next !== sampledArticle && isUsableArticle(next)) {
          article = next;
          bindScrollListeners(article);
          done(true);
          return;
        }
        if (!isUsableArticle(sampledArticle)) {
          currentArticle('mutation');
          done(true);
        }
      };

      const observer = new MutationObserver(check);
      observer.observe(document.body, { childList: true, subtree: true });
      timer = globalThis.setTimeout(() => done(false), INITIAL_ARTICLE_STABILITY_MS);
      check();
    });
  };

  // 回滚首次采样造成的内存状态。
  // 只用于“首次采样后发现正文被替换”的场景，避免把旧页面可见区间写入当前页面进度。
  const restoreProgressSnapshot = (initialRanges: ViewedRange[], initialProgress: ProgressUiSnapshot['progress'][number] | undefined) => {
    ranges = initialRanges;
    dirty = false;
    uiSnapshot = {
      pages: uiSnapshot.pages,
      progress: [
        ...uiSnapshot.progress.filter((entry) => entry.url !== page.url),
        ...(initialProgress ? [initialProgress] : []),
      ],
    };
  };

// ------------- end: 这一段是用来优化某些Material for MkDocs框架的网站，开启了instant navigation，路由切换时URL可能已经变成新页面，但旧正文 DOM 还没被替换，导致采样时把旧页面的阅读进度带到了新页面的问题 -----------------

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
  const initialArticle = currentArticle('sample');
  const initialRanges = ranges;
  const initialProgress = uiSnapshot.progress.find((entry) => entry.url === page.url);
  sample();
  if (initialArticle && await waitForInitialArticleReplacement(initialArticle)) {
    restoreProgressSnapshot(initialRanges, initialProgress);
    sample();
  }
  await flush();
  if (signal.aborted || !canContinue()) return undefined;

  await renderPageChrome();

  // 文档站可能有内层滚动容器，所以除了 window/document，也监听正文的可滚动祖先。
  bindScrollListeners(article);
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

  // 正文或页面导航发生 DOM 变化时，先检查正文节点是否被替换，再重新渲染进度 UI。
  // 如果这里没捕获到，后续 render/sample 调用 currentArticle 时仍会兜底刷新。
  const observer = new MutationObserver(() => {
    currentArticle('mutation');
    scheduleRenderUi();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return async (options: { removeUi?: boolean } = {}) => {
    // stop 函数负责清掉本函数手动注册的资源；带 signal 的事件监听会随 abort 自动移除。
    globalThis.clearInterval(flushInterval);
    if (renderTimer) globalThis.clearTimeout(renderTimer);
    removeScrollListeners();
    observer.disconnect();
    browser.storage.onChanged.removeListener(onSettingsChanged);

    await flush(false, true);
    if (options.removeUi !== false) removeProgressUi();
  };
}
