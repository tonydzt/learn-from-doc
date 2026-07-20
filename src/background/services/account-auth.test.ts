import { requireAccountAuth } from './account-auth';

const getStoredAccountSession = vi.fn();
const saveStoredAccountSession = vi.fn();
const clearStoredAccountSession = vi.fn();

vi.mock('../../storage/settings', () => ({
  getStoredAccountSession: () => getStoredAccountSession(),
  saveStoredAccountSession: (session: unknown) => saveStoredAccountSession(session),
  clearStoredAccountSession: () => clearStoredAccountSession(),
}));

const session = {
  accessToken: 'token-1',
  refreshToken: 'refresh-token-1',
  user: { id: 'user-1', email: 'reader@example.com' },
  permissions: { canSync: true, canPullServerData: true, canTestSystemIndexes: false },
  visiblePermissions: [],
  expiresAt: 10 * 60 * 1_000,
  updatedAt: 1,
};

describe('background account auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    getStoredAccountSession.mockResolvedValue(session);
    saveStoredAccountSession.mockImplementation(async (next) => next);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds authorization headers from the stored account token', async () => {
    await expect(requireAccountAuth(undefined, 1_000)).resolves.toEqual({
      session,
      headers: { Authorization: 'Bearer token-1' },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requires a logged in account', async () => {
    getStoredAccountSession.mockResolvedValue(null);

    await expect(requireAccountAuth()).rejects.toThrow('Please log in first.');
  });

  it('checks all requested permissions before returning headers', async () => {
    await expect(requireAccountAuth(['canPullServerData', 'canTestSystemIndexes'], 1_000))
      .rejects.toThrow('System index testing is not enabled for this account.');
  });

  it('refreshes and stores the session before returning a token that expires soon', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      accessToken: 'token-2',
      refreshToken: 'refresh-token-2',
      expiresAt: 1_782_198_578,
    }), { status: 200 }));

    await expect(requireAccountAuth(undefined, 9 * 60 * 1_000)).resolves.toEqual({
      session: {
        ...session,
        accessToken: 'token-2',
        refreshToken: 'refresh-token-2',
        expiresAt: 1_782_198_578_000,
        updatedAt: 9 * 60 * 1_000,
      },
      headers: { Authorization: 'Bearer token-2' },
    });

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'refresh-token-1' }),
    });
    expect(saveStoredAccountSession).toHaveBeenCalledWith({
      ...session,
      accessToken: 'token-2',
      refreshToken: 'refresh-token-2',
      expiresAt: 1_782_198_578_000,
      updatedAt: 9 * 60 * 1_000,
    });
  });

  it('clears invalid refresh token sessions', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      error: 'Invalid refresh token',
    }), { status: 401 }));

    await expect(requireAccountAuth(undefined, 9 * 60 * 1_000)).rejects.toThrow('Login expired. Please log in again.');

    expect(clearStoredAccountSession).toHaveBeenCalled();
  });
});
