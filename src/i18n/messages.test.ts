import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type LanguageCode } from '../settings/app-settings';
import { EN_MESSAGES, MESSAGES, t } from './messages';

describe('i18n messages', () => {
  it('defines dictionaries for all supported languages with the same keys as English', () => {
    const englishKeys = Object.keys(EN_MESSAGES).sort();

    expect(Object.keys(MESSAGES).sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
    for (const language of SUPPORTED_LANGUAGES) {
      expect(Object.keys(MESSAGES[language]).sort()).toEqual(englishKeys);
    }
  });

  it('returns English strings for the default language', () => {
    expect(t(DEFAULT_LANGUAGE, 'manager.title')).toBe('Manager');
  });

  it('interpolates parameters in translated messages', () => {
    expect(t('en', 'manager.indexSummary', { count: '3', percent: '42%' })).toBe('3 pages · 42%');
  });

  it('falls back to English for unsupported languages', () => {
    expect(t('bad-code' as LanguageCode, 'manager.title')).toBe('Manager');
  });
});
