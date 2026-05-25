import { getAdapterForPage } from '../adapters';
import type { DocSiteAdapter } from '../adapters/types';
import type { IndexLinksResponse, IndexPageMeasuredMessage, PageAdapterContext } from '../shared/messages';
import { lfdDebug } from '../shared/logger';
import { normalizePageUrl } from '../shared/url';
import { afterHydration, INDEXING_HYDRATION_TIMEOUT_MS, INDEXING_IDLE_TIMEOUT_MS } from './hydration';
import { articleHeight } from './reading-geometry';
import { sendRuntimeMessage } from './runtime-client';

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

export async function collectIndexLinks(): Promise<IndexLinksResponse> {
  const adapter = getAdapterForPage(location.href);
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

export function getPageAdapterContext(adapter = getAdapterForPage(location.href)): PageAdapterContext {
  const scope = adapter?.getDocScope();
  if (!adapter || !scope) return { supported: false };

  return {
    supported: true,
    host: scope.host,
    scopeKey: scope.scopeKey,
    scopeTitle: scope.scopeTitle,
    adapterId: adapter.id,
    adapterKind: adapter.kind ?? 'site',
    frameworkName: scope.frameworkName ?? adapter.frameworkName,
    indexable: adapter.isPageIndexable?.() ?? true,
  };
}

export function indexMeasurementPayloadForPage(input: {
  adapter: DocSiteAdapter | null;
  afterHydrationMs: number;
  measureStartedAt: number;
}): IndexPageMeasuredMessage['payload'] {
  const indexable = input.adapter?.isPageIndexable?.() ?? true;
  const article = input.adapter?.getArticleRoot();
  const skippedReason = !input.adapter
    ? 'adapter not found'
    : indexable && !article
      ? 'article not found'
      : !indexable
        ? 'page not indexable'
        : undefined;

  return {
    url: normalizePageUrl(location.href),
    title: document.title.replace(/\s+[-–]\s+React$/, '').trim() || location.pathname,
    contentHeight: !skippedReason && article ? Math.ceil(articleHeight(article)) : 0,
    skippedReason,
    timing: {
      afterHydrationMs: input.afterHydrationMs,
      articleMeasureMs: Math.round(performance.now() - input.measureStartedAt),
      navigationLoadMs: navigationLoadMs(),
      resourceCount: resourceCount(),
      topImageDurations: topImageDurations(),
    },
  };
}

export async function runIndexMeasurement() {
  const startedAt = performance.now();
  await afterHydration(INDEXING_HYDRATION_TIMEOUT_MS, INDEXING_IDLE_TIMEOUT_MS);
  const afterHydrationMs = Math.round(performance.now() - startedAt);
  const adapter = getAdapterForPage(location.href);
  const indexable = adapter?.isPageIndexable?.() ?? true;
  const article = adapter?.getArticleRoot();
  lfdDebug('indexing measurement page loaded', {
    url: location.href,
    adapterFound: Boolean(adapter),
    indexable,
    articleFound: Boolean(article),
  });

  const payload = indexMeasurementPayloadForPage({
    adapter,
    afterHydrationMs,
    measureStartedAt: performance.now(),
  });
  try {
    const response = await sendRuntimeMessage({
      type: 'INDEX_PAGE_MEASURED',
      payload,
    });
    lfdDebug('indexing measurement message sent', { response });
  } catch (error) {
    lfdDebug('indexing measurement message failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
