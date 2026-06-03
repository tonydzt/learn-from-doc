export const SUPPORTED_LANGUAGES = [
  'en',
  'zh-CN',
  'zh-TW',
  'es',
  'fr',
  'de',
  'ja',
  'ko',
  'pt',
  'ru',
  'ar',
  'hi',
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export type AppSettings = {
  showReadingMap: boolean;
  defaultPageReadingProgressEnabled: boolean;
  debugIndexingLogs: boolean;
  language: LanguageCode;
};

export const APP_SETTINGS_STORAGE_KEY = 'learnFromDocSettings';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  showReadingMap: true,
  defaultPageReadingProgressEnabled: true,
  debugIndexingLogs: false,
  language: DEFAULT_LANGUAGE,
};

export function isSupportedLanguage(value: unknown): value is LanguageCode {
  return typeof value === 'string' && SUPPORTED_LANGUAGES.includes(value as LanguageCode);
}

export function normalizeAppSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_APP_SETTINGS };
  const partial = value as Partial<AppSettings>;
  return {
    showReadingMap: typeof partial.showReadingMap === 'boolean'
      ? partial.showReadingMap
      : DEFAULT_APP_SETTINGS.showReadingMap,
    defaultPageReadingProgressEnabled: typeof partial.defaultPageReadingProgressEnabled === 'boolean'
      ? partial.defaultPageReadingProgressEnabled
      : DEFAULT_APP_SETTINGS.defaultPageReadingProgressEnabled,
    debugIndexingLogs: typeof partial.debugIndexingLogs === 'boolean'
      ? partial.debugIndexingLogs
      : DEFAULT_APP_SETTINGS.debugIndexingLogs,
    language: isSupportedLanguage(partial.language)
      ? partial.language
      : DEFAULT_APP_SETTINGS.language,
  };
}
