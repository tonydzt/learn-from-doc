import { t } from '../../../../src/i18n/messages';
import type { LanguageCode } from '../../../../src/settings/app-settings';
import type { SiteSnapshot } from '../../../../src/shared/messages';

type SiteProgressTabProps = {
  language: LanguageCode;
  selected?: SiteSnapshot;
  fmtDate(value: number): string;
  fmtHeight(value: number): string;
};

export function SiteProgressTab(props: SiteProgressTabProps) {
  return (
    <div className="table">
      <div className="row progress-header">
        <span>{t(props.language, 'manager.url')}</span>
        <span>{t(props.language, 'manager.viewed')}</span>
        <span>{t(props.language, 'manager.ranges')}</span>
        <span>{t(props.language, 'common.updatedLabel')}</span>
      </div>
      {props.selected?.progress.map((progress) => (
        <a className="row progress-row" href={progress.url} key={progress.url} rel="noreferrer" target="_blank">
          <span>{progress.url}</span>
          <span>{props.fmtHeight(progress.viewedHeight)}</span>
          <span>{progress.viewedRanges.length}</span>
          <span>{props.fmtDate(progress.updatedAt)}</span>
        </a>
      )) ?? <div className="empty">{t(props.language, 'manager.selectIndexProgress')}</div>}
    </div>
  );
}
