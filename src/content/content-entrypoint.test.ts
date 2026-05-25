import { browser } from 'wxt/browser';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
}));
vi.mock('../adapters', () => ({
  getAdapterForPage: vi.fn(() => null),
  getAdapterForUrl: vi.fn(() => null),
}));
vi.mock('./indexing', () => ({
  collectIndexLinks: vi.fn(),
  getPageAdapterContext: vi.fn(),
  runIndexMeasurement: vi.fn(),
}));
vi.mock('./reading-lifecycle', () => ({
  claimReadingTrackerOwner: vi.fn(),
  shouldStartTrackingOnVisibilityChange: vi.fn(() => false),
}));
vi.mock('./reading-tracker', () => ({
  runReadingTracker: vi.fn(),
}));
vi.mock('./progress-ui', () => ({
  removeProgressUi: vi.fn(),
}));
vi.mock('./runtime-client', () => ({
  getIndexedScopeForCurrentPage: vi.fn(async () => undefined),
  hasOriginPermissionFromBackground: vi.fn(async () => false),
}));
vi.mock('../shared/logger', () => ({
  lfdDebug: vi.fn(),
}));
vi.mock('../shared/url', () => ({
  isIndexingUrl: vi.fn(() => false),
  normalizePageUrl: vi.fn((url: string) => url),
  siteIdFor: vi.fn(),
}));

describe('content script lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('defineContentScript', (definition: unknown) => definition);
  });

  it('removes the runtime message listener when its context is invalidated', async () => {
    const { default: contentScript } = await import('../../entrypoints/content');
    let invalidate: (() => void) | undefined;
    const ctx = {
      addEventListener: vi.fn(),
      onInvalidated: vi.fn((callback: () => void) => {
        invalidate = callback;
      }),
    };

    await contentScript.main(ctx as never);

    const listener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0]?.[0];
    expect(listener).toBeDefined();

    invalidate?.();

    expect(browser.runtime.onMessage.removeListener).toHaveBeenCalledWith(listener);
  });
});
