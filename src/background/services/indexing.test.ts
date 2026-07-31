import { browser } from 'wxt/browser';
import { createBackgroundContext } from '../context';
import { startIndex } from './indexing';
import { injectContentScript, sendTabMessage } from './tabs';
import { deleteIndexCheckpoint, getIndexCheckpoint, getSite, replaceSitePages, saveIndexCheckpoint } from '../../storage/db';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn(async () => undefined),
    },
    tabs: {
      create: vi.fn(),
      get: vi.fn(),
      remove: vi.fn(async () => undefined),
      sendMessage: vi.fn(async () => undefined),
      onUpdated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
}));
vi.mock('./tabs', () => ({
  injectContentScript: vi.fn(async () => undefined),
  sendTabMessage: vi.fn(),
}));
vi.mock('./settings', () => ({
  isDebugIndexingLogsEnabled: vi.fn(async () => false),
}));
vi.mock('../../storage/db', () => ({
  deleteIndexCheckpoint: vi.fn(async () => undefined),
  getIndexCheckpoint: vi.fn(async () => undefined),
  getSite: vi.fn(async () => undefined),
  replaceSitePages: vi.fn(async () => undefined),
  saveIndexCheckpoint: vi.fn(async () => undefined),
}));

describe('background indexing service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.mocked(getIndexCheckpoint).mockResolvedValue(undefined);
    vi.mocked(getSite).mockResolvedValue(undefined);
    vi.mocked(injectContentScript).mockResolvedValue(undefined);
  });

  const twoPageLinks = [
    { url: 'https://docs.example.com/intro', title: 'Intro' },
    { url: 'https://docs.example.com/guide', title: 'Guide' },
  ];

  function mockCollectedLinks(links = twoPageLinks) {
    vi.mocked(sendTabMessage).mockResolvedValue({
      host: 'docs.example.com',
      scopeKey: 'latest',
      scopeTitle: 'Example Docs',
      links,
    });
  }

  function mockCreatedTabs() {
    let nextTabId = 40;
    vi.mocked(browser.tabs.create).mockImplementation(async (input) => ({
      id: nextTabId++,
      status: 'complete',
      url: String(input.url),
    }) as chrome.tabs.Tab);
  }

  function resolveMeasurement(context: ReturnType<typeof createBackgroundContext>, tabId: number, url: string, title: string, contentHeight: number) {
    context.pendingMeasurements.get(tabId)?.resolve({
      url,
      title,
      contentHeight,
      timing: {
        afterHydrationMs: 0,
        articleMeasureMs: 0,
        resourceCount: 0,
        topImageDurations: [],
      },
    });
  }

  async function runSinglePageIndex(input: {
    requiresIndexingLoadWait?: boolean;
  }): Promise<{ injectedWhileLoading: boolean }> {
    const indexedUrl = 'https://docs.sillytavern.app/usage/';
    const loadingTab = {
      id: 41,
      status: 'loading',
      url: `${indexedUrl}#__developer_docs_progress_tracker_indexing=1`,
    } as chrome.tabs.Tab;
    vi.mocked(sendTabMessage).mockResolvedValue({
      host: 'docs.sillytavern.app',
      scopeKey: 'root',
      scopeTitle: 'Retype Docs',
      requiresIndexingLoadWait: input.requiresIndexingLoadWait,
      links: [{ url: indexedUrl, title: 'Usage' }],
    });
    vi.mocked(browser.tabs.create).mockResolvedValue(loadingTab);
    vi.mocked(browser.tabs.get).mockResolvedValue(loadingTab);
    vi.mocked(getSite).mockResolvedValue(undefined);

    let onTabUpdated: ((tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void) | undefined;
    vi.mocked(browser.tabs.onUpdated.addListener).mockImplementation((listener) => {
      onTabUpdated = listener as typeof onTabUpdated;
    });

    const context = createBackgroundContext();
    const indexing = startIndex(context, 7);
    void indexing.catch(() => undefined);
    await vi.waitFor(() => expect(browser.tabs.create).toHaveBeenCalledOnce());
    await Promise.resolve();
    const injectedWhileLoading = vi.mocked(injectContentScript).mock.calls.some(([tabId]) => tabId === 41);

    if (!injectedWhileLoading) {
      onTabUpdated?.(41, { status: 'complete' }, {
        ...loadingTab,
        status: 'complete',
      });
      await vi.waitFor(() => expect(injectContentScript).toHaveBeenCalledWith(41, 'background:indexing-measurement'));
    }

    context.pendingMeasurements.get(41)?.resolve({
      url: indexedUrl,
      title: 'Usage',
      contentHeight: 2609,
      timing: {
        afterHydrationMs: 0,
        articleMeasureMs: 0,
        resourceCount: 0,
        topImageDurations: [],
      },
    });
    await indexing;

    expect(replaceSitePages).toHaveBeenCalledOnce();
    return { injectedWhileLoading };
  }

  it('saves measured pages as a checkpoint when a later page measurement times out', async () => {
    vi.useFakeTimers();
    mockCollectedLinks();
    mockCreatedTabs();
    vi.mocked(getSite).mockResolvedValue(undefined);
    const context = createBackgroundContext();

    const indexing = startIndex(context, 7);
    void indexing.catch(() => undefined);
    await vi.waitFor(() => expect(injectContentScript).toHaveBeenCalledWith(7, 'background:indexing-source'));
    await vi.waitFor(() => expect(browser.tabs.create).toHaveBeenCalledTimes(1));
    resolveMeasurement(context, 40, twoPageLinks[0].url, 'Intro', 100);
    await vi.waitFor(() => expect(browser.tabs.create).toHaveBeenCalledTimes(2));
    await vi.advanceTimersByTimeAsync(30_000);

    await expect(indexing).rejects.toThrow('Timed out while measuring page.');
    expect(saveIndexCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
      siteId: 'docs.example.com::latest',
      failedReason: 'indexing-error',
      pages: [expect.objectContaining({ url: twoPageLinks[0].url, title: 'Intro', order: 0, contentHeight: 100 })],
    }));
    expect(replaceSitePages).not.toHaveBeenCalled();
  });

  it('continues from a matching checkpoint and saves the completed index', async () => {
    mockCollectedLinks();
    mockCreatedTabs();
    vi.mocked(getSite).mockResolvedValue(undefined);
    vi.mocked(getIndexCheckpoint).mockResolvedValue({
      siteId: 'docs.example.com::latest',
      host: 'docs.example.com',
      scopeKey: 'latest',
      scopeTitle: 'Example Docs',
      links: twoPageLinks,
      pages: [{
        siteId: 'docs.example.com::latest',
        url: twoPageLinks[0].url,
        title: 'Intro',
        order: 0,
        contentHeight: 100,
      }],
      requiresIndexingLoadWait: false,
      updatedAt: 1_000,
      failedReason: 'indexing-error',
    });
    const context = createBackgroundContext();

    const indexing = startIndex(context, 7);
    void indexing.catch(() => undefined);
    await vi.waitFor(() => expect(browser.tabs.create).toHaveBeenCalledTimes(1));
    resolveMeasurement(context, 40, twoPageLinks[1].url, 'Guide', 200);
    await indexing;

    expect(browser.tabs.create).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining(twoPageLinks[1].url),
    }));
    expect(replaceSitePages).toHaveBeenCalledWith(expect.objectContaining({
      siteId: 'docs.example.com::latest',
    }), [
      expect.objectContaining({ url: twoPageLinks[0].url, order: 0, contentHeight: 100 }),
      expect.objectContaining({ url: twoPageLinks[1].url, order: 1, contentHeight: 200 }),
    ]);
    expect(deleteIndexCheckpoint).toHaveBeenCalledWith('docs.example.com::latest');
  });

  it('starts from scratch when checkpoint links no longer match the collected sidebar links', async () => {
    const changedLinks = [
      { url: 'https://docs.example.com/start', title: 'Start' },
      twoPageLinks[1],
    ];
    mockCollectedLinks(changedLinks);
    mockCreatedTabs();
    vi.mocked(getSite).mockResolvedValue(undefined);
    vi.mocked(getIndexCheckpoint).mockResolvedValue({
      siteId: 'docs.example.com::latest',
      host: 'docs.example.com',
      scopeKey: 'latest',
      scopeTitle: 'Example Docs',
      links: twoPageLinks,
      pages: [{
        siteId: 'docs.example.com::latest',
        url: twoPageLinks[0].url,
        title: 'Intro',
        order: 0,
        contentHeight: 100,
      }],
      requiresIndexingLoadWait: false,
      updatedAt: 1_000,
      failedReason: 'indexing-error',
    });
    const context = createBackgroundContext();

    const indexing = startIndex(context, 7);
    void indexing.catch(() => undefined);
    await vi.waitFor(() => expect(browser.tabs.create).toHaveBeenCalledTimes(1));
    resolveMeasurement(context, 40, changedLinks[0].url, 'Start', 150);
    await vi.waitFor(() => expect(browser.tabs.create).toHaveBeenCalledTimes(2));
    resolveMeasurement(context, 41, changedLinks[1].url, 'Guide', 200);
    await indexing;

    expect(browser.tabs.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      url: expect.stringContaining(changedLinks[0].url),
    }));
    expect(deleteIndexCheckpoint).toHaveBeenCalledWith('docs.example.com::latest');
    expect(replaceSitePages).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({ url: changedLinks[0].url, order: 0, contentHeight: 150 }),
      expect.objectContaining({ url: changedLinks[1].url, order: 1, contentHeight: 200 }),
    ]);
  });

  it('keeps a partial checkpoint for non-timeout indexing failures', async () => {
    mockCollectedLinks();
    mockCreatedTabs();
    vi.mocked(getSite).mockResolvedValue(undefined);
    vi.mocked(injectContentScript)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Could not inject script.'));
    const context = createBackgroundContext();

    const indexing = startIndex(context, 7);
    void indexing.catch(() => undefined);
    await vi.waitFor(() => expect(browser.tabs.create).toHaveBeenCalledTimes(1));
    resolveMeasurement(context, 40, twoPageLinks[0].url, 'Intro', 100);
    await vi.waitFor(() => expect(browser.tabs.create).toHaveBeenCalledTimes(2));

    await expect(indexing).rejects.toThrow('Could not inject script.');
    expect(saveIndexCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
      siteId: 'docs.example.com::latest',
      failedReason: 'indexing-error',
      pages: [expect.objectContaining({ url: twoPageLinks[0].url, title: 'Intro', order: 0, contentHeight: 100 })],
    }));
    expect(deleteIndexCheckpoint).not.toHaveBeenCalledWith('docs.example.com::latest');
    expect(replaceSitePages).not.toHaveBeenCalled();
  });

  it('waits for a Retype indexing tab to finish loading before injecting the measurement script', async () => {
    const { injectedWhileLoading } = await runSinglePageIndex({ requiresIndexingLoadWait: true });

    expect(injectedWhileLoading).toBe(false);
  });

  it('does not add a Chrome load wait for adapters without the indexing wait capability', async () => {
    const { injectedWhileLoading } = await runSinglePageIndex({});

    expect(injectedWhileLoading).toBe(true);
  });
});
