import {
  normalizeAccountPermissions,
  normalizeAccountSession,
  type AccountSession,
} from '../../settings/account-session';
import {
  clearStoredAccountSession,
  getStoredAccountSession,
  saveStoredAccountSession,
} from '../../storage/settings';
import { API_ORIGIN } from './api';
import { requireAccountAuth } from './account-auth';


type LoginResponse = {
  accessToken?: unknown;
  refreshToken?: unknown;
  user?: unknown;
  permissions?: unknown;
  visiblePermissions?: unknown;
  expiresAt?: unknown;
};

type PermissionsResponse = {
  user?: unknown;
  permissions?: unknown;
  visiblePermissions?: unknown;
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

function errorMessageFromPayload(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const error = (payload as { error?: unknown; message?: unknown }).error ?? (payload as { message?: unknown }).message;
  return typeof error === 'string' && error.length > 0 ? error : fallback;
}

export async function getAccountSessionForBackground(): Promise<AccountSession | null> {
  return getStoredAccountSession();
}

export async function loginAccountForBackground(email: string, password: string): Promise<AccountSession> {
  const response = await fetch(`${API_ORIGIN}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const payload = await readJson(response) as LoginResponse;
  if (!response.ok) {
    throw new Error(errorMessageFromPayload(payload, 'Login failed'));
  }

  const session = normalizeAccountSession({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user,
    permissions: payload.permissions,
    visiblePermissions: payload.visiblePermissions,
    expiresAt: payload.expiresAt,
    updatedAt: Date.now(),
  });
  if (!session) throw new Error('Login response is invalid');
  return saveStoredAccountSession(session);
}

export async function logoutAccountForBackground(): Promise<null> {
  await clearStoredAccountSession();
  return null;
}

export async function refreshAccountPermissionsForBackground(): Promise<AccountSession | null> {
  const { session: current, headers } = await requireAccountAuth();

  const response = await fetch(`${API_ORIGIN}/api/me/permissions`, {
    method: 'GET',
    headers,
  });
  const payload = await readJson(response) as PermissionsResponse;
  if (response.status === 401) {
    await clearStoredAccountSession();
    return null;
  }
  if (!response.ok) {
    throw new Error(errorMessageFromPayload(payload, 'Could not refresh permissions'));
  }

  const next = normalizeAccountSession({
    ...current,
    user: payload.user ?? current.user,
    permissions: normalizeAccountPermissions(payload.permissions),
    visiblePermissions: payload.visiblePermissions,
    updatedAt: Date.now(),
  });
  if (!next) {
    await clearStoredAccountSession();
    return null;
  }
  return saveStoredAccountSession(next);
}
