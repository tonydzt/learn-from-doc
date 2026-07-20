import {
  accountLoginStatus,
  DEFAULT_ACCOUNT_PERMISSIONS,
  hasAccountPermission,
  normalizeAccountSession,
} from './account-session';

describe('account session normalization', () => {
  it('returns null for empty storage values', () => {
    expect(normalizeAccountSession(undefined)).toBeNull();
    expect(normalizeAccountSession(null)).toBeNull();
  });

  it('normalizes invalid permission fields to false', () => {
    expect(normalizeAccountSession({
      accessToken: 'token-1',
      user: {
        id: 'user-1',
        email: 'reader@example.com',
        name: 'Reader',
      },
      permissions: {
        canSync: 'yes',
        canPullServerData: true,
      },
      expiresAt: 2_000_000_000_000,
      updatedAt: 123,
    })).toEqual({
      accessToken: 'token-1',
      user: {
        id: 'user-1',
        email: 'reader@example.com',
        name: 'Reader',
      },
      permissions: {
        canSync: false,
        canPullServerData: true,
        canTestSystemIndexes: false,
      },
      visiblePermissions: [{ key: 'canPullServerData', label: 'Server data pull' }],
      expiresAt: 2_000_000_000_000,
      updatedAt: 123,
    });
  });

  it('preserves dynamic boolean permissions and normalizes visible permission metadata', () => {
    expect(normalizeAccountSession({
      accessToken: 'token-1',
      user: { id: 'user-1', email: 'reader@example.com' },
      permissions: {
        canSync: 'yes',
        canPullServerData: true,
        canTestSystemIndexes: true,
        futurePermission: false,
        invalidPermission: 'enabled',
      },
      visiblePermissions: [
        { key: 'futurePermission', label: 'Future permission' },
        { key: 'canTestSystemIndexes', label: 'Test system indexes' },
        { key: 'missingPermission', label: 'Missing permission' },
        { key: '', label: 'Empty key' },
        { key: 'canSync', label: '' },
        null,
      ],
      expiresAt: 2_000_000_000_000,
      updatedAt: 123,
    })).toEqual({
      accessToken: 'token-1',
      user: { id: 'user-1', email: 'reader@example.com' },
      permissions: {
        canSync: false,
        canPullServerData: true,
        canTestSystemIndexes: true,
        futurePermission: false,
      },
      visiblePermissions: [
        { key: 'futurePermission', label: 'Future permission' },
        { key: 'canTestSystemIndexes', label: 'Test system indexes' },
      ],
      expiresAt: 2_000_000_000_000,
      updatedAt: 123,
    });
  });

  it('uses known boolean permission keys as visible rows when display metadata is absent', () => {
    expect(normalizeAccountSession({
      accessToken: 'token-1',
      user: { id: 'user-1', email: 'reader@example.com' },
      permissions: {
        canSync: true,
        canPullServerData: true,
        canTestSystemIndexes: true,
      },
      expiresAt: 2_000_000_000_000,
      updatedAt: 123,
    })?.visiblePermissions).toEqual([
      { key: 'canSync', label: 'Multi-device sync' },
      { key: 'canPullServerData', label: 'Server data pull' },
      { key: 'canTestSystemIndexes', label: 'Test system indexes' },
    ]);
  });

  it('normalizes expiresAt from server date strings and second timestamps', () => {
    expect(normalizeAccountSession({
      accessToken: 'token-1',
      user: { id: 'user-1', email: 'reader@example.com' },
      permissions: DEFAULT_ACCOUNT_PERMISSIONS,
      expiresAt: '2026-06-09T00:00:00.000Z',
      updatedAt: 123,
    })?.expiresAt).toBe(Date.parse('2026-06-09T00:00:00.000Z'));

    expect(normalizeAccountSession({
      accessToken: 'token-1',
      user: { id: 'user-1', email: 'reader@example.com' },
      permissions: DEFAULT_ACCOUNT_PERMISSIONS,
      expiresAt: 1_782_218_735,
      updatedAt: 123,
    })?.expiresAt).toBe(1_782_218_735_000);

    expect(normalizeAccountSession({
      accessToken: 'token-1',
      user: { id: 'user-1', email: 'reader@example.com' },
      permissions: DEFAULT_ACCOUNT_PERMISSIONS,
      expiresAt: '1782218989',
      updatedAt: 123,
    })?.expiresAt).toBe(1_782_218_989_000);
  });

  it('rejects sessions without a token or user identity', () => {
    expect(normalizeAccountSession({
      accessToken: '',
      user: { id: 'user-1', email: 'reader@example.com' },
      permissions: DEFAULT_ACCOUNT_PERMISSIONS,
      expiresAt: 2_000_000_000_000,
      updatedAt: 123,
    })).toBeNull();
    expect(normalizeAccountSession({
      accessToken: 'token-1',
      user: { id: 'user-1', email: '' },
      permissions: DEFAULT_ACCOUNT_PERMISSIONS,
      expiresAt: 2_000_000_000_000,
      updatedAt: 123,
    })).toBeNull();
    expect(normalizeAccountSession({
      accessToken: 'token-1',
      user: { id: 'user-1', email: 'reader@example.com' },
      permissions: DEFAULT_ACCOUNT_PERMISSIONS,
      updatedAt: 123,
    })).toBeNull();
  });

  it('checks known permissions from the current session', () => {
    const session = normalizeAccountSession({
      accessToken: 'token-1',
      user: { id: 'user-1', email: 'reader@example.com' },
      permissions: { canSync: true, canPullServerData: false },
      expiresAt: 2_000_000_000_000,
      updatedAt: 123,
    });

    expect(hasAccountPermission(session, 'canSync')).toBe(true);
    expect(hasAccountPermission(session, 'canPullServerData')).toBe(false);
    expect(hasAccountPermission(null, 'canSync')).toBe(false);
  });

  it('derives login status from session expiry', () => {
    const session = normalizeAccountSession({
      accessToken: 'token-1',
      user: { id: 'user-1', email: 'reader@example.com' },
      permissions: DEFAULT_ACCOUNT_PERMISSIONS,
      expiresAt: 2_000_000_000_000,
      updatedAt: 123,
    });

    expect(accountLoginStatus(null, 1_999_999_999_999)).toBe('logged-out');
    expect(accountLoginStatus(session, 1_999_999_999_999)).toBe('logged-in');
    expect(accountLoginStatus(session, 2_000_000_000_000)).toBe('expired');
  });
});
