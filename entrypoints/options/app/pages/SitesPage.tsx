import type { RefObject } from 'react';
import { t } from '../../../../src/i18n/messages';
import type { LanguageCode } from '../../../../src/settings/app-settings';
import type { IndexOverview } from '../../../../src/shared/messages';
import { fmtDate, fmtPercent } from '../format';
import { groupOverviewsByHost } from '../site-groups';

type SitesPageProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  includePortableProgress: boolean;
  language: LanguageCode;
  overviews: IndexOverview[];
  downloadPortableData(scope: 'all' | 'site', siteId?: string): void;
  importPortableFile(file: File): void;
  selectSite(siteId: string): void;
  setIncludePortableProgress(value: boolean): void;
  uploadSiteIndexes(siteId: string[]): void;
  uploadingHost: string | null;
};

export function SitesPage(props: SitesPageProps) {
  const sites = groupOverviewsByHost(props.overviews);

  return (
    <section className="tables-layout">
      <section className="detail">
        <section className="portable-section">
          <div>
            <p className="section-kicker">{t(props.language, 'manager.backupAndImport')}</p>
            <h2>{t(props.language, 'manager.portableData')}</h2>
            <p className="muted">{t(props.language, 'manager.portableDataDescription')}</p>
          </div>
          <label className="portable-check">
            <input
              checked={props.includePortableProgress}
              type="checkbox"
              onChange={(event) => props.setIncludePortableProgress(event.currentTarget.checked)}
            />
            <span>{t(props.language, 'manager.includeReadingProgress')}</span>
          </label>
          <div className="portable-actions">
            <button className="ghost" type="button" onClick={() => props.downloadPortableData('all')}>{t(props.language, 'manager.exportAll')}</button>
            <button className="ghost" type="button" onClick={() => props.fileInputRef.current?.click()}>{t(props.language, 'manager.importFile')}</button>
            <input
              ref={props.fileInputRef}
              accept=".json,.gz,.lfd.json,.lfd.json.gz,application/json,application/gzip"
              hidden
              type="file"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) props.importPortableFile(file);
              }}
            />
          </div>
        </section>
        <section className="site-list-section">
          <div className="detail-toolbar">
            <div>
              <h2>{t(props.language, 'manager.sites')}</h2>
              <p className="muted">{sites.length === 0 ? t(props.language, 'manager.noIndexes') : t(props.language, 'manager.indexesAndRecords')}</p>
            </div>
          </div>
          <div className="site-list">
            {sites.length === 0 ? (
              <div className="empty">{t(props.language, 'manager.noIndexes')}</div>
            ) : sites.map((site) => (
              <div className="site-list-row" key={site.host}>
                <button className="site-list-main" type="button" onClick={() => props.selectSite(site.overviews[0]!.site.siteId)}>
                  <span>
                    <strong>{site.host}</strong>
                    <small>{t(props.language, 'manager.scope')}: {site.overviews.length} · {t(props.language, 'common.updated', { date: fmtDate(site.updatedAt, props.language) })}</small>
                  </span>
                  <span className="site-list-metrics">
                    <small>{t(props.language, 'manager.pages')}: {site.pageCount}</small>
                    <small>{t(props.language, 'manager.progress')}: {fmtPercent(site.totalPercent)}</small>
                  </span>
                </button>
                <div className="site-list-actions">
                  <button className="ghost" type="button" onClick={() => props.downloadPortableData('site', site.overviews[0]!.site.siteId)}>
                    {t(props.language, 'manager.exportSelectedSite')}
                  </button>
                  <button
                    className="ghost"
                    disabled={props.uploadingHost !== null}
                    type="button"
                    onClick={() => props.uploadSiteIndexes(site.overviews.map((overview) => overview.site.siteId))}
                  >
                    {props.uploadingHost === site.host
                      ? t(props.language, 'popup.uploadingToServer')
                      : t(props.language, 'popup.uploadToServer')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </section>
  );
}
