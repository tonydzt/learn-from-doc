import { DEFAULT_SITE_SETTINGS, normalizeSiteSettings } from './site-settings';

describe('normalizeSiteSettings', () => {
  it('returns defaults for empty storage values', () => {
    expect(normalizeSiteSettings(undefined)).toEqual(DEFAULT_SITE_SETTINGS);
    expect(normalizeSiteSettings(null)).toEqual(DEFAULT_SITE_SETTINGS);
  });

  it('preserves a stored reading progress flag', () => {
    expect(normalizeSiteSettings({ readingProgressEnabled: false })).toEqual({
      readingProgressEnabled: false,
    });
  });

  it('ignores invalid stored setting values', () => {
    expect(normalizeSiteSettings({ readingProgressEnabled: 'no' })).toEqual(DEFAULT_SITE_SETTINGS);
  });
});
