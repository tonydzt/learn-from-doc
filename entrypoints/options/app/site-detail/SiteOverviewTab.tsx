import { t } from '../../../../src/i18n/messages';
import type { LanguageCode } from '../../../../src/settings/app-settings';
import type { SiteSettings } from '../../../../src/settings/site-settings';
import type { SiteSnapshot } from '../../../../src/shared/messages';
import { boolLabel } from '../format';

type SiteOverviewTabProps = {
  selected?: SiteSnapshot;
  siteSettings?: SiteSettings;
  language: LanguageCode;
  totalPages: number;
  totalProgressRows: number;
  totalPercent: number;
  clearAllProgress(): void;
  clearSelectedProgress(): void;
  deleteSelected(): void;
  fmtHeight(value: number): string;
  fmtPercent(value: number): string;
  saveSiteSettings(settings: Partial<SiteSettings>): void;
};

export function SiteOverviewTab(props: SiteOverviewTabProps) {
  if (!props.selected) {
    return <div className="empty">{t(props.language, 'manager.selectIndexDetails')}</div>;
  }

  const totalHeight = props.selected.pages.reduce((sum, page) => sum + page.contentHeight, 0);
  const totalViewed = props.selected.progress.reduce((sum, progress) => sum + progress.viewedHeight, 0);

  return (
    <>
      <section className="site-settings-section">
        <div>
          <p className="section-kicker">{t(props.language, 'manager.siteSettings')}</p>
          <h2>{props.selected.site.scopeTitle}</h2>
          <p className="muted">{t(props.language, 'manager.siteSettingsDescription')}</p>
        </div>
        <label className="switch-row compact-switch">
          <span>
            <strong>{t(props.language, 'manager.enableSiteReadingProgress')}</strong>
            <small>{t(props.language, 'manager.currentStatus', {
              status: boolLabel(props.language, props.siteSettings?.readingProgressEnabled ?? true),
            })}</small>
          </span>
          <input
            checked={props.siteSettings?.readingProgressEnabled ?? true}
            type="checkbox"
            onChange={(event) => props.saveSiteSettings({ readingProgressEnabled: event.currentTarget.checked })}
          />
          <i aria-hidden="true" />
        </label>
      </section>

      <div className="stats">
        <div className="stat-card primary-stat"><span>{t(props.language, 'popup.totalProgress')}</span><strong>{props.fmtPercent(props.totalPercent)}</strong></div>
        <div className="stat-card"><span>{t(props.language, 'manager.pages')}</span><strong>{props.selected.pages.length} / {props.totalPages}</strong></div>
        <div className="stat-card"><span>{t(props.language, 'manager.progressRows')}</span><strong>{props.selected.progress.length} / {props.totalProgressRows}</strong></div>
        <div className="stat-card"><span>{t(props.language, 'manager.totalHeight')}</span><strong>{props.fmtHeight(totalHeight)}</strong></div>
        <div className="stat-card"><span>{t(props.language, 'manager.viewedHeight')}</span><strong>{props.fmtHeight(totalViewed)}</strong></div>
        <div className="stat-card id-stat"><span>{t(props.language, 'manager.siteId')}</span><strong className="compact">{props.selected.site.siteId}</strong></div>
      </div>

      <div className="danger-zone">
        <div>
          <p className="section-kicker">{t(props.language, 'manager.dangerZone')}</p>
          <h2>{t(props.language, 'manager.safeDestructiveActions')}</h2>
          <p className="muted">{t(props.language, 'manager.dangerDescription')}</p>
        </div>
        <div className="danger-actions">
          <button className="danger" type="button" onClick={props.clearSelectedProgress}>{t(props.language, 'manager.clearSiteProgress')}</button>
          <button className="danger" type="button" onClick={props.clearAllProgress}>{t(props.language, 'manager.clearAllProgress')}</button>
          <button className="danger strong" type="button" onClick={props.deleteSelected}>{t(props.language, 'manager.deleteIndex')}</button>
        </div>
      </div>
    </>
  );
}
