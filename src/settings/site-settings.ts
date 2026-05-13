export type SiteSettings = {
  readingProgressEnabled: boolean;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  readingProgressEnabled: true,
};

export function normalizeSiteSettings(value: unknown): SiteSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SITE_SETTINGS };
  const partial = value as Partial<SiteSettings>;
  return {
    readingProgressEnabled: typeof partial.readingProgressEnabled === 'boolean'
      ? partial.readingProgressEnabled
      : DEFAULT_SITE_SETTINGS.readingProgressEnabled,
  };
}
