import { t, type MessageKey } from '../../../../src/i18n/messages';
import type { LanguageCode } from '../../../../src/settings/app-settings';
import type { SiteSettings } from '../../../../src/settings/site-settings';
import type { IndexOverview, SiteSnapshot } from '../../../../src/shared/messages';
import { fmtDate, fmtHeight, fmtPercent } from '../format';
import type { DetailTab, PageKey } from '../types';
import { SiteOverviewTab } from '../site-detail/SiteOverviewTab';
import { SitePagesTab } from '../site-detail/SitePagesTab';
import { SiteProgressTab } from '../site-detail/SiteProgressTab';

const DETAIL_TABS: DetailTab[] = ['overview', 'pages', 'progress'];

function detailTabLabel(language: LanguageCode, view: DetailTab): string {
  const labels: Record<DetailTab, MessageKey> = {
    overview: 'manager.overview',
    pages: 'manager.pages',
    progress: 'manager.progress',
  };
  return t(language, labels[view]);
}

type SiteDetailPageProps = {
  detailTab: DetailTab;
  language: LanguageCode;
  overviews: IndexOverview[];
  selected?: SiteSnapshot;
  siteSettings?: SiteSettings;
  clearAllProgress(): void;
  clearSelectedProgress(): void;
  deletePageProgress(url: string): void;
  deleteSelected(): void;
  saveSiteSettings(settings: Partial<SiteSettings>): void;
  selectDetailTab(detailTab: DetailTab): void;
  selectPage(page: PageKey): void;
  selectScope(siteId: string): void;
};

export function SiteDetailPage(props: SiteDetailPageProps) {
  const siteOverviews = props.selected
    ? props.overviews.filter((overview) => overview.site.host === props.selected?.site.host)
    : [];
  const selectedOverview = props.selected
    ? props.overviews.find((overview) => overview.site.siteId === props.selected?.site.siteId)
    : undefined;

  return (
    <section className="tables-layout">
      <section className="detail">
        <section className="detail-hero">
          <div>
            <p className="section-kicker">{t(props.language, 'manager.indexes')}</p>
            <h2>{props.selected?.site.host ?? t(props.language, 'manager.indexes')}</h2>
            <p className="muted">
              {props.selected
                ? `${props.selected.site.scopeTitle} · ${t(props.language, 'common.updated', { date: fmtDate(props.selected.site.updatedAt, props.language) })}`
                : t(props.language, 'manager.selectIndex')}
            </p>
          </div>
          {props.selected && (
            <div className="hero-progress">
              <span>{t(props.language, 'popup.totalProgress')}</span>
              <strong>{fmtPercent(selectedOverview?.totalPercent ?? 0)}</strong>
              <div className="hero-meter" aria-hidden="true">
                <i style={{ width: `${Math.min(100, Math.max(0, selectedOverview?.totalPercent ?? 0))}%` }} />
              </div>
            </div>
          )}
        </section>

        {props.selected && (
          <div className="scope-tabs" aria-label={t(props.language, 'manager.scope')}>
            {siteOverviews.map((overview) => (
              <button
                className={overview.site.siteId === props.selected?.site.siteId ? 'tab scope-tab active' : 'tab scope-tab'}
                key={overview.site.siteId}
                type="button"
                onClick={() => props.selectScope(overview.site.siteId)}
              >
                {overview.site.scopeTitle}
              </button>
            ))}
          </div>
        )}

        <div className="detail-nav">
          <button className="ghost" type="button" onClick={() => props.selectPage('sites')}>{t(props.language, 'manager.sites')}</button>
          <div className="tabs" aria-label={t(props.language, 'manager.tableViews')}>
            {DETAIL_TABS.map((view) => (
              <button className={props.detailTab === view ? 'tab active' : 'tab'} key={view} type="button" onClick={() => props.selectDetailTab(view)}>
                {detailTabLabel(props.language, view)}
              </button>
            ))}
          </div>
        </div>

        {props.detailTab === 'overview' && (
          <SiteOverviewTab
            clearAllProgress={props.clearAllProgress}
            clearSelectedProgress={props.clearSelectedProgress}
            deleteSelected={props.deleteSelected}
            fmtHeight={fmtHeight}
            fmtPercent={fmtPercent}
            language={props.language}
            selected={props.selected}
            siteSettings={props.siteSettings}
            saveSiteSettings={props.saveSiteSettings}
            totalPercent={selectedOverview?.totalPercent ?? 0}
          />
        )}

        {props.detailTab === 'pages' && (
          <SitePagesTab
            fmtHeight={fmtHeight}
            fmtPercent={fmtPercent}
            language={props.language}
            selected={props.selected}
          />
        )}

        {props.detailTab === 'progress' && (
          <SiteProgressTab
            deletePageProgress={props.deletePageProgress}
            fmtDate={(value) => fmtDate(value, props.language)}
            fmtHeight={fmtHeight}
            language={props.language}
            selected={props.selected}
          />
        )}
      </section>
    </section>
  );
}
