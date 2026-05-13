import React from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { LANGUAGE_NAMES, t, type MessageKey } from '../../src/i18n/messages';
import { pageProgressPercent } from '../../src/progress/calculations';
import { SUPPORTED_LANGUAGES, type AppSettings, type LanguageCode } from '../../src/settings/app-settings';
import type { SiteSettings } from '../../src/settings/site-settings';
import type {
  IndexOverview,
  PortableExportResult,
  PortableImportPreviewResult,
  PortableImportResultMessage,
  RuntimeMessage,
  SiteSnapshot,
} from '../../src/shared/messages';
import { parsePortableData, portableSerializedBlobPart } from '../../src/storage/portable-data';
import './style.css';

type PageKey = 'settings' | 'sites' | 'siteDetail';
type DetailTab = 'overview' | 'pages' | 'progress';

type ManagerState =
  | { status: 'loading' }
  | {
    status: 'ready';
    page: PageKey;
    detailTab: DetailTab;
    overviews: IndexOverview[];
    selected?: SiteSnapshot;
    siteSettings?: SiteSettings;
    settings: AppSettings;
  }
  | { status: 'error'; message: string };

function fmtPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function fmtDate(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function fmtHeight(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k px`;
  return `${Math.round(value)} px`;
}

function boolLabel(language: LanguageCode, value: boolean): string {
  return value ? t(language, 'common.on') : t(language, 'common.off');
}

const DETAIL_TABS: DetailTab[] = ['overview', 'pages', 'progress'];

function detailTabLabel(language: LanguageCode, view: DetailTab): string {
  const labels: Record<DetailTab, MessageKey> = {
    overview: 'manager.overview',
    pages: 'manager.pages',
    progress: 'manager.progress',
  };
  return t(language, labels[view]);
}

function App() {
  const requestedSiteId = React.useMemo(() => new URLSearchParams(location.search).get('siteId') ?? undefined, []);
  const initialPage: PageKey = requestedSiteId ? 'siteDetail' : 'sites';
  const [state, setState] = React.useState<ManagerState>({ status: 'loading' });
  const [includePortableProgress, setIncludePortableProgress] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async (
    siteId?: string,
    page: PageKey = initialPage,
    detailTab: DetailTab = 'overview',
  ) => {
    // options 是扩展的管理后台页面。它不直接读数据库，而是通过 background 的 message API
    // 一次加载索引概览、设置，以及当前选中站点的完整快照。
    setState({ status: 'loading' });
    try {
      const [overviews, settings] = await Promise.all([
        browser.runtime.sendMessage({ type: 'GET_INDEX_OVERVIEWS' } satisfies RuntimeMessage) as Promise<IndexOverview[]>,
        browser.runtime.sendMessage({ type: 'GET_APP_SETTINGS' } satisfies RuntimeMessage) as Promise<AppSettings>,
      ]);
      const selectedSiteId = page === 'siteDetail' ? siteId ?? requestedSiteId ?? overviews[0]?.site.siteId : undefined;
      const selected = selectedSiteId
        ? await browser.runtime.sendMessage({ type: 'GET_SITE_SNAPSHOT', siteId: selectedSiteId } satisfies RuntimeMessage) as SiteSnapshot | undefined
        : undefined;
      const siteSettings = selected
        ? await browser.runtime.sendMessage({ type: 'GET_SITE_SETTINGS', siteId: selected.site.siteId } satisfies RuntimeMessage) as SiteSettings
        : undefined;
      setState({ status: 'ready', page, detailTab, overviews, selected, siteSettings, settings });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Could not load manager data.',
      });
    }
  }, [initialPage, requestedSiteId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const selectPage = (page: PageKey) => {
    if (state.status !== 'ready') return;
    if (page === 'siteDetail') return;
    window.history.replaceState(null, '', location.pathname);
    void load(undefined, page, 'overview');
  };

  const selectDetailTab = (detailTab: DetailTab) => {
    if (state.status !== 'ready') return;
    setState({ ...state, detailTab });
  };

  const saveSettings = async (settings: Partial<AppSettings>) => {
    if (state.status !== 'ready') return;
    const next = await browser.runtime.sendMessage({ type: 'SAVE_APP_SETTINGS', settings } satisfies RuntimeMessage) as AppSettings;
    setState({ ...state, settings: next });
  };

  const saveSiteSettings = async (settings: Partial<SiteSettings>) => {
    if (state.status !== 'ready' || !state.selected) return;
    const next = await browser.runtime.sendMessage({
      type: 'SAVE_SITE_SETTINGS',
      siteId: state.selected.site.siteId,
      settings,
    } satisfies RuntimeMessage) as SiteSettings;
    setState({ ...state, siteSettings: next });
  };

  const selectSite = async (siteId: string) => {
    if (state.status !== 'ready') return;
    window.history.replaceState(null, '', `${location.pathname}?siteId=${encodeURIComponent(siteId)}`);
    await load(siteId, 'siteDetail', 'overview');
  };

  const deleteSelected = async () => {
    if (state.status !== 'ready' || !state.selected) return;
    const { siteId, scopeTitle } = state.selected.site;
    if (!window.confirm(t(state.settings.language, 'manager.confirmDeleteIndex', { title: scopeTitle }))) return;
    await browser.runtime.sendMessage({ type: 'DELETE_SITE_INDEX', siteId } satisfies RuntimeMessage);
    window.history.replaceState(null, '', location.pathname);
    await load(undefined, 'sites', 'overview');
  };

  const clearSelectedProgress = async () => {
    if (state.status !== 'ready' || !state.selected) return;
    const { siteId, scopeTitle } = state.selected.site;
    if (!window.confirm(t(state.settings.language, 'manager.confirmClearSiteProgress', { title: scopeTitle }))) return;
    await browser.runtime.sendMessage({ type: 'CLEAR_SITE_PROGRESS', siteId } satisfies RuntimeMessage);
    await load(siteId, 'siteDetail', state.detailTab);
  };

  const clearAllProgress = async () => {
    if (state.status !== 'ready') return;
    if (!window.confirm(t(state.settings.language, 'manager.confirmClearAllProgress'))) return;
    await browser.runtime.sendMessage({ type: 'CLEAR_ALL_PROGRESS' } satisfies RuntimeMessage);
    await load(state.selected?.site.siteId, state.page, state.detailTab);
  };

  const downloadPortableData = async (scope: 'all' | 'site', siteId?: string) => {
    if (state.status !== 'ready') return;
    if (scope === 'site' && !siteId) return;
    try {
      const result = await browser.runtime.sendMessage({
        type: 'EXPORT_PORTABLE_DATA',
        scope,
        siteId,
        includeProgress: includePortableProgress,
      } satisfies RuntimeMessage) as PortableExportResult;
      const blob = new Blob([portableSerializedBlobPart(result)], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t(state.settings.language, 'manager.exportFailed'));
    }
  };

  const importPortableFile = async (file: File) => {
    if (state.status !== 'ready') return;
    try {
      const payload = await parsePortableData(await file.arrayBuffer());
      const previewResult = await browser.runtime.sendMessage({
        type: 'PREVIEW_PORTABLE_IMPORT',
        payload,
      } satisfies RuntimeMessage) as PortableImportPreviewResult;
      const overwriteSiteIds = previewResult.preview.conflicts.length > 0
        && window.confirm(t(state.settings.language, 'manager.confirmImportOverwrite', { count: previewResult.preview.conflicts.length }))
        ? previewResult.preview.conflicts
        : [];
      const result = await browser.runtime.sendMessage({
        type: 'IMPORT_PORTABLE_DATA',
        payload: previewResult.payload,
        overwriteSiteIds,
      } satisfies RuntimeMessage) as PortableImportResultMessage;
      window.alert(t(state.settings.language, 'manager.importComplete', {
        imported: result.importedCount,
        skipped: result.skipped.length,
      }));
      await load(state.selected?.site.siteId, state.page, state.detailTab);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t(state.settings.language, 'manager.importFailed'));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (state.status === 'loading') {
    return (
      <main className="page">
        <p className="eyebrow">{t('en', 'common.brand')}</p>
        <h1>{t('en', 'manager.loading')}</h1>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="page">
        <p className="eyebrow">{t('en', 'common.brand')}</p>
        <h1>{t('en', 'manager.title')}</h1>
        <p className="error">{state.message}</p>
      </main>
    );
  }

  const language = state.settings.language;
  const progressByUrl = new Map(state.selected?.progress.map((item) => [item.url, item]) ?? []);
  const totalPages = state.overviews.reduce((sum, item) => sum + item.pageCount, 0);
  const totalProgressRows = state.selected?.progress.length ?? 0;
  const selectedOverview = state.selected
    ? state.overviews.find((overview) => overview.site.siteId === state.selected?.site.siteId)
    : undefined;
  const pageTitle = state.page === 'settings'
    ? t(language, 'manager.settings')
    : state.page === 'sites'
      ? t(language, 'manager.sites')
      : state.selected?.site.scopeTitle ?? t(language, 'manager.indexes');

  return (
    <main className="page app-shell">
      <aside className="module-nav">
        <div className="brand">
          <span>{t(language, 'common.brand')}</span>
          <strong>{t(language, 'manager.title')}</strong>
        </div>
        <button className={state.page === 'settings' ? 'module active' : 'module'} type="button" onClick={() => selectPage('settings')}>
          <span>{t(language, 'manager.settings')}</span>
          <small>{t(language, 'manager.pluginPreferences')}</small>
        </button>
        <button className={state.page !== 'settings' ? 'module active' : 'module'} type="button" onClick={() => selectPage('sites')}>
          <span>{t(language, 'manager.tables')}</span>
          <small>{t(language, 'manager.indexesAndRecords')}</small>
        </button>
      </aside>

      <section className="workspace">
        <header className="masthead">
          <div>
            <p className="page-title">{pageTitle}</p>
          </div>
          <button className="ghost" type="button" onClick={() => void load(state.selected?.site.siteId, state.page, state.detailTab)}>{t(language, 'common.refresh')}</button>
        </header>

        {state.page === 'settings' ? (
          <section className="panel settings-panel">
            <label className="switch-row">
              <span>
                <strong>{t(language, 'manager.showReadingMap')}</strong>
                <small>{t(language, 'manager.currentStatus', { status: boolLabel(language, state.settings.showReadingMap) })}</small>
              </span>
              <input
                checked={state.settings.showReadingMap}
                type="checkbox"
                onChange={(event) => void saveSettings({ showReadingMap: event.currentTarget.checked })}
              />
              <i aria-hidden="true" />
            </label>
            <label className="switch-row">
              <span>
                <strong>{t(language, 'manager.debugIndexingLogs')}</strong>
                <small>{t(language, 'manager.currentStatus', { status: boolLabel(language, state.settings.debugIndexingLogs) })}</small>
              </span>
              <input
                checked={state.settings.debugIndexingLogs}
                type="checkbox"
                onChange={(event) => void saveSettings({ debugIndexingLogs: event.currentTarget.checked })}
              />
              <i aria-hidden="true" />
            </label>
            <label className="select-row">
              <span>
                <strong>{t(language, 'manager.language')}</strong>
                <small>{t(language, 'manager.languageDescription')}</small>
              </span>
              <select
                value={state.settings.language}
                onChange={(event) => void saveSettings({ language: event.currentTarget.value as LanguageCode })}
              >
                {SUPPORTED_LANGUAGES.map((code) => (
                  <option key={code} value={code}>{LANGUAGE_NAMES[code]}</option>
                ))}
              </select>
            </label>
          </section>
        ) : state.page === 'sites' ? (
          <section className="tables-layout">
            <section className="detail">
              <section className="portable-section">
                <div>
                  <p className="section-kicker">{t(language, 'manager.backupAndImport')}</p>
                  <h2>{t(language, 'manager.portableData')}</h2>
                  <p className="muted">{t(language, 'manager.portableDataDescription')}</p>
                </div>
                <label className="portable-check">
                  <input
                    checked={includePortableProgress}
                    type="checkbox"
                    onChange={(event) => setIncludePortableProgress(event.currentTarget.checked)}
                  />
                  <span>{t(language, 'manager.includeReadingProgress')}</span>
                </label>
                <div className="portable-actions">
                  <button className="ghost" type="button" onClick={() => void downloadPortableData('all')}>{t(language, 'manager.exportAll')}</button>
                  <button className="ghost" type="button" onClick={() => fileInputRef.current?.click()}>{t(language, 'manager.importFile')}</button>
                  <input
                    ref={fileInputRef}
                    accept=".json,.gz,.lfd.json,.lfd.json.gz,application/json,application/gzip"
                    hidden
                    type="file"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file) void importPortableFile(file);
                    }}
                  />
                </div>
              </section>
              <section className="site-list-section">
                <div className="detail-toolbar">
                  <div>
                    <h2>{t(language, 'manager.sites')}</h2>
                    <p className="muted">{state.overviews.length === 0 ? t(language, 'manager.noIndexes') : t(language, 'manager.indexesAndRecords')}</p>
                  </div>
                </div>
                <div className="site-list">
                  {state.overviews.length === 0 ? (
                    <div className="empty">{t(language, 'manager.noIndexes')}</div>
                  ) : state.overviews.map((overview) => (
                    <div className="site-list-row" key={overview.site.siteId}>
                      <button className="site-list-main" type="button" onClick={() => void selectSite(overview.site.siteId)}>
                        <span>
                          <strong>{overview.site.scopeTitle}</strong>
                          <small>{overview.site.host} · {t(language, 'common.updated', { date: fmtDate(overview.updatedAt) })}</small>
                        </span>
                        <span className="site-list-metrics">
                          <small>{t(language, 'manager.pages')}: {overview.pageCount}</small>
                          <small>{t(language, 'manager.progress')}: {fmtPercent(overview.totalPercent)}</small>
                        </span>
                      </button>
                      <button className="ghost" type="button" onClick={() => void downloadPortableData('site', overview.site.siteId)}>
                        {t(language, 'manager.exportSelectedSite')}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </section>
          </section>
        ) : (
          <section className="tables-layout">
            <section className="detail">
              <section className="detail-hero">
                <div>
                  <p className="section-kicker">{t(language, 'manager.indexes')}</p>
                  <h2>{state.selected?.site.scopeTitle ?? t(language, 'manager.indexes')}</h2>
                  <p className="muted">
                    {state.selected
                      ? `${state.selected.site.host} · ${t(language, 'common.updated', { date: fmtDate(state.selected.site.updatedAt) })}`
                      : t(language, 'manager.selectIndex')}
                  </p>
                </div>
                {state.selected && (
                  <div className="hero-progress">
                    <span>{t(language, 'popup.totalProgress')}</span>
                    <strong>{fmtPercent(selectedOverview?.totalPercent ?? 0)}</strong>
                    <div className="hero-meter" aria-hidden="true">
                      <i style={{ width: `${Math.min(100, Math.max(0, selectedOverview?.totalPercent ?? 0))}%` }} />
                    </div>
                  </div>
                )}
              </section>

              <div className="detail-nav">
                <button className="ghost" type="button" onClick={() => selectPage('sites')}>{t(language, 'manager.sites')}</button>
                <div className="tabs" aria-label={t(language, 'manager.tableViews')}>
                  {DETAIL_TABS.map((view) => (
                  <button className={state.detailTab === view ? 'tab active' : 'tab'} key={view} type="button" onClick={() => selectDetailTab(view)}>
                    {detailTabLabel(language, view)}
                  </button>
                  ))}
                </div>
              </div>

              {state.detailTab === 'overview' && (
                <OverviewTable
                  clearAllProgress={() => void clearAllProgress()}
                  clearSelectedProgress={() => void clearSelectedProgress()}
                  deleteSelected={() => void deleteSelected()}
                  fmtDate={fmtDate}
                  fmtHeight={fmtHeight}
                  fmtPercent={fmtPercent}
                  language={language}
                  selected={state.selected}
                  siteSettings={state.siteSettings}
                  saveSiteSettings={(settings) => void saveSiteSettings(settings)}
                  totalPercent={selectedOverview?.totalPercent ?? 0}
                  totalPages={totalPages}
                  totalProgressRows={totalProgressRows}
                />
              )}

              {state.detailTab === 'pages' && (
                <div className="table">
                  <div className="row pages-header">
                    <span>{t(language, 'manager.page')}</span>
                    <span>{t(language, 'manager.height')}</span>
                    <span>{t(language, 'manager.progress')}</span>
                  </div>
                  {state.selected?.pages.map((page) => {
                    const progress = progressByUrl.get(page.url);
                    return (
                      <a className="row" href={page.url} key={page.url} rel="noreferrer" target="_blank">
                        <span>{page.title}</span>
                        <span>{fmtHeight(page.contentHeight)}</span>
                        <span>{fmtPercent(pageProgressPercent(page, progress))}</span>
                      </a>
                    );
                  }) ?? <div className="empty">{t(language, 'manager.selectIndexPages')}</div>}
                </div>
              )}

              {state.detailTab === 'progress' && (
                <div className="table">
                  <div className="row progress-header">
                    <span>{t(language, 'manager.url')}</span>
                    <span>{t(language, 'manager.viewed')}</span>
                    <span>{t(language, 'manager.ranges')}</span>
                    <span>{t(language, 'common.updatedLabel')}</span>
                  </div>
                  {state.selected?.progress.map((progress) => (
                    <a className="row progress-row" href={progress.url} key={progress.url} rel="noreferrer" target="_blank">
                      <span>{progress.url}</span>
                      <span>{fmtHeight(progress.viewedHeight)}</span>
                      <span>{progress.viewedRanges.length}</span>
                      <span>{fmtDate(progress.updatedAt)}</span>
                    </a>
                  )) ?? <div className="empty">{t(language, 'manager.selectIndexProgress')}</div>}
                </div>
              )}

            </section>
          </section>
        )}
      </section>
    </main>
  );
}

type OverviewProps = {
  selected?: SiteSnapshot;
  siteSettings?: SiteSettings;
  language: LanguageCode;
  totalPages: number;
  totalProgressRows: number;
  totalPercent: number;
  fmtDate(value: number): string;
  fmtHeight(value: number): string;
  fmtPercent(value: number): string;
  deleteSelected(): void;
  clearSelectedProgress(): void;
  clearAllProgress(): void;
  saveSiteSettings(settings: Partial<SiteSettings>): void;
};

function OverviewTable(props: OverviewProps) {
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

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
