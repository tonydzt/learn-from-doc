import { browser } from 'wxt/browser';
import { APP_SETTINGS_STORAGE_KEY, normalizeAppSettings, type AppSettings } from '../settings/app-settings';

export async function getAppSettings(): Promise<AppSettings> {
  const values = await browser.storage.local.get(APP_SETTINGS_STORAGE_KEY);
  return normalizeAppSettings(values[APP_SETTINGS_STORAGE_KEY]);
}

export async function saveAppSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const next = normalizeAppSettings({ ...current, ...settings });
  await browser.storage.local.set({ [APP_SETTINGS_STORAGE_KEY]: next });
  return next;
}
