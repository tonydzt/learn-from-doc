export type AccountUser = {
  id: string;
  email: string;
  name?: string;
};

export type KnownAccountPermission = 'canSync' | 'canPullServerData' | 'canTestSystemIndexes';

export type AccountPermissions = Record<string, boolean> & Record<KnownAccountPermission, boolean>;

export type VisibleAccountPermission = {
  key: string;
  label: string;
};

export type AccountSession = {
  accessToken: string;
  refreshToken?: string;
  user: AccountUser;
  permissions: AccountPermissions;
  visiblePermissions: VisibleAccountPermission[];
  expiresAt: number;
  updatedAt: number;
};

export type AccountLoginStatus = 'logged-out' | 'logged-in' | 'expired';

export const ACCOUNT_SESSION_STORAGE_KEY = 'learnFromDocAccountSession';

export const DEFAULT_ACCOUNT_PERMISSIONS: AccountPermissions = {
  canSync: false,
  canPullServerData: false,
  canTestSystemIndexes: false,
};

const VISIBLE_PERMISSION_LABELS: Record<KnownAccountPermission, string> = {
  canSync: 'Multi-device sync',
  canPullServerData: 'Server data pull',
  canTestSystemIndexes: 'Test system indexes',
};

export function normalizeAccountPermissions(value: unknown): AccountPermissions {
  const entries = value && typeof value === 'object'
    ? Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')
    : [];
  return {
    ...DEFAULT_ACCOUNT_PERMISSIONS,
    ...Object.fromEntries(entries),
  };
}

function normalizeVisibleAccountPermissions(
  value: unknown,
  permissions: AccountPermissions,
  rawPermissions: unknown,
): VisibleAccountPermission[] {
  if (!Array.isArray(value)) {
    if (!rawPermissions || typeof rawPermissions !== 'object') return [];
    return Object.keys(rawPermissions).flatMap((key) => {
      if (!Object.prototype.hasOwnProperty.call(VISIBLE_PERMISSION_LABELS, key)) return [];
      if (typeof (rawPermissions as Record<string, unknown>)[key] !== 'boolean') return [];
      if (!Object.prototype.hasOwnProperty.call(permissions, key)) return [];
      return [{ key, label: VISIBLE_PERMISSION_LABELS[key as KnownAccountPermission] }];
    });
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const partial = entry as Partial<VisibleAccountPermission>;
    if (typeof partial.key !== 'string' || partial.key.trim().length === 0) return [];
    if (typeof partial.label !== 'string' || partial.label.trim().length === 0) return [];
    if (!Object.prototype.hasOwnProperty.call(permissions, partial.key)) return [];
    return [{ key: partial.key, label: partial.label }];
  });
}

function normalizeAccountUser(value: unknown): AccountUser | null {
  if (!value || typeof value !== 'object') return null;
  const partial = value as Partial<AccountUser>;
  if (typeof partial.id !== 'string' || partial.id.length === 0) return null;
  if (typeof partial.email !== 'string' || partial.email.length === 0) return null;
  return {
    id: partial.id,
    email: partial.email,
    ...(typeof partial.name === 'string' && partial.name.length > 0 ? { name: partial.name } : {}),
  };
}

function normalizeExpiresAt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1_000 : value;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    return numeric < 10_000_000_000 ? numeric * 1_000 : numeric;
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeAccountSession(value: unknown): AccountSession | null {
  if (!value || typeof value !== 'object') return null;
  const partial = value as Partial<AccountSession>;
  const user = normalizeAccountUser(partial.user);
  const permissions = normalizeAccountPermissions(partial.permissions);
  const expiresAt = normalizeExpiresAt(partial.expiresAt);
  if (typeof partial.accessToken !== 'string' || partial.accessToken.length === 0) return null;
  if (expiresAt === null) return null;
  if (!user) return null;
  return {
    accessToken: partial.accessToken,
    ...(typeof partial.refreshToken === 'string' && partial.refreshToken.length > 0 ? { refreshToken: partial.refreshToken } : {}),
    user,
    permissions,
    visiblePermissions: normalizeVisibleAccountPermissions(partial.visiblePermissions, permissions, partial.permissions),
    expiresAt,
    updatedAt: typeof partial.updatedAt === 'number' && Number.isFinite(partial.updatedAt) ? partial.updatedAt : Date.now(),
  };
}

export function hasAccountPermission(session: AccountSession | null, permission: KnownAccountPermission): boolean {
  return session?.permissions[permission] === true;
}

export function accountLoginStatus(session: AccountSession | null, now = Date.now()): AccountLoginStatus {
  if (!session) return 'logged-out';
  return now >= session.expiresAt ? 'expired' : 'logged-in';
}
