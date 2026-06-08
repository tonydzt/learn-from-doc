import { browser } from 'wxt/browser';
import {
  clearPendingIndexAfterPermission,
  consumePendingIndexAfterPermission,
  registerPendingIndexAfterPermission,
} from './pending-index';

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
      },
    },
  },
}));

const originPattern = 'https://ui.shadcn.com/*';
const action = {
  tabId: 17,
  url: 'https://ui.shadcn.com/docs',
  originPattern,
  createdAt: 1_000,
};

describe('pending index after permission storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores a one-time pending action before optional permission is requested', async () => {
    await registerPendingIndexAfterPermission(action);

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      pendingIndexAfterPermission: action,
    });
  });

  it('consumes an action only for its exact granted origin', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValue({
      pendingIndexAfterPermission: action,
    });

    expect(await consumePendingIndexAfterPermission(['https://other.example/*'], 1_001)).toBeNull();
    expect(browser.storage.local.remove).not.toHaveBeenCalled();

    expect(await consumePendingIndexAfterPermission([originPattern], 1_001)).toEqual(action);
    expect(browser.storage.local.remove).toHaveBeenCalledWith('pendingIndexAfterPermission');
  });

  it('removes an expired action without starting an index', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValue({
      pendingIndexAfterPermission: action,
    });

    expect(await consumePendingIndexAfterPermission([originPattern], 301_001)).toBeNull();
    expect(browser.storage.local.remove).toHaveBeenCalledWith('pendingIndexAfterPermission');
  });

  it('clears a pending action after permission is denied', async () => {
    await clearPendingIndexAfterPermission();

    expect(browser.storage.local.remove).toHaveBeenCalledWith('pendingIndexAfterPermission');
  });
});
