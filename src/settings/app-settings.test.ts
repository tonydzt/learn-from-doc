import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from './app-settings';

describe('normalizeAppSettings', () => {
  it('returns defaults for empty storage values', () => {
    expect(normalizeAppSettings(undefined)).toEqual(DEFAULT_APP_SETTINGS);
    expect(normalizeAppSettings(null)).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('merges stored settings with defaults', () => {
    expect(normalizeAppSettings({ showReadingMap: false, debugIndexingLogs: true })).toEqual({
      showReadingMap: false,
      debugIndexingLogs: true,
    });
  });

  it('ignores invalid stored setting values', () => {
    expect(normalizeAppSettings({ showReadingMap: 'no', debugIndexingLogs: 'yes' })).toEqual(DEFAULT_APP_SETTINGS);
  });
});
