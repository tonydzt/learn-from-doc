import { browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { getAdapterForUrl } from '../src/adapters';
import { pageProgressPercent, totalProgressPercent } from '../src/progress/calculations';
import { readingMapSegments, viewportMapSegment } from '../src/progress/reading-map';
import { addViewedRange, mergeRanges, type ViewedRange } from '../src/progress/ranges';
import { DATA_ATTR, FLUSH_INTERVAL_MS } from '../src/shared/constants';
import { lfdDebug, lfdTrace } from '../src/shared/logger';
import type { IndexLinksResponse, PageContextResponse, RuntimeMessage } from '../src/shared/messages';
import { isIndexingDebugUrl, isIndexingUrl, normalizePageUrl, siteIdFor } from '../src/shared/url';
import type { PageIndexRecord, ProgressRecord, SiteRecord } from '../src/storage/db';

function sendRuntimeMessage<T>(message: RuntimeMessage): Promise<T> {
  return browser.runtime.sendMessage(message) as Promise<T>;
}

function getSiteFromBackground(siteId: string): Promise<SiteRecord | undefined> {
  return sendRuntimeMessage<SiteRecord | undefined>({ type: 'GET_SITE_RECORD', siteId });
}

function getPagesFromBackground(siteId: string): Promise<PageIndexRecord[]> {
  return sendRuntimeMessage<PageIndexRecord[]>({ type: 'GET_SITE_PAGES', siteId });
}

function getPageFromBackground(siteId: string, url: string): Promise<PageIndexRecord | undefined> {
  return sendRuntimeMessage<PageIndexRecord | undefined>({ type: 'GET_PAGE_RECORD', siteId, url });
}

function getProgressForSiteFromBackground(siteId: string): Promise<ProgressRecord[]> {
  return sendRuntimeMessage<ProgressRecord[]>({ type: 'GET_SITE_PROGRESS', siteId });
}

function getProgressFromBackground(siteId: string, url: string): Promise<ProgressRecord | undefined> {
  return sendRuntimeMessage<ProgressRecord | undefined>({ type: 'GET_PROGRESS_RECORD', siteId, url });
}

function saveProgressToBackground(siteId: string, url: string, ranges: ViewedRange[], contentHeight: number): Promise<ProgressRecord> {
  return sendRuntimeMessage<ProgressRecord>({ type: 'SAVE_PROGRESS_RECORD', siteId, url, ranges, contentHeight });
}

type ReadingTrackerStop = () => Promise<void>;
type ProgressUiSnapshot = {
  pages: PageIndexRecord[];
  progress: ProgressRecord[];
};

function afterHydration(): Promise<void> {
  return new Promise((resolve) => {
    const run = () => resolve();
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 1200 });
      return;
    }
    globalThis.setTimeout(run, 500);
  });
}

function articleHeight(article: HTMLElement): number {
  return Math.max(article.scrollHeight, article.getBoundingClientRect().height, 1);
}

function visibleRange(article: HTMLElement): ViewedRange | null {
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

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function renderDebugStatus(message: string, details?: unknown) {
  let panel = document.querySelector<HTMLElement>('[data-learn-from-doc="debug-status"]');
  if (!panel) {
    panel = document.createElement('pre');
    panel.setAttribute(DATA_ATTR, 'debug-status');
    panel.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:2147483647',
      'max-width:520px',
      'max-height:260px',
      'overflow:auto',
      'margin:0',
      'padding:12px',
      'border:1px solid rgba(15,23,42,.18)',
      'border-radius:8px',
      'background:#111827',
      'color:#e5e7eb',
      'font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace',
      'white-space:pre-wrap',
      'box-shadow:0 16px 40px rgba(15,23,42,.28)',
    ].join(';');
    document.documentElement.append(panel);
  }
  panel.textContent = `[learn-from-doc]\n${message}\n${details === undefined ? '' : JSON.stringify(details, null, 2)}`;
}

async function renderProgressUi(siteId: string, snapshot?: ProgressUiSnapshot) {
  const adapter = getAdapterForUrl(location.href);
  const targets = adapter?.getProgressInsertionTargets();
  if (!targets) return;

  const [pages, progress] = snapshot
    ? [snapshot.pages, snapshot.progress]
    : await Promise.all([
      getPagesFromBackground(siteId),
      getProgressForSiteFromBackground(siteId),
    ]);
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
    targets.sidebarRoot.insertBefore(totalCard, targets.totalProgressBefore);
  }

  const total = totalProgressPercent(pages, progress);
  totalCard.querySelector<HTMLElement>('.lfd-total-value')!.textContent = formatPercent(total);
  totalCard.querySelector<HTMLElement>('.lfd-total-fill')!.style.width = `${total}%`;

  for (const target of targets.pageLinkTargets) {
    const existing = target.anchor.querySelector<HTMLElement>('[data-learn-from-doc="page-badge"]');
    const badge = existing ?? document.createElement('span');
    badge.className = 'lfd-page-badge';
    badge.setAttribute(DATA_ATTR, 'page-badge');
    badge.textContent = formatPercent(pageProgressPercent(pageByUrl.get(target.url), progressByUrl.get(target.url)));
    if (!existing) target.anchor.append(badge);
  }
}

function removeReadingMap() {
  document.querySelector<HTMLElement>('[data-learn-from-doc="reading-map"]')?.remove();
}

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

  map.replaceChildren(...children);
}

async function getPageContext(): Promise<PageContextResponse> {
  const adapter = getAdapterForUrl(location.href);
  const scope = adapter?.getDocScope();
  if (!adapter || !scope) return { supported: false, indexed: false };

  const siteId = siteIdFor(scope.host, scope.scopeKey);
  const site = await getSiteFromBackground(siteId);
  if (!site) {
    return {
      supported: true,
      indexed: false,
      host: scope.host,
      scopeKey: scope.scopeKey,
      scopeTitle: scope.scopeTitle,
      currentUrl: normalizePageUrl(location.href),
    };
  }

  const [pages, progress, currentPage, currentProgress] = await Promise.all([
    getPagesFromBackground(siteId),
    getProgressForSiteFromBackground(siteId),
    getPageFromBackground(siteId, normalizePageUrl(location.href)),
    getProgressFromBackground(siteId, normalizePageUrl(location.href)),
  ]);
  lfdDebug('page context loaded', {
    siteId,
    currentUrl: normalizePageUrl(location.href),
    pageCount: pages.length,
    progressCount: progress.length,
    currentPageIndexed: Boolean(currentPage),
    currentPage,
    currentProgress,
  });

  return {
    supported: true,
    indexed: true,
    host: scope.host,
    scopeKey: scope.scopeKey,
    scopeTitle: scope.scopeTitle,
    site,
    currentUrl: normalizePageUrl(location.href),
    totalPercent: totalProgressPercent(pages, progress),
    pagePercent: pageProgressPercent(currentPage, currentProgress),
    pageCount: pages.length,
    currentPageIndexed: Boolean(currentPage),
    currentPageContentHeight: currentPage?.contentHeight,
    currentViewedHeight: currentProgress?.viewedHeight ?? 0,
    currentViewedRangeCount: currentProgress?.viewedRanges.length ?? 0,
  };
}

async function collectIndexLinks(): Promise<IndexLinksResponse> {
  const adapter = getAdapterForUrl(location.href);
  const scope = adapter?.getDocScope();
  if (!adapter || !scope) throw new Error('Current page is not supported.');

  await adapter.expandLazyNavigation();
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
  await afterHydration();
  const adapter = getAdapterForUrl(location.href);
  const article = adapter?.getArticleRoot();
  const debug = isIndexingDebugUrl(location.href);
  lfdDebug('indexing measurement page loaded', {
    url: location.href,
    debug,
    adapterFound: Boolean(adapter),
    articleFound: Boolean(article),
  });
  if (!adapter || !article) {
    lfdDebug('indexing measurement skipped', {
      reason: 'adapter or article not found',
      adapterFound: Boolean(adapter),
      articleFound: Boolean(article),
    });
    return;
  }

  const payload = {
    url: normalizePageUrl(location.href),
    title: document.title.replace(/\s+[-–]\s+React$/, '').trim() || location.pathname,
    contentHeight: Math.ceil(articleHeight(article)),
  };
  lfdDebug('indexing measurement payload', payload);

  try {
    const response = await browser.runtime.sendMessage({
      type: 'INDEX_PAGE_MEASURED',
      payload,
    } satisfies RuntimeMessage);
    lfdDebug('indexing measurement message sent', { response });
    if (debug) renderDebugStatus('Measurement sent to background.', { payload, response });
  } catch (error) {
    const details = {
      message: error instanceof Error ? error.message : String(error),
    };
    lfdDebug('indexing measurement message failed', details);
    if (debug) renderDebugStatus('Measurement failed to send to background.', details);
  }
}

async function runReadingTracker(signal: AbortSignal): Promise<ReadingTrackerStop | undefined> {
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
    const pages = await getPagesFromBackground(siteId);
    lfdDebug('reading tracker skipped: page not indexed', {
      siteId,
      currentUrl: normalizePageUrl(location.href),
      indexedPageCount: pages.length,
      indexedUrls: pages.map((item) => item.url),
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

    const range = visibleRange(article);
    if (!range) {
      renderReadingMap(ranges, null, page.contentHeight);
      lfdTrace('reading sample skipped: article outside viewport', {
        articleRect: article.getBoundingClientRect().toJSON?.() ?? null,
      });
      return;
    }
    const nextRanges = addViewedRange(ranges, range);
    if (JSON.stringify(nextRanges) !== JSON.stringify(ranges)) {
      ranges = nextRanges;
      dirty = true;
      lfdTrace('reading sample recorded', {
        range,
        ranges,
        url: page.url,
      });
    }
    renderReadingMap(ranges, range, page.contentHeight);
  };

  const renderUi = () => renderProgressUi(siteId, uiSnapshot);
  const renderPageChrome = async () => {
    await renderUi();
    renderReadingMap(ranges, visibleRange(article), page.contentHeight);
  };
  const scheduleRenderUi = () => {
    if (signal.aborted || renderTimer) return;
    renderTimer = globalThis.setTimeout(() => {
      renderTimer = undefined;
      void renderPageChrome();
    }, 300);
  };

  const flush = async (render = true) => {
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
    if (render && !signal.aborted) await renderPageChrome();
  };

  sample();
  await flush();
  if (signal.aborted) return undefined;

  await renderPageChrome();

  window.addEventListener('scroll', sample, { passive: true, signal });
  window.addEventListener('resize', sample, { passive: true, signal });
  const flushInterval = globalThis.setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  }, { signal });
  window.addEventListener('pagehide', () => void flush(false), { signal });

  const observer = new MutationObserver(scheduleRenderUi);
  observer.observe(document.body, { childList: true, subtree: true });

  return async () => {
    globalThis.clearInterval(flushInterval);
    if (renderTimer) globalThis.clearTimeout(renderTimer);
    observer.disconnect();
    await flush(false);
    removeReadingMap();
  };
}

export default defineContentScript({
  matches: ['https://react.dev/*'],
  runAt: 'document_idle',
  async main(ctx) {
    if (!getAdapterForUrl(location.href)) return;

    let activeTracker: { controller: AbortController; stop: ReadingTrackerStop } | undefined;
    let routeVersion = 0;

    const stopTracking = async () => {
      const tracker = activeTracker;
      activeTracker = undefined;
      if (!tracker) return;
      tracker.controller.abort();
      await tracker.stop();
    };

    const startTracking = async (reason: string) => {
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
        controller.abort();
        await stop();
        return;
      }

      activeTracker = { controller, stop };
    };

    browser.runtime.onMessage.addListener((message: RuntimeMessage) => {
      if (message.type === 'GET_PAGE_CONTEXT') return getPageContext();
      if (message.type === 'COLLECT_INDEX_LINKS') return collectIndexLinks();
      if (message.type === 'INDEX_PROGRESS_UPDATED') return startTracking('index-progress-updated');
      if (message.type === 'INDEX_DEBUG_STATUS') {
        lfdDebug('index debug status received', message.payload);
        renderDebugStatus(message.payload.message, message.payload.details);
      }
      return undefined;
    });

    ctx.addEventListener(window, 'wxt:locationchange', () => {
      void startTracking('locationchange');
    });
    ctx.onInvalidated(() => {
      void stopTracking();
    });

    if (isIndexingUrl(location.href)) {
      await runIndexMeasurement();
      return;
    }

    await startTracking('initial-load');
  },
});
