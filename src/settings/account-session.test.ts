import {
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
      },
      updatedAt: 123,
    });
  });

  it('rejects sessions without a token or user identity', () => {
    expect(normalizeAccountSession({
      accessToken: '',
      user: { id: 'user-1', email: 'reader@example.com' },
      permissions: DEFAULT_ACCOUNT_PERMISSIONS,
      updatedAt: 123,
    })).toBeNull();
    expect(normalizeAccountSession({
      accessToken: 'token-1',
      user: { id: 'user-1', email: '' },
      permissions: DEFAULT_ACCOUNT_PERMISSIONS,
      updatedAt: 123,
    })).toBeNull();
  });

  it('checks known permissions from the current session', () => {
    const session = normalizeAccountSession({
      accessToken: 'token-1',
      user: { id: 'user-1', email: 'reader@example.com' },
      permissions: { canSync: true, canPullServerData: false },
      updatedAt: 123,
    });

    expect(hasAccountPermission(session, 'canSync')).toBe(true);
    expect(hasAccountPermission(session, 'canPullServerData')).toBe(false);
    expect(hasAccountPermission(null, 'canSync')).toBe(false);
  });
});
