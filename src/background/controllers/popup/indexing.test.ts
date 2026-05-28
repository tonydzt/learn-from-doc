import { browser } from 'wxt/browser';
import { createBackgroundContext } from '../../context';
import type { RuntimeMessage } from '../../../shared/messages';
import { startIndex } from '../../services/indexing';
import { getIndexCheckpoint } from '../../../storage/db';
import {
  clearPendingIndexAfterPermission,
  consumePendingIndexAfterPermission,
  registerPendingIndexAfterPermission,
} from '../../services/pending-index';
import { handlePopupMessages, resumePendingIndexAfterPermission } from './indexing';

vi.mock('wxt/browser', () => ({
  browser: {
    permissions: {
      contains: vi.fn(async () => false),
    },
    tabs: {
      get: vi.fn(),
    },
  },
}));
vi.mock('../../services/indexing', () => ({
  startIndex: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../../services/tabs', () => ({
  logIndexFailureToSourceTab: vi.fn(async () => undefined),
}));
vi.mock('../../../storage/db', () => ({
  getIndexCheckpoint: vi.fn(async () => undefined),
}));
vi.mock('../../services/pending-index', () => ({
  clearPendingIndexAfterPermission: vi.fn(async () => undefined),
  consumePendingIndexAfterPermission: vi.fn(async () => null),
  registerPendingIndexAfterPermission: vi.fn(async () => undefined),
}));

const pending = {
  tabId: 17,
  url: 'https://ui.shadcn.com/docs',
  originPattern: 'https://ui.shadcn.com/*',
  createdAt: 1_000,
};

describe('popup indexing background controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(browser.permissions.contains).mockResolvedValue(false);
  });

  it('registers missing-permission index continuation without starting indexing', async () => {
    await handlePopupMessages({
      type: 'REGISTER_PENDING_INDEX_AFTER_PERMISSION',
      pending,
    } as RuntimeMessage, {}, createBackgroundContext());

    expect(registerPendingIndexAfterPermission).toHaveBeenCalledWith(pending);
    expect(startIndex).not.toHaveBeenCalled();
  });

  it('resumes from registration if permission was granted before the added event was consumed', async () => {
    vi.mocked(browser.permissions.contains).mockResolvedValue(true);
    vi.mocked(consumePendingIndexAfterPermission).mockResolvedValue(pending);
    vi.mocked(browser.tabs.get).mockResolvedValue({ id: pending.tabId, url: pending.url } as chrome.tabs.Tab);
    const context = createBackgroundContext();

    await handlePopupMessages({
      type: 'REGISTER_PENDING_INDEX_AFTER_PERMISSION',
      pending,
    } as RuntimeMessage, {}, context);

    expect(startIndex).toHaveBeenCalledWith(context, pending.tabId);
  });

  it('clears a rejected permission continuation without starting indexing', async () => {
    await handlePopupMessages({
      type: 'CLEAR_PENDING_INDEX_AFTER_PERMISSION',
    } as RuntimeMessage, {}, createBackgroundContext());

    expect(clearPendingIndexAfterPermission).toHaveBeenCalledOnce();
    expect(startIndex).not.toHaveBeenCalled();
  });

  it('keeps START_INDEX on the existing direct indexing path', async () => {
    await handlePopupMessages({ type: 'START_INDEX', tabId: 21 }, {}, createBackgroundContext());

    expect(startIndex).toHaveBeenCalledWith(expect.anything(), 21);
    expect(registerPendingIndexAfterPermission).not.toHaveBeenCalled();
  });

  it('returns a saved index checkpoint summary for popup resume state', async () => {
    vi.mocked(getIndexCheckpoint).mockResolvedValue({
      siteId: 'ui.shadcn.com::docs',
      host: 'ui.shadcn.com',
      scopeKey: 'docs',
      scopeTitle: 'shadcn/ui',
      links: [
        { url: 'https://ui.shadcn.com/docs', title: 'Docs' },
        { url: 'https://ui.shadcn.com/docs/components/button', title: 'Button' },
      ],
      pages: [{
        siteId: 'ui.shadcn.com::docs',
        url: 'https://ui.shadcn.com/docs',
        title: 'Docs',
        order: 0,
        contentHeight: 100,
      }],
      requiresIndexingLoadWait: false,
      updatedAt: 1_234,
      failedReason: 'measurement-timeout',
    });

    await expect(handlePopupMessages({
      type: 'GET_INDEX_CHECKPOINT',
      siteId: 'ui.shadcn.com::docs',
    } as RuntimeMessage, {}, createBackgroundContext())).resolves.toEqual({
      siteId: 'ui.shadcn.com::docs',
      current: 1,
      total: 2,
      updatedAt: 1_234,
    });
  });

  it('resumes a matching pending index after permission is granted', async () => {
    vi.mocked(consumePendingIndexAfterPermission).mockResolvedValue(pending);
    vi.mocked(browser.tabs.get).mockResolvedValue({ id: pending.tabId, url: pending.url } as chrome.tabs.Tab);
    const context = createBackgroundContext();

    await resumePendingIndexAfterPermission(context, [pending.originPattern]);

    expect(startIndex).toHaveBeenCalledWith(context, pending.tabId);
  });

  it('does not resume indexing if the source tab moved after permission was requested', async () => {
    vi.mocked(consumePendingIndexAfterPermission).mockResolvedValue(pending);
    vi.mocked(browser.tabs.get).mockResolvedValue({ id: pending.tabId, url: 'https://ui.shadcn.com/blocks' } as chrome.tabs.Tab);

    await resumePendingIndexAfterPermission(createBackgroundContext(), [pending.originPattern]);

    expect(startIndex).not.toHaveBeenCalled();
  });
});
