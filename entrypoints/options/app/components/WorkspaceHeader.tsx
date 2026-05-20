import { t } from '../../../../src/i18n/messages';
import type { LanguageCode } from '../../../../src/settings/app-settings';

type WorkspaceHeaderProps = {
  language: LanguageCode;
  pageTitle: string;
  refresh(): void;
};

export function WorkspaceHeader(props: WorkspaceHeaderProps) {
  return (
    <header className="masthead">
      <div>
        <p className="page-title">{props.pageTitle}</p>
      </div>
      <button className="ghost" type="button" onClick={props.refresh}>{t(props.language, 'common.refresh')}</button>
    </header>
  );
}
