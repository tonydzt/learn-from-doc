import {
  accountLoginStatus,
  hasAccountPermission,
  normalizeAccountSession,
  type AccountSession,
  type KnownAccountPermission,
} from '../../settings/account-session';
import {
  clearStoredAccountSession,
  getStoredAccountSession,
  saveStoredAccountSession,
} from '../../storage/settings';
import { API_ORIGIN } from './api';

const TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1_000;

type AccountAuth = {
  session: AccountSession;
  headers: { Authorization: string };
};

type RefreshResponse = {
  accessToken?: unknown;
  refreshToken?: unknown;
  expiresAt?: unknown;
};

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function permissionErrorMessage(permission: KnownAccountPermission): string {
  if (permission === 'canSync') return 'Multi-device sync is not enabled for this account.';
  if (permission === 'canTestSystemIndexes') return 'System index testing is not enabled for this account.';
  return 'Server data pull is not enabled for this account.';
}

function shouldRefreshAccountSession(session: AccountSession, now: number): boolean {
  return now + TOKEN_REFRESH_WINDOW_MS >= session.expiresAt;
}

async function refreshAccountSession(session: AccountSession, now: number): Promise<AccountSession> {
  if (!session.refreshToken) throw new Error('Login expired. Please log in again.');

  const response = await fetch(`${API_ORIGIN}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  const payload = await readJson(response) as RefreshResponse;
  if (response.status === 401) {
    await clearStoredAccountSession();
    throw new Error('Login expired. Please log in again.');
  }
  if (!response.ok) throw new Error('Login expired. Please log in again.');

  const next = accountSessionWithRefreshedTokens(session, payload, now);
  if (!next) {
    await clearStoredAccountSession();
    throw new Error('Login expired. Please log in again.');
  }
  return saveStoredAccountSession(next);
}

function accountSessionWithRefreshedTokens(
  session: AccountSession,
  payload: RefreshResponse,
  now: number,
): AccountSession | null {
  return normalizeAccountSession({
    ...session,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    expiresAt: payload.expiresAt,
    updatedAt: now,
  });
}

export async function requireAccountAuth(
  permissions?: KnownAccountPermission | KnownAccountPermission[],
  now = Date.now(),
): Promise<AccountAuth> {
  let session = await getStoredAccountSession();
  if (!session) throw new Error('Please log in first.');
  if (shouldRefreshAccountSession(session, now)) session = await refreshAccountSession(session, now);
  if (accountLoginStatus(session, now) === 'expired') throw new Error('Login expired. Please log in again.');

  const required = Array.isArray(permissions) ? permissions : permissions ? [permissions] : [];
  for (const permission of required) {
    if (!hasAccountPermission(session, permission)) throw new Error(permissionErrorMessage(permission));
  }

  return {
    session,
    headers: { Authorization: `Bearer ${session.accessToken}` },
  };
}
