import { t } from '../../../../src/i18n/messages';
import type { LanguageCode } from '../../../../src/settings/app-settings';
import type { SiteSnapshot } from '../../../../src/shared/messages';

type SiteProgressTabProps = {
  language: LanguageCode;
  selected?: SiteSnapshot;
  fmtDate(value: number): string;
  fmtHeight(value: number): string;
  deletePageProgress(url: string): void;
};

export function SiteProgressTab(props: SiteProgressTabProps) {
  return (
    <div className="table">
      <div className="row progress-header">
        <span>{t(props.language, 'manager.url')}</span>
        <span>{t(props.language, 'manager.viewed')}</span>
        <span>{t(props.language, 'manager.ranges')}</span>
        <span>{t(props.language, 'common.updatedLabel')}</span>
        <span aria-hidden="true" />
      </div>
      {props.selected?.progress.map((progress) => (
        <div className="row progress-row" key={progress.url}>
          <a href={progress.url} rel="noreferrer" target="_blank">{progress.url}</a>
          <span>{props.fmtHeight(progress.viewedHeight)}</span>
          <span>{progress.viewedRanges.length}</span>
          <span>{props.fmtDate(progress.updatedAt)}</span>
          <button
            className="danger ghost"
            type="button"
            onClick={() => props.deletePageProgress(progress.url)}
          >
            {t(props.language, 'manager.deletePageProgress')}
          </button>
        </div>
      )) ?? <div className="empty">{t(props.language, 'manager.selectIndexProgress')}</div>}
    </div>
  );
}
