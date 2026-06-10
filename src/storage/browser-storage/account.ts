import { browser } from 'wxt/browser';
import {
  ACCOUNT_SESSION_STORAGE_KEY,
  normalizeAccountSession,
  type AccountSession,
} from '../../settings/account-session';

export async function getStoredAccountSession(): Promise<AccountSession | null> {
  const values = await browser.storage.local.get(ACCOUNT_SESSION_STORAGE_KEY);
  return normalizeAccountSession(values[ACCOUNT_SESSION_STORAGE_KEY]);
}

export async function saveStoredAccountSession(session: AccountSession): Promise<AccountSession> {
  const next = normalizeAccountSession(session);
  if (!next) throw new Error('Invalid account session');
  await browser.storage.local.set({ [ACCOUNT_SESSION_STORAGE_KEY]: next });
  return next;
}

export async function clearStoredAccountSession(): Promise<void> {
  await browser.storage.local.remove(ACCOUNT_SESSION_STORAGE_KEY);
}
