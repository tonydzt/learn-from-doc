import { browser } from 'wxt/browser';
import {
  CONTENT_SCRIPT_BOOTING_ATTR,
  CONTENT_SCRIPT_PENDING_ATTR,
  CONTENT_SCRIPT_READY_ATTR,
} from '../shared/constants';

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
  shouldRestartTrackingForUrl: vi.fn(() => true),
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
    vi.useFakeTimers();
    vi.resetModules();
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/initial/');
    document.documentElement.removeAttribute(CONTENT_SCRIPT_BOOTING_ATTR);
    document.documentElement.removeAttribute(CONTENT_SCRIPT_PENDING_ATTR);
    document.documentElement.removeAttribute(CONTENT_SCRIPT_READY_ATTR);
    vi.stubGlobal('defineContentScript', (definition: unknown) => definition);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('does nothing when a content script is already ready for this document', async () => {
    document.documentElement.setAttribute(CONTENT_SCRIPT_READY_ATTR, 'true');
    const { runReadingTracker } = await import('./reading-tracker');
    const { removeProgressUi } = await import('./progress-ui');
    const { default: contentScript } = await import('../../entrypoints/content');
    const ctx = {
      addEventListener: vi.fn(),
      onInvalidated: vi.fn(),
    };

    await contentScript.main(ctx as never);

    expect(browser.runtime.onMessage.addListener).not.toHaveBeenCalled();
    expect(ctx.addEventListener).not.toHaveBeenCalled();
    expect(runReadingTracker).not.toHaveBeenCalled();
    expect(removeProgressUi).not.toHaveBeenCalled();
  });

  it('does nothing when another content script instance is already booting', async () => {
    document.documentElement.setAttribute(CONTENT_SCRIPT_BOOTING_ATTR, 'true');
    const { runReadingTracker } = await import('./reading-tracker');
    const { default: contentScript } = await import('../../entrypoints/content');
    const ctx = {
      addEventListener: vi.fn(),
      onInvalidated: vi.fn(),
    };

    await contentScript.main(ctx as never);

    expect(browser.runtime.onMessage.addListener).not.toHaveBeenCalled();
    expect(ctx.addEventListener).not.toHaveBeenCalled();
    expect(runReadingTracker).not.toHaveBeenCalled();
  });

  it('marks the content script ready and clears manual injection markers after registering listeners', async () => {
    document.documentElement.setAttribute(CONTENT_SCRIPT_PENDING_ATTR, 'true');
    const { default: contentScript } = await import('../../entrypoints/content');
    const ctx = {
      addEventListener: vi.fn(),
      onInvalidated: vi.fn(),
    };

    await contentScript.main(ctx as never);

    expect(browser.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(document.documentElement.getAttribute(CONTENT_SCRIPT_READY_ATTR)).toBe('true');
    expect(document.documentElement.hasAttribute(CONTENT_SCRIPT_BOOTING_ATTR)).toBe(false);
    expect(document.documentElement.hasAttribute(CONTENT_SCRIPT_PENDING_ATTR)).toBe(false);
  });

  it('clears the booting marker when startup fails before ready', async () => {
    const { hasOriginPermissionFromBackground } = await import('./runtime-client');
    vi.mocked(hasOriginPermissionFromBackground).mockRejectedValueOnce(new Error('permission failed'));
    const { default: contentScript } = await import('../../entrypoints/content');
    const ctx = {
      addEventListener: vi.fn(),
      onInvalidated: vi.fn(),
    };

    await expect(contentScript.main(ctx as never)).rejects.toThrow('permission failed');

    expect(document.documentElement.hasAttribute(CONTENT_SCRIPT_BOOTING_ATTR)).toBe(false);
    expect(document.documentElement.hasAttribute(CONTENT_SCRIPT_READY_ATTR)).toBe(false);
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

  it('does not restart tracking when location changes within the same normalized page', async () => {
    const { hasOriginPermissionFromBackground } = await import('./runtime-client');
    const { shouldRestartTrackingForUrl } = await import('./reading-lifecycle');
    const { runReadingTracker } = await import('./reading-tracker');
    vi.mocked(hasOriginPermissionFromBackground).mockResolvedValue(true);
    vi.mocked(runReadingTracker).mockResolvedValue(vi.fn());
    vi.mocked(shouldRestartTrackingForUrl)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    const { default: contentScript } = await import('../../entrypoints/content');
    const ctx = {
      addEventListener: vi.fn(),
      onInvalidated: vi.fn(),
    };

    await contentScript.main(ctx as never);
    const locationChange = vi.mocked(ctx.addEventListener).mock.calls
      .find(([target, event]) => target === window && event === 'wxt:locationchange')?.[2] as (() => void) | undefined;
    expect(locationChange).toBeDefined();

    locationChange?.();
    await Promise.resolve();

    expect(runReadingTracker).toHaveBeenCalledTimes(1);
  });

  it('restarts tracking when the url changes even if the WXT locationchange event is missed', async () => {
    const { getAdapterForUrl } = await import('../adapters');
    const { shouldRestartTrackingForUrl } = await import('./reading-lifecycle');
    const { runReadingTracker } = await import('./reading-tracker');
    const stop = vi.fn(async () => undefined);
    vi.mocked(runReadingTracker).mockReset();
    vi.mocked(shouldRestartTrackingForUrl).mockReset();
    vi.mocked(getAdapterForUrl).mockReturnValue({} as never);
    vi.mocked(shouldRestartTrackingForUrl).mockReturnValue(true);
    vi.mocked(runReadingTracker).mockResolvedValue(stop);

    const { default: contentScript } = await import('../../entrypoints/content');
    const ctx = {
      addEventListener: vi.fn(),
      onInvalidated: vi.fn(),
    };

    await contentScript.main(ctx as never);
    expect(runReadingTracker).toHaveBeenCalledTimes(1);

    window.history.pushState(null, '', '/next/');
    await vi.advanceTimersByTimeAsync(600);

    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith({ removeUi: false });
    expect(runReadingTracker).toHaveBeenCalledTimes(2);
  });
});
