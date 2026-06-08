import type { RefObject } from 'react';
import { t } from '../../../../src/i18n/messages';
import type { LanguageCode } from '../../../../src/settings/app-settings';
import type { IndexOverview } from '../../../../src/shared/messages';
import { fmtDate, fmtPercent } from '../format';

type SitesPageProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  includePortableProgress: boolean;
  language: LanguageCode;
  overviews: IndexOverview[];
  downloadPortableData(scope: 'all' | 'site', siteId?: string): void;
  importPortableFile(file: File): void;
  selectSite(siteId: string): void;
  setIncludePortableProgress(value: boolean): void;
};

export function SitesPage(props: SitesPageProps) {
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
              <p className="muted">{props.overviews.length === 0 ? t(props.language, 'manager.noIndexes') : t(props.language, 'manager.indexesAndRecords')}</p>
            </div>
          </div>
          <div className="site-list">
            {props.overviews.length === 0 ? (
              <div className="empty">{t(props.language, 'manager.noIndexes')}</div>
            ) : props.overviews.map((overview) => (
              <div className="site-list-row" key={overview.site.siteId}>
                <button className="site-list-main" type="button" onClick={() => props.selectSite(overview.site.siteId)}>
                  <span>
                    <strong>{overview.site.scopeTitle}</strong>
                    <small>{overview.site.host} · {t(props.language, 'common.updated', { date: fmtDate(overview.updatedAt, props.language) })}</small>
                  </span>
                  <span className="site-list-metrics">
                    <small>{t(props.language, 'manager.pages')}: {overview.pageCount}</small>
                    <small>{t(props.language, 'manager.progress')}: {fmtPercent(overview.totalPercent)}</small>
                  </span>
                </button>
                <button className="ghost" type="button" onClick={() => props.downloadPortableData('site', overview.site.siteId)}>
                  {t(props.language, 'manager.exportSelectedSite')}
                </button>
              </div>
            ))}
          </div>
        </section>
      </section>
    </section>
  );
}
