import { LANGUAGE_NAMES, t } from '../../../../src/i18n/messages';
import { SUPPORTED_LANGUAGES, type AppSettings, type LanguageCode } from '../../../../src/settings/app-settings';
import { boolLabel } from '../format';

type SettingsPageProps = {
  settings: AppSettings;
  saveSettings(settings: Partial<AppSettings>): void;
};

export function SettingsPage(props: SettingsPageProps) {
  const language = props.settings.language;

  return (
    <section className="panel settings-panel">
      <label className="switch-row">
        <span>
          <strong>{t(language, 'manager.showReadingMap')}</strong>
          <small>{t(language, 'manager.currentStatus', { status: boolLabel(language, props.settings.showReadingMap) })}</small>
        </span>
        <input
          checked={props.settings.showReadingMap}
          type="checkbox"
          onChange={(event) => props.saveSettings({ showReadingMap: event.currentTarget.checked })}
        />
        <i aria-hidden="true" />
      </label>
      <label className="switch-row">
        <span>
          <strong>{t(language, 'manager.defaultPageReadingProgress')}</strong>
          <small>{t(language, 'manager.defaultPageReadingProgressDescription')}</small>
        </span>
        <input
          checked={props.settings.defaultPageReadingProgressEnabled}
          type="checkbox"
          onChange={(event) => props.saveSettings({ defaultPageReadingProgressEnabled: event.currentTarget.checked })}
        />
        <i aria-hidden="true" />
      </label>
      <label className="switch-row">
        <span>
          <strong>{t(language, 'manager.debugIndexingLogs')}</strong>
          <small>{t(language, 'manager.currentStatus', { status: boolLabel(language, props.settings.debugIndexingLogs) })}</small>
        </span>
        <input
          checked={props.settings.debugIndexingLogs}
          type="checkbox"
          onChange={(event) => props.saveSettings({ debugIndexingLogs: event.currentTarget.checked })}
        />
        <i aria-hidden="true" />
      </label>
      <label className="select-row">
        <span>
          <strong>{t(language, 'manager.language')}</strong>
          <small>{t(language, 'manager.languageDescription')}</small>
        </span>
        <select
          value={props.settings.language}
          onChange={(event) => props.saveSettings({ language: event.currentTarget.value as LanguageCode })}
        >
          {SUPPORTED_LANGUAGES.map((code) => (
            <option key={code} value={code}>{LANGUAGE_NAMES[code]}</option>
          ))}
        </select>
      </label>
    </section>
  );
}
