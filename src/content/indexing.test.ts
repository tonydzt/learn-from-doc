import type { DocSiteAdapter } from '../adapters/types';
import { getAdapterForPage } from '../adapters';
import { collectIndexLinks, getPageAdapterContext, indexMeasurementPayloadForPage } from './indexing';

vi.mock('../adapters', () => ({
  getAdapterForPage: vi.fn(),
}));

function adapter(overrides: Partial<DocSiteAdapter> = {}): DocSiteAdapter {
  return {
    id: 'test-adapter',
    matches: () => true,
    getDocScopeForUrl: () => null,
    getDocScope: () => ({
      host: 'react.dev',
      scopeKey: 'learn',
      scopeTitle: 'Learn React',
      frameworkName: 'React',
    }),
    expandLazyNavigation: async () => {},
    getSidebarLinks: () => [],
    getArticleRoot: () => null,
    getProgressInsertionTargets: () => null,
    ...overrides,
  };
}

describe('content indexing helpers', () => {
  it('builds page adapter context from the active adapter', () => {
    expect(getPageAdapterContext(adapter({ kind: 'site', isPageIndexable: () => false }))).toEqual({
      supported: true,
      host: 'react.dev',
      scopeKey: 'learn',
      scopeTitle: 'Learn React',
      adapterId: 'test-adapter',
      adapterKind: 'site',
      frameworkName: 'React',
      indexable: false,
    });
  });

  it('returns unsupported context when no adapter scope is available', () => {
    expect(getPageAdapterContext(null)).toEqual({ supported: false });
    expect(getPageAdapterContext(adapter({ getDocScope: () => null }))).toEqual({ supported: false });
  });

  it('reports whether the selected adapter requires waiting for indexing page load', async () => {
    vi.mocked(getAdapterForPage).mockReturnValue(adapter({
      requiresIndexingLoadWait: true,
      getSidebarLinks: () => [],
    }));

    await expect(collectIndexLinks()).resolves.toMatchObject({
      requiresIndexingLoadWait: true,
    });
  });

  it('measures indexable article pages', () => {
    const article = document.createElement('article');
    Object.defineProperty(article, 'scrollHeight', { configurable: true, value: 450 });
    article.getBoundingClientRect = () => ({ height: 500 } as DOMRect);
    document.title = 'Hooks – React';

    expect(indexMeasurementPayloadForPage({
      adapter: adapter({ getArticleRoot: () => article }),
      afterHydrationMs: 11,
      measureStartedAt: performance.now(),
    })).toMatchObject({
      url: 'https://react.dev/learn',
      title: 'Hooks',
      contentHeight: 500,
      skippedReason: undefined,
      timing: {
        afterHydrationMs: 11,
      },
    });
  });

  it('records a skipped reason when the article is missing', () => {
    expect(indexMeasurementPayloadForPage({
      adapter: adapter(),
      afterHydrationMs: 7,
      measureStartedAt: performance.now(),
    })).toMatchObject({
      contentHeight: 0,
      skippedReason: 'article not found',
    });
  });
});
