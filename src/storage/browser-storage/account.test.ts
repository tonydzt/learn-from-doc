import { browser } from 'wxt/browser';
import { ACCOUNT_SESSION_STORAGE_KEY } from '../../settings/account-session';
import {
  clearStoredAccountSession,
  getStoredAccountSession,
  saveStoredAccountSession,
} from './account';

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
      },
    },
  },
}));

describe('browser storage account session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for missing stored sessions', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValue({});

    await expect(getStoredAccountSession()).resolves.toBeNull();

    expect(browser.storage.local.get).toHaveBeenCalledWith(ACCOUNT_SESSION_STORAGE_KEY);
  });

  it('saves normalized account sessions', async () => {
    await saveStoredAccountSession({
      accessToken: 'token-1',
      user: { id: 'user-1', email: 'reader@example.com' },
      permissions: { canSync: true, canPullServerData: false },
      updatedAt: 123,
    });

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      [ACCOUNT_SESSION_STORAGE_KEY]: {
        accessToken: 'token-1',
        user: { id: 'user-1', email: 'reader@example.com' },
        permissions: { canSync: true, canPullServerData: false },
        updatedAt: 123,
      },
    });
  });

  it('clears stored sessions on logout', async () => {
    await clearStoredAccountSession();

    expect(browser.storage.local.remove).toHaveBeenCalledWith(ACCOUNT_SESSION_STORAGE_KEY);
  });
});
