export type AccountUser = {
  id: string;
  email: string;
  name?: string;
};

export type AccountPermissions = {
  canSync: boolean;
  canPullServerData: boolean;
};

export type AccountSession = {
  accessToken: string;
  user: AccountUser;
  permissions: AccountPermissions;
  updatedAt: number;
};

export const ACCOUNT_SESSION_STORAGE_KEY = 'learnFromDocAccountSession';

export const DEFAULT_ACCOUNT_PERMISSIONS: AccountPermissions = {
  canSync: false,
  canPullServerData: false,
};

export function normalizeAccountPermissions(value: unknown): AccountPermissions {
  const partial = value && typeof value === 'object' ? value as Partial<AccountPermissions> : {};
  return {
    canSync: typeof partial.canSync === 'boolean' ? partial.canSync : false,
    canPullServerData: typeof partial.canPullServerData === 'boolean' ? partial.canPullServerData : false,
  };
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

export function normalizeAccountSession(value: unknown): AccountSession | null {
  if (!value || typeof value !== 'object') return null;
  const partial = value as Partial<AccountSession>;
  const user = normalizeAccountUser(partial.user);
  if (typeof partial.accessToken !== 'string' || partial.accessToken.length === 0) return null;
  if (!user) return null;
  return {
    accessToken: partial.accessToken,
    user,
    permissions: normalizeAccountPermissions(partial.permissions),
    updatedAt: typeof partial.updatedAt === 'number' && Number.isFinite(partial.updatedAt) ? partial.updatedAt : Date.now(),
  };
}

export function hasAccountPermission(session: AccountSession | null, permission: keyof AccountPermissions): boolean {
  return session?.permissions[permission] === true;
}
