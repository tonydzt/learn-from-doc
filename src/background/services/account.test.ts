import { browser } from 'wxt/browser';
import { ACCOUNT_SESSION_STORAGE_KEY } from '../../settings/account-session';
import {
  getAccountSessionForBackground,
  loginAccountForBackground,
  logoutAccountForBackground,
  refreshAccountPermissionsForBackground,
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

describe('background account service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('logs in, fetches permissions from the response, and stores the session', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      accessToken: 'token-1',
      user: { id: 'user-1', email: 'reader@example.com', name: 'Reader' },
      permissions: { canSync: true, canPullServerData: true },
    }), { status: 200 }));

    await expect(loginAccountForBackground('reader@example.com', 'secret')).resolves.toEqual({
      accessToken: 'token-1',
      user: { id: 'user-1', email: 'reader@example.com', name: 'Reader' },
      permissions: { canSync: true, canPullServerData: true },
      updatedAt: Date.parse('2026-06-08T00:00:00Z'),
    });

    expect(fetch).toHaveBeenCalledWith('https://learn-from-doc-web.vercel.app/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'reader@example.com', password: 'secret' }),
    });
    expect(browser.storage.local.set).toHaveBeenCalledWith({
      [ACCOUNT_SESSION_STORAGE_KEY]: {
        accessToken: 'token-1',
        user: { id: 'user-1', email: 'reader@example.com', name: 'Reader' },
        permissions: { canSync: true, canPullServerData: true },
        updatedAt: Date.parse('2026-06-08T00:00:00Z'),
      },
    });
  });

  it('returns a login error without saving invalid credentials', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      error: 'Invalid email or password',
    }), { status: 401 }));

    await expect(loginAccountForBackground('reader@example.com', 'wrong')).rejects.toThrow('Invalid email or password');

    expect(browser.storage.local.set).not.toHaveBeenCalled();
  });

  it('refreshes permissions with the stored bearer token', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValue({
      [ACCOUNT_SESSION_STORAGE_KEY]: {
        accessToken: 'token-1',
        user: { id: 'user-1', email: 'reader@example.com', name: 'Reader' },
        permissions: { canSync: false, canPullServerData: false },
        updatedAt: 1,
      },
    });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      permissions: { canSync: true, canPullServerData: false },
    }), { status: 200 }));

    await expect(refreshAccountPermissionsForBackground()).resolves.toEqual({
      accessToken: 'token-1',
      user: { id: 'user-1', email: 'reader@example.com', name: 'Reader' },
      permissions: { canSync: true, canPullServerData: false },
      updatedAt: Date.parse('2026-06-08T00:00:00Z'),
    });

    expect(fetch).toHaveBeenCalledWith('https://learn-from-doc-web.vercel.app/api/me/permissions', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-1' },
    });
  });

  it('clears the session when permission refresh is unauthorized', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValue({
      [ACCOUNT_SESSION_STORAGE_KEY]: {
        accessToken: 'token-1',
        user: { id: 'user-1', email: 'reader@example.com' },
        permissions: { canSync: false, canPullServerData: false },
        updatedAt: 1,
      },
    });
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));

    await expect(refreshAccountPermissionsForBackground()).resolves.toBeNull();

    expect(browser.storage.local.remove).toHaveBeenCalledWith(ACCOUNT_SESSION_STORAGE_KEY);
  });

  it('reads and clears the current account session', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValue({
      [ACCOUNT_SESSION_STORAGE_KEY]: {
        accessToken: 'token-1',
        user: { id: 'user-1', email: 'reader@example.com' },
        permissions: { canSync: true, canPullServerData: false },
        updatedAt: 1,
      },
    });

    await expect(getAccountSessionForBackground()).resolves.toEqual({
      accessToken: 'token-1',
      user: { id: 'user-1', email: 'reader@example.com' },
      permissions: { canSync: true, canPullServerData: false },
      updatedAt: 1,
    });
    await logoutAccountForBackground();

    expect(browser.storage.local.remove).toHaveBeenCalledWith(ACCOUNT_SESSION_STORAGE_KEY);
  });
});
