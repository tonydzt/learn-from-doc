import { t } from '../../../../src/i18n/messages';
import type { LanguageCode } from '../../../../src/settings/app-settings';
import type { PageKey } from '../types';

type ModuleNavProps = {
  language: LanguageCode;
  page: PageKey;
  selectPage(page: PageKey): void;
};

export function ModuleNav(props: ModuleNavProps) {
  return (
    <aside className="module-nav">
      <div className="brand">
        <span>{t(props.language, 'common.brand')}</span>
        <strong>{t(props.language, 'manager.title')}</strong>
      </div>
      <button className={props.page === 'settings' ? 'module active' : 'module'} type="button" onClick={() => props.selectPage('settings')}>
        <span>{t(props.language, 'manager.settings')}</span>
        <small>{t(props.language, 'manager.pluginPreferences')}</small>
      </button>
      <button className={props.page !== 'settings' ? 'module active' : 'module'} type="button" onClick={() => props.selectPage('sites')}>
        <span>{t(props.language, 'manager.tables')}</span>
        <small>{t(props.language, 'manager.indexesAndRecords')}</small>
      </button>
    </aside>
  );
}
