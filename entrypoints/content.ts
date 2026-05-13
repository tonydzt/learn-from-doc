import { browser } from 'wxt/browser';
import { getAdapterForUrl } from '../src/adapters';
import { isSubdirectoryPage, pageProgressPercent, totalProgressPercent } from '../src/progress/calculations';
import { completeRangeAtPageEnd } from '../src/progress/completion';
import { readingMapSegments, viewportMapSegment } from '../src/progress/reading-map';
import { addViewedRange, mergeRanges, viewedHeight, type ViewedRange } from '../src/progress/ranges';
import { scrollableAncestors } from '../src/progress/scroll-targets';
import { APP_SETTINGS_STORAGE_KEY, normalizeAppSettings, type AppSettings } from '../src/settings/app-settings';
import { DATA_ATTR, FLUSH_INTERVAL_MS } from '../src/shared/constants';
import { waitForPageHydration } from '../src/shared/hydration';
import { lfdDebug, lfdTrace } from '../src/shared/logger';
import type { IndexLinksResponse, RuntimeMessage } from '../src/shared/messages';
import { isIndexingUrl, normalizePageUrl, siteIdFor } from '../src/shared/url';
import type { PageIndexRecord, ProgressRecord } from '../src/storage/db';
import { shouldStartTrackingOnVisibilityChange } from '../src/content/reading-lifecycle';

// 向 background 发送 runtime message。
// content script 不直接访问数据库和扩展管理页，统一通过 background 做数据读写和调度。
function sendRuntimeMessage<T>(message: RuntimeMessage): Promise<T> {
  return browser.runtime.sendMessage(message) as Promise<T>;
}

// 读取某个文档范围下的全部页面索引。
function getPagesFromBackground(siteId: string): Promise<PageIndexRecord[]> {
  return sendRuntimeMessage<PageIndexRecord[]>({ type: 'GET_SITE_PAGES', siteId });
}

// 读取当前 URL 对应的单页索引，用来判断当前页面是否已经被索引。
function getPageFromBackground(siteId: string, url: string): Promise<PageIndexRecord | undefined> {
  return sendRuntimeMessage<PageIndexRecord | undefined>({ type: 'GET_PAGE_RECORD', siteId, url });
}

// 读取某个文档范围下的全部阅读进度，用来计算总进度和页面 badge。
function getProgressForSiteFromBackground(siteId: string): Promise<ProgressRecord[]> {
  return sendRuntimeMessage<ProgressRecord[]>({ type: 'GET_SITE_PROGRESS', siteId });
}

// 保存当前页面的阅读区间；真正写 IndexedDB 的动作由 background 完成。
function saveProgressToBackground(siteId: string, url: string, ranges: ViewedRange[], contentHeight: number): Promise<ProgressRecord> {
  return sendRuntimeMessage<ProgressRecord>({ type: 'SAVE_PROGRESS_RECORD', siteId, url, ranges, contentHeight });
}

// 读取扩展全局设置，例如是否显示右侧阅读地图。
function getAppSettingsFromBackground(): Promise<AppSettings> {
  return sendRuntimeMessage<AppSettings>({ type: 'GET_APP_SETTINGS' });
}

type ReadingTrackerStop = () => Promise<void>;
type ProgressUiSnapshot = {
  pages: PageIndexRecord[];
  progress: ProgressRecord[];
};

const READING_HYDRATION_TIMEOUT_MS = 8000;
const READING_IDLE_TIMEOUT_MS = 1200;
const INDEXING_HYDRATION_TIMEOUT_MS = 500;
const INDEXING_IDLE_TIMEOUT_MS = 200;

function afterHydration(
  hydrationTimeoutMs = READING_HYDRATION_TIMEOUT_MS,
  idleTimeoutMs = READING_IDLE_TIMEOUT_MS,
): Promise<void> {
  // 文档站点通常先加载 HTML，再由 React/Docusaurus 接管页面。
  // 等页面框架 hydration 完成后再注入 UI，避免触发宿主 React hydration mismatch。
  return waitForPageHydration(document, hydrationTimeoutMs).then(() => new Promise((resolve) => {
    const run = () => resolve();
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: idleTimeoutMs });
      return;
    }
    globalThis.setTimeout(run, Math.min(idleTimeoutMs, 500));
  }));
}

function navigationLoadMs(): number | undefined {
  const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const loadMs = entry?.loadEventEnd;
  return loadMs && loadMs > 0 ? Math.round(loadMs) : undefined;
}

function resourceCount(): number {
  return performance.getEntriesByType('resource').length;
}

function topImageDurations(): number[] {
  return (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
    .filter((entry) => entry.initiatorType === 'img')
    .map((entry) => Math.round(entry.duration))
    .sort((a, b) => b - a)
    .slice(0, 5);
}

// 读取正文区域的渲染高度；scrollHeight 和 bounding rect 取较大值，减少布局差异带来的低估。
function articleHeight(article: HTMLElement): number {
  return Math.max(article.scrollHeight, article.getBoundingClientRect().height, 1);
}

// 计算正文元素当前进入 viewport 的高度区间。
function visibleRange(article: HTMLElement): ViewedRange | null {
  // 把“当前视口看到了正文的哪一段”转换为正文内部的高度区间。
  // 例如 start=500/end=1200 表示正文第 500px 到 1200px 被看过。
  const rect = article.getBoundingClientRect();
  const viewportTop = 0;
  const viewportBottom = window.innerHeight || document.documentElement.clientHeight;
  const visibleTop = Math.max(rect.top, viewportTop);
  const visibleBottom = Math.min(rect.bottom, viewportBottom);
  if (visibleBottom <= visibleTop) return null;

  const start = visibleTop - rect.top;
  const end = visibleBottom - rect.top;
  return { start, end };
}

function isArticleScrolledToEnd(article: HTMLElement): boolean {
  const rect = article.getBoundingClientRect();
  const viewportBottom = window.innerHeight || document.documentElement.clientHeight;
  return rect.bottom <= viewportBottom + 2;
}

// 注入本扩展页面内 UI 需要的 CSS。用 DATA_ATTR 防止重复插入 style 标签。
function injectStyles() {
  if (document.querySelector(`[${DATA_ATTR}="styles"]`)) return;
  const style = document.createElement('style');
  style.setAttribute(DATA_ATTR, 'styles');
  style.textContent = `
    .lfd-total-card {
      box-sizing: border-box;
      margin: 0 0 14px;
      padding: 12px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 8px;
      background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(246,248,251,.96));
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
      color: #111827;
      font: 500 12px/1.35 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .lfd-total-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }
    .lfd-total-title {
      color: #475569;
      letter-spacing: .01em;
    }
    .lfd-total-value {
      color: #0f766e;
      font-weight: 750;
    }
    .lfd-total-track {
      overflow: hidden;
      height: 7px;
      border-radius: 999px;
      background: #e2e8f0;
    }
    .lfd-total-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #14b8a6, #0f766e);
      transition: width 180ms ease;
    }
    .lfd-page-badge {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      margin-left: 7px;
      padding: 1px 6px;
      border-radius: 999px;
      background: rgba(20, 184, 166, 0.1);
      color: #0f766e;
      font: 700 10px/1.5 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      vertical-align: middle;
      white-space: nowrap;
    }
    .lfd-page-link-with-badge {
      display: flex !important;
      align-items: center;
      gap: 7px;
    }
    .lfd-page-link-with-badge > :not([data-learn-from-doc="page-badge"]) {
      flex: 1 1 auto;
      min-width: 0;
    }
    .lfd-page-link-with-badge > .lfd-page-badge {
      margin-left: 0;
    }
    .lfd-subdirectory-badge {
      background: rgba(220, 38, 38, 0.1);
      color: #dc2626;
    }
    .lfd-reading-map {
      position: fixed;
      top: 0;
      bottom: 0;
      right: 18px;
      z-index: 2147483646;
      width: 8px;
      border-left: 1px solid rgba(15, 23, 42, 0.1);
      border-right: 1px solid rgba(255, 255, 255, 0.54);
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.04), rgba(15, 23, 42, 0.015));
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.44), 0 0 18px rgba(15, 23, 42, 0.1);
      overflow: hidden;
      pointer-events: none;
    }
    .lfd-reading-map-segment {
      position: absolute;
      left: 1px;
      right: 1px;
      border-radius: 999px;
      background: linear-gradient(180deg, #34d399, #059669);
      box-shadow: 0 0 10px rgba(5, 150, 105, 0.38);
    }
    .lfd-reading-map-viewport {
      position: absolute;
      left: -2px;
      right: -2px;
      min-height: 10px;
      border: 1px solid rgba(6, 78, 59, 0.72);
      border-radius: 999px;
      background: rgba(236, 253, 245, 0.72);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.78), 0 2px 9px rgba(6, 78, 59, 0.24);
    }
  `;
  document.documentElement.append(style);
}

// 把数值百分比格式化成整数百分比文本。
function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

// 在 react.dev 左侧导航注入总进度卡片和每个页面链接后的进度 badge。
async function renderProgressUi(siteId: string, snapshot?: ProgressUiSnapshot) {
  // 页面内 UI 是直接注入到 react.dev DOM 里的，不是 React 组件。
  // MutationObserver 触发重渲染时会重复调用这里，所以优先使用内存快照减少 message 往返。
  const adapter = getAdapterForUrl(location.href);
  const targets = adapter?.getProgressInsertionTargets();
  if (!targets) return;

  const [pages, progress] = snapshot
    ? [snapshot.pages, snapshot.progress]
    : await Promise.all([
      getPagesFromBackground(siteId),
      getProgressForSiteFromBackground(siteId),
    ]);
  // 用 URL 对齐 page 和 progress，因为 IndexedDB 里这两类记录是分开存的。
  const progressByUrl = new Map(progress.map((entry) => [entry.url, entry]));
  const pageByUrl = new Map(pages.map((page) => [page.url, page]));

  injectStyles();

  let totalCard = targets.sidebarRoot.querySelector<HTMLElement>('[data-learn-from-doc="total"]');
  if (!totalCard) {
    totalCard = document.createElement('div');
    totalCard.className = 'lfd-total-card';
    totalCard.setAttribute(DATA_ATTR, 'total');
    totalCard.innerHTML = `
      <div class="lfd-total-row">
        <span class="lfd-total-title">Doc progress</span>
        <span class="lfd-total-value">0%</span>
      </div>
      <div class="lfd-total-track"><div class="lfd-total-fill"></div></div>
    `;
    // adapter 提供插入位置，避免核心逻辑猜测 react.dev 的 DOM 结构。
    targets.sidebarRoot.insertBefore(totalCard, targets.totalProgressBefore);
  }

  const total = totalProgressPercent(pages, progress);
  totalCard.querySelector<HTMLElement>('.lfd-total-value')!.textContent = formatPercent(total);
  totalCard.querySelector<HTMLElement>('.lfd-total-fill')!.style.width = `${total}%`;

  const targetAnchors = new Set(targets.pageLinkTargets.map((target) => target.anchor));
  targets.sidebarRoot.querySelectorAll<HTMLElement>('[data-learn-from-doc="page-badge"]').forEach((badge) => {
    const anchor = badge.closest('a');
    if (!anchor || !targetAnchors.has(anchor)) {
      anchor?.classList.remove('lfd-page-link-with-badge');
      badge.remove();
    }
  });

  for (const target of targets.pageLinkTargets) {
    const page = pageByUrl.get(target.url);
    const existing = target.anchor.querySelector<HTMLElement>('[data-learn-from-doc="page-badge"]');
    const badge = existing ?? document.createElement('span');
    target.anchor.classList.add('lfd-page-link-with-badge');
    badge.className = 'lfd-page-badge';
    badge.setAttribute(DATA_ATTR, 'page-badge');
    if (isSubdirectoryPage(page)) {
      badge.classList.add('lfd-subdirectory-badge');
      badge.textContent = '子目录';
    } else {
      badge.classList.remove('lfd-subdirectory-badge');
      badge.textContent = formatPercent(pageProgressPercent(page, progressByUrl.get(target.url)));
    }
    if (!existing) target.anchor.append(badge);
  }
}

// 移除右侧阅读地图；关闭设置、页面无效或 tracker 停止时会调用。
function removeReadingMap() {
  document.querySelector<HTMLElement>('[data-learn-from-doc="reading-map"]')?.remove();
}

// 渲染右侧阅读地图：已读区间显示为绿色段，当前 viewport 显示为浅色浮层。
function renderReadingMap(ranges: ViewedRange[], viewportRange: ViewedRange | null, contentHeight: number) {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) {
    removeReadingMap();
    return;
  }

  injectStyles();

  let map = document.querySelector<HTMLElement>('[data-learn-from-doc="reading-map"]');
  if (!map) {
    map = document.createElement('div');
    map.className = 'lfd-reading-map';
    map.setAttribute(DATA_ATTR, 'reading-map');
    map.setAttribute('aria-hidden', 'true');
    document.documentElement.append(map);
  }

  const children: HTMLElement[] = [];
  for (const segment of readingMapSegments(ranges, contentHeight)) {
    const element = document.createElement('div');
    element.className = 'lfd-reading-map-segment';
    element.style.top = `${segment.top}%`;
    element.style.height = `${segment.height}%`;
    children.push(element);
  }

  const viewport = viewportMapSegment(viewportRange, contentHeight);
  if (viewport) {
    const element = document.createElement('div');
    element.className = 'lfd-reading-map-viewport';
    element.style.top = `${viewport.top}%`;
    element.style.height = `${viewport.height}%`;
    children.push(element);
  }

  // replaceChildren 让每次渲染都以当前 ranges 为准，避免旧段残留。
  map.replaceChildren(...children);
}

async function collectIndexLinks(): Promise<IndexLinksResponse> {
  // 创建索引的第一步：让当前页面的 adapter 展开左侧导航，并收集属于当前文档范围的链接。
  const adapter = getAdapterForUrl(location.href);
  const scope = adapter?.getDocScope();
  if (!adapter || !scope) throw new Error('Current page is not supported.');

  await adapter.expandLazyNavigation();
  // background 只需要 URL 和标题，DOM element 留在 content script 内部使用。
  const links = adapter.getSidebarLinks().map((link) => ({ url: link.url, title: link.title }));
  lfdDebug('collected index links in page', {
    scope,
    count: links.length,
    links,
  });
  return {
    ...scope,
    links,
  };
}

async function runIndexMeasurement() {
  // background 打开的测量 tab 会带索引 hash。这个模式只测正文高度并回传，
  // 不启动阅读 tracker，避免“机器打开页面”被误认为用户阅读。
  const startedAt = performance.now();
  await afterHydration(INDEXING_HYDRATION_TIMEOUT_MS, INDEXING_IDLE_TIMEOUT_MS);
  const afterHydrationMs = Math.round(performance.now() - startedAt);
  const adapter = getAdapterForUrl(location.href);
  const indexable = adapter?.isPageIndexable?.() ?? true;
  const article = adapter?.getArticleRoot();
  lfdDebug('indexing measurement page loaded', {
    url: location.href,
    adapterFound: Boolean(adapter),
    indexable,
    articleFound: Boolean(article),
  });
  const measureStartedAt = performance.now();
  const skippedReason = !adapter
    ? 'adapter not found'
    : indexable && !article
      ? 'article not found'
      : !indexable
        ? 'page not indexable'
        : undefined;
  const payload = {
    url: normalizePageUrl(location.href),
    // 站点标题通常带站点后缀，这里去掉后缀，保留更适合作为页面标题的部分。
    title: document.title.replace(/\s+[-–]\s+React$/, '').trim() || location.pathname,
    contentHeight: !skippedReason && article ? Math.ceil(articleHeight(article)) : 0,
    skippedReason,
    timing: {
      afterHydrationMs,
      articleMeasureMs: Math.round(performance.now() - measureStartedAt),
      navigationLoadMs: navigationLoadMs(),
      resourceCount: resourceCount(),
      topImageDurations: topImageDurations(),
    },
  };
  try {
    const response = await browser.runtime.sendMessage({
      type: 'INDEX_PAGE_MEASURED',
      payload,
    } satisfies RuntimeMessage);
    lfdDebug('indexing measurement message sent', { response });
  } catch (error) {
    const details = {
      message: error instanceof Error ? error.message : String(error),
    };
    lfdDebug('indexing measurement message failed', details);
  }
}

async function runReadingTracker(signal: AbortSignal): Promise<ReadingTrackerStop | undefined> {
  // 普通阅读模式的生命周期：定位正文 -> 采样可见区间 -> 合并到内存 -> 定期 flush 到 background。
  // AbortSignal 用来在 SPA 路由切换或 content script 失效时停止旧 tracker。
  await afterHydration();
  if (signal.aborted) return undefined;

  const adapter = getAdapterForUrl(location.href);
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
  const page = await getPageFromBackground(siteId, normalizePageUrl(location.href));
  if (signal.aborted) return undefined;

  if (!page) {
    // 已支持但当前 URL 不在索引里时不注入 UI、不记录进度，避免污染未索引页面。
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

  const [sitePages, siteProgress] = await Promise.all([
    getPagesFromBackground(siteId),
    getProgressForSiteFromBackground(siteId),
  ]);
  if (signal.aborted) return undefined;

  let uiSnapshot: ProgressUiSnapshot = {
    pages: sitePages,
    progress: siteProgress,
  };
  let settings = await getAppSettingsFromBackground();
  if (signal.aborted) return undefined;

  // tracker 启动时先恢复历史 ranges，后续滚动只在内存里合并，定期 flush。
  let ranges = mergeRanges(siteProgress.find((entry) => entry.url === page.url)?.viewedRanges ?? []);
  let dirty = false;
  let renderTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  lfdDebug('reading tracker started', {
    siteId,
    url: page.url,
    contentHeight: page.contentHeight,
    initialRanges: ranges,
  });

  const sample = () => {
    if (signal.aborted) return;

    const visible = visibleRange(article);
    const range = visible
      ? completeRangeAtPageEnd(visible, isArticleScrolledToEnd(article), page.contentHeight)
      : null;
    if (!range) {
      renderReadingMapIfEnabled(null);
      lfdTrace('reading sample skipped: article outside viewport', {
        articleRect: article.getBoundingClientRect().toJSON?.() ?? null,
      });
      return;
    }
    const nextRanges = addViewedRange(ranges, range);
    if (JSON.stringify(nextRanges) !== JSON.stringify(ranges)) {
      // 只有真正新增已读区间时才标记 dirty，重复看同一区域不会触发保存。
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

  // 页面内导航可能被 react.dev 重新渲染；renderUi 用快照重建注入节点。
  const renderUi = () => renderProgressUi(siteId, uiSnapshot);
  const renderReadingMapIfEnabled = (range: ViewedRange | null) => {
    if (!settings.showReadingMap) {
      removeReadingMap();
      return;
    }
    renderReadingMap(ranges, range, page.contentHeight);
  };
  const renderPageChrome = async () => {
    await renderUi();
    renderReadingMapIfEnabled(visibleRange(article));
  };
  const scheduleRenderUi = () => {
    if (signal.aborted || renderTimer) return;
    // 防抖 MutationObserver 的高频触发，避免页面重渲染时频繁刷新扩展 UI。
    renderTimer = globalThis.setTimeout(() => {
      renderTimer = undefined;
      void renderPageChrome();
    }, 300);
  };

  const flush = async (render = true) => {
    // dirty=false 时不发消息；只有新增可见区间后才保存，类似后端里的“脏写回”策略。
    if (!dirty) {
      lfdTrace('reading flush skipped: no dirty ranges', { url: page.url });
      return;
    }
    dirty = false;
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
    // 保存后同步更新内存快照，后续 UI 刷新不用再向 background 拉全量 progress。
    if (render && !signal.aborted) await renderPageChrome();
  };

  // 启动时立即采样一次，确保打开页面时已经可见的正文会被记录。
  sample();
  await flush();
  if (signal.aborted) return undefined;

  await renderPageChrome();

  const scrollTargets = new Set<EventTarget>([window, document, ...scrollableAncestors(article)]);
  scrollTargets.forEach((target) => {
    target.addEventListener('scroll', sample, { passive: true, capture: target === document, signal });
  });
  window.addEventListener('resize', sample, { passive: true, signal });
  const flushInterval = globalThis.setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    // 标签页切到后台前尽量保存，减少用户关闭页面时丢进度的概率。
    if (document.visibilityState === 'hidden') void flush();
  }, { signal });
  window.addEventListener('pagehide', () => void flush(false), { signal });
  const onSettingsChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName !== 'local' || !changes[APP_SETTINGS_STORAGE_KEY]) return;
    // options 页面切换设置后，content script 可即时响应，不需要刷新页面。
    settings = normalizeAppSettings(changes[APP_SETTINGS_STORAGE_KEY].newValue);
    renderReadingMapIfEnabled(visibleRange(article));
  };
  browser.storage.onChanged.addListener(onSettingsChanged);

  // react.dev 是 React 应用，左侧导航可能被重建；监听 DOM 变化后恢复扩展注入的节点。
  const observer = new MutationObserver(scheduleRenderUi);
  observer.observe(document.body, { childList: true, subtree: true });

  // 返回 stop 函数给外层，用于 SPA 路由切换或 content script 失效时清理事件和保存进度。
  return async () => {
    globalThis.clearInterval(flushInterval);
    if (renderTimer) globalThis.clearTimeout(renderTimer);
    observer.disconnect();
    browser.storage.onChanged.removeListener(onSettingsChanged);
    await flush(false);
    removeReadingMap();
  };
}

export default defineContentScript({
  matches: [
    'https://react.dev/*',
    'https://playwright.dev/docs*',
    'https://developers.openai.com/*',
  ],
  runAt: 'document_end',
  async main(ctx) {
    // content script 入口。WXT 会在匹配的页面注入它，但实际是否处理仍由 adapter 决定。
    if (!getAdapterForUrl(location.href)) return;

    let activeTracker: { controller: AbortController; stop: ReadingTrackerStop } | undefined;
    let routeVersion = 0;

    const stopTracking = async () => {
      // 停止当前阅读 tracker：中断事件监听、flush 未保存进度、移除页面内 UI。
      const tracker = activeTracker;
      activeTracker = undefined;
      if (!tracker) return;
      tracker.controller.abort();
      await tracker.stop();
    };

    const startTracking = async (reason: string) => {
      // React Docs 是 SPA：左侧导航跳转不会重新加载 content script。
      // routeVersion 用来丢弃已经过期的异步启动结果，避免旧页面 tracker 覆盖新页面。
      const version = ++routeVersion;
      await stopTracking();

      if (isIndexingUrl(location.href) || !getAdapterForUrl(location.href)) return;

      lfdDebug('reading tracker route start requested', {
        reason,
        url: location.href,
        normalizedUrl: normalizePageUrl(location.href),
      });

      const controller = new AbortController();
      const stop = await runReadingTracker(controller.signal);
      if (!stop) return;

      if (version !== routeVersion || controller.signal.aborted) {
        // 启动过程中如果路由又变了，立即停止这个过期 tracker。
        controller.abort();
        await stop();
        return;
      }

      activeTracker = { controller, stop };
    };

    browser.runtime.onMessage.addListener((message: RuntimeMessage) => {
      // background.startIndex 使用：创建索引前收集当前页面左侧导航链接。
      if (message.type === 'COLLECT_INDEX_LINKS') return collectIndexLinks();
      // background 保存索引后通知原页面刷新 tracker。
      if (message.type === 'INDEX_PROGRESS_UPDATED') return startTracking('index-progress-updated');
      return undefined;
    });

    ctx.addEventListener(window, 'wxt:locationchange', () => {
      // react.dev 是 SPA，左侧导航跳转不会重新注入 content script，需要手动重启 tracker。
      void startTracking('locationchange');
    });
    ctx.addEventListener(document, 'visibilitychange', () => {
      // 后台标签页首次注入时可能还没有可用正文，变为可见后补一次启动。
      if (shouldStartTrackingOnVisibilityChange(document.visibilityState, Boolean(activeTracker))) {
        void startTracking('visibilitychange');
      }
    });
    ctx.onInvalidated(() => {
      // 扩展热更新、页面卸载等场景下清理当前 tracker。
      void stopTracking();
    });

    if (isIndexingUrl(location.href)) {
      // background 打开的临时测量页只走索引测量流程，不记录阅读进度。
      await runIndexMeasurement();
      return;
    }

    await startTracking('initial-load');
  },
});
