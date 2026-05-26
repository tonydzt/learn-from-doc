import { browser } from 'wxt/browser';
import { createBackgroundContext } from '../context';
import { startIndex } from './indexing';
import { injectContentScript, sendTabMessage } from './tabs';
import { getSite, replaceSitePages } from '../../storage/db';

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
  getSite: vi.fn(async () => undefined),
  replaceSitePages: vi.fn(async () => undefined),
}));

describe('background indexing service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    await vi.waitFor(() => expect(browser.tabs.create).toHaveBeenCalledOnce());
    await Promise.resolve();
    const injectedWhileLoading = vi.mocked(injectContentScript).mock.calls.length > 0;

    if (!injectedWhileLoading) {
      onTabUpdated?.(41, { status: 'complete' }, {
        ...loadingTab,
        status: 'complete',
      });
      await vi.waitFor(() => expect(injectContentScript).toHaveBeenCalledWith(41));
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

  it('waits for a Retype indexing tab to finish loading before injecting the measurement script', async () => {
    const { injectedWhileLoading } = await runSinglePageIndex({ requiresIndexingLoadWait: true });

    expect(injectedWhileLoading).toBe(false);
  });

  it('does not add a Chrome load wait for adapters without the indexing wait capability', async () => {
    const { injectedWhileLoading } = await runSinglePageIndex({});

    expect(injectedWhileLoading).toBe(true);
  });
});
