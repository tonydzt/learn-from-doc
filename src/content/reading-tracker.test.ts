import { runReadingTracker } from './reading-tracker';
import { lfdDebug } from '../shared/logger';
import { removeProgressUi } from './progress-ui';
import { getPageSettingsFromBackground } from './runtime-client';

const getArticleRoot = vi.fn<() => HTMLElement | null>();
const renderReadingMap = vi.fn();
const renderProgressUi = vi.fn();
const saveProgress = vi.fn(async (siteId: string, url: string, ranges: Array<{ start: number; end: number }>, contentHeight: number) => ({
  siteId,
  url,
  viewedRanges: ranges,
  viewedHeight: ranges.reduce((sum, range) => sum + Math.max(0, Math.min(range.end, contentHeight) - Math.min(range.start, contentHeight)), 0),
  updatedAt: 1,
}));
let adapterRequiresStableInitialArticle = false;

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
}));

vi.mock('../adapters', () => ({
  getAdapterForPage: vi.fn(() => ({
    get requiresStableInitialArticle() {
      return adapterRequiresStableInitialArticle;
    },
    getDocScope: () => ({
      host: 'fastapi.tiangolo.com',
      scopeKey: 'root',
      scopeTitle: 'Material for MkDocs Docs',
      frameworkName: 'Material for MkDocs',
    }),
    getArticleRoot,
  })),
}));

vi.mock('./hydration', () => ({
  afterHydration: vi.fn(async () => undefined),
}));

vi.mock('./progress-ui', () => ({
  renderProgressUi: (...args: unknown[]) => renderProgressUi(...args),
  renderReadingMap: (...args: unknown[]) => renderReadingMap(...args),
  removeProgressUi: vi.fn(),
  removeReadingMap: vi.fn(),
}));

vi.mock('./runtime-client', () => ({
  getAppSettingsFromBackground: vi.fn(async () => ({
    language: 'en',
    showReadingMap: true,
    defaultPageReadingProgressEnabled: true,
  })),
  getPageFromBackground: vi.fn(async () => ({
    siteId: 'fastapi.tiangolo.com::root',
    url: 'https://fastapi.tiangolo.com/deployment/concepts/',
    title: 'Concepts',
    order: 1,
    contentHeight: 2000,
  })),
  getPagesFromBackground: vi.fn(async () => [{
    siteId: 'fastapi.tiangolo.com::root',
    url: 'https://fastapi.tiangolo.com/deployment/concepts/',
    title: 'Concepts',
    order: 1,
    contentHeight: 2000,
  }]),
  getPageSettingsFromBackground: vi.fn(async () => ({})),
  getProgressForSiteFromBackground: vi.fn(async () => []),
  getSiteSettingsFromBackground: vi.fn(async () => ({ readingProgressEnabled: true })),
  saveProgressToBackground: (...args: Parameters<typeof saveProgress>) => saveProgress(...args),
}));

vi.mock('../shared/logger', async () => {
  const actual = await vi.importActual<typeof import('../shared/logger')>('../shared/logger');
  return {
    ...actual,
    lfdDebug: vi.fn(),
  };
});

function setBox(
  element: HTMLElement,
  box: { top: number; bottom: number; width?: number; height?: number; scrollHeight?: number },
) {
  const height = box.height ?? box.bottom - box.top;
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: box.scrollHeight ?? height });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: Math.min(height, 500) });
  element.getBoundingClientRect = vi.fn(() => ({
    x: 0,
    y: box.top,
    width: box.width ?? 700,
    height,
    top: box.top,
    right: box.width ?? 700,
    bottom: box.bottom,
    left: 0,
    toJSON() {
      return this;
    },
  } as DOMRect));
}

describe('reading tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    adapterRequiresStableInitialArticle = false;
    document.body.innerHTML = '';
    window.history.replaceState(null, '', '/deployment/concepts/');
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
  });

  it('refreshes a stale article root before sampling replacement article progress', async () => {
    const oldArticle = document.createElement('article');
    setBox(oldArticle, { top: 0, bottom: 1500, scrollHeight: 2000 });
    document.body.append(oldArticle);

    const newScroller = document.createElement('div');
    newScroller.style.overflowY = 'auto';
    Object.defineProperty(newScroller, 'scrollHeight', { configurable: true, value: 3000 });
    Object.defineProperty(newScroller, 'clientHeight', { configurable: true, value: 500 });

    const newArticle = document.createElement('article');
    setBox(newArticle, { top: -600, bottom: 1400, scrollHeight: 2000 });
    newScroller.append(newArticle);

    getArticleRoot.mockReturnValueOnce(oldArticle).mockReturnValue(newArticle);
    const stop = await runReadingTracker(new AbortController().signal);
    expect(stop).toBeDefined();
    saveProgress.mockClear();

    oldArticle.remove();
    document.body.append(newScroller);
    await Promise.resolve();

    window.dispatchEvent(new window.Event('scroll'));
    document.dispatchEvent(new window.Event('scroll'));
    await stop?.();

    expect(getArticleRoot).toHaveBeenCalledTimes(2);
    expect(lfdDebug).toHaveBeenCalledWith('reading tracker article root refreshed', expect.objectContaining({
      siteId: 'fastapi.tiangolo.com::root',
      url: 'https://fastapi.tiangolo.com/deployment/concepts/',
      previousConnected: false,
      nextFound: true,
    }));
    expect(saveProgress).toHaveBeenCalledWith(
      'fastapi.tiangolo.com::root',
      'https://fastapi.tiangolo.com/deployment/concepts/',
      expect.arrayContaining([{ start: 600, end: 1100 }]),
      2000,
    );
  });

  it('discards guarded initial progress when the article root is replaced during startup', async () => {
    vi.useFakeTimers();
    adapterRequiresStableInitialArticle = true;

    const oldArticle = document.createElement('article');
    setBox(oldArticle, { top: -3164, bottom: 1000, scrollHeight: 4164 });
    document.body.append(oldArticle);

    const newArticle = document.createElement('article');
    setBox(newArticle, { top: 166, bottom: 1400, scrollHeight: 2000 });

    getArticleRoot.mockReturnValueOnce(oldArticle).mockReturnValue(newArticle);
    const runPromise = runReadingTracker(new AbortController().signal);
    for (let index = 0; index < 10; index += 1) {
      await Promise.resolve();
    }

    oldArticle.remove();
    document.body.append(newArticle);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(500);

    const stop = await runPromise;
    await stop?.();

    expect(saveProgress).toHaveBeenCalledWith(
      'fastapi.tiangolo.com::root',
      'https://fastapi.tiangolo.com/deployment/concepts/',
      [{ start: 0, end: 334 }],
      2000,
    );
    expect(saveProgress).not.toHaveBeenCalledWith(
      'fastapi.tiangolo.com::root',
      'https://fastapi.tiangolo.com/deployment/concepts/',
      expect.arrayContaining([{ start: 3164, end: 3664 }]),
      2000,
    );
  });

  it('flushes dirty progress on stop even after abort and route change', async () => {
    const article = document.createElement('article');
    setBox(article, { top: 0, bottom: 2000, scrollHeight: 2000 });
    document.body.append(article);
    getArticleRoot.mockReturnValue(article);

    const controller = new AbortController();
    const stop = await runReadingTracker(controller.signal);
    expect(stop).toBeDefined();
    saveProgress.mockClear();

    setBox(article, { top: -600, bottom: 1400, scrollHeight: 2000 });
    window.dispatchEvent(new window.Event('scroll'));
    window.history.replaceState(null, '', '/deployment/other/');
    controller.abort();
    await stop?.();

    expect(saveProgress).toHaveBeenCalledWith(
      'fastapi.tiangolo.com::root',
      'https://fastapi.tiangolo.com/deployment/concepts/',
      expect.arrayContaining([{ start: 600, end: 1100 }]),
      2000,
    );
  });

  it('can stop for SPA navigation without removing progress UI', async () => {
    const article = document.createElement('article');
    setBox(article, { top: 0, bottom: 2000, scrollHeight: 2000 });
    document.body.append(article);
    getArticleRoot.mockReturnValue(article);

    const stop = await runReadingTracker(new AbortController().signal);
    expect(stop).toBeDefined();

    await stop?.({ removeUi: false });

    expect(removeProgressUi).not.toHaveBeenCalled();
  });

  it('renders page chrome but does not save progress when page recording is disabled', async () => {
    vi.mocked(getPageSettingsFromBackground).mockResolvedValueOnce({ readingProgressEnabled: false });
    const article = document.createElement('article');
    setBox(article, { top: 0, bottom: 2000, scrollHeight: 2000 });
    document.body.append(article);
    getArticleRoot.mockReturnValue(article);

    const stop = await runReadingTracker(new AbortController().signal);
    expect(stop).toBeDefined();
    expect(renderProgressUi).toHaveBeenCalled();
    saveProgress.mockClear();

    setBox(article, { top: -600, bottom: 1400, scrollHeight: 2000 });
    window.dispatchEvent(new window.Event('scroll'));
    await stop?.();

    expect(saveProgress).not.toHaveBeenCalled();
  });
});
