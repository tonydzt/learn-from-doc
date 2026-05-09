export type AppSettings = {
  showReadingMap: boolean;
};

export const APP_SETTINGS_STORAGE_KEY = 'learnFromDocSettings';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  showReadingMap: true,
};

export function normalizeAppSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_APP_SETTINGS };
  const partial = value as Partial<AppSettings>;
  return {
    showReadingMap: typeof partial.showReadingMap === 'boolean'
      ? partial.showReadingMap
      : DEFAULT_APP_SETTINGS.showReadingMap,
  };
}
