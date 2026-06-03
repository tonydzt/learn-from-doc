import { DEFAULT_PAGE_SETTINGS, normalizePageSettings } from './page-settings';

describe('normalizePageSettings', () => {
  it('returns defaults for empty storage values', () => {
    expect(normalizePageSettings(undefined)).toEqual(DEFAULT_PAGE_SETTINGS);
    expect(normalizePageSettings(null)).toEqual(DEFAULT_PAGE_SETTINGS);
  });

  it('preserves a stored reading progress override', () => {
    expect(normalizePageSettings({ readingProgressEnabled: false })).toEqual({
      readingProgressEnabled: false,
    });
  });

  it('ignores invalid stored setting values', () => {
    expect(normalizePageSettings({ readingProgressEnabled: 'no' })).toEqual(DEFAULT_PAGE_SETTINGS);
  });
});
