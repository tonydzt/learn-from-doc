import { t } from '../../../../src/i18n/messages';
import { pageProgressPercent } from '../../../../src/progress/calculations';
import type { LanguageCode } from '../../../../src/settings/app-settings';
import type { SiteSnapshot } from '../../../../src/shared/messages';

type SitePagesTabProps = {
  language: LanguageCode;
  selected?: SiteSnapshot;
  fmtHeight(value: number): string;
  fmtPercent(value: number): string;
};

export function SitePagesTab(props: SitePagesTabProps) {
  const progressByUrl = new Map(props.selected?.progress.map((item) => [item.url, item]) ?? []);

  return (
    <div className="table">
      <div className="row pages-header">
        <span>{t(props.language, 'manager.page')}</span>
        <span>{t(props.language, 'manager.height')}</span>
        <span>{t(props.language, 'manager.progress')}</span>
      </div>
      {props.selected?.pages.map((page) => {
        const progress = progressByUrl.get(page.url);
        return (
          <a className="row" href={page.url} key={page.url} rel="noreferrer" target="_blank">
            <span>{page.title}</span>
            <span>{props.fmtHeight(page.contentHeight)}</span>
            <span>{props.fmtPercent(pageProgressPercent(page, progress))}</span>
          </a>
        );
      }) ?? <div className="empty">{t(props.language, 'manager.selectIndexPages')}</div>}
    </div>
  );
}
