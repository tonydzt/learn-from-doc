export type PageSettings = {
  readingProgressEnabled?: boolean;
};

export const DEFAULT_PAGE_SETTINGS: PageSettings = {};

export function normalizePageSettings(value: unknown): PageSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_PAGE_SETTINGS };
  const partial = value as Partial<PageSettings>;
  return {
    ...(typeof partial.readingProgressEnabled === 'boolean'
      ? { readingProgressEnabled: partial.readingProgressEnabled }
      : {}),
  };
}
