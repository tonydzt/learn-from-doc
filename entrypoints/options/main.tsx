import React from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { LANGUAGE_NAMES, t, type MessageKey } from '../../src/i18n/messages';
import { pageProgressPercent } from '../../src/progress/calculations';
import { SUPPORTED_LANGUAGES, type AppSettings, type LanguageCode } from '../../src/settings/app-settings';
import type { IndexOverview, RuntimeMessage, SiteSnapshot } from '../../src/shared/messages';
import './style.css';

type ModuleKey = 'settings' | 'tables';
type TableView = 'overview' | 'sites' | 'pages' | 'progress' | 'settings';

type ManagerState =
  | { status: 'loading' }
  | {
    status: 'ready';
    module: ModuleKey;
    tableView: TableView;
    overviews: IndexOverview[];
    selected?: SiteSnapshot;
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

const TABLE_VIEWS: TableView[] = ['overview', 'sites', 'pages', 'progress', 'settings'];

function tableViewLabel(language: LanguageCode, view: TableView): string {
  const labels: Record<TableView, MessageKey> = {
    overview: 'manager.overview',
    sites: 'manager.sites',
    pages: 'manager.pages',
    progress: 'manager.progress',
    settings: 'manager.settings',
  };
  return t(language, labels[view]);
}

function App() {
  const requestedSiteId = React.useMemo(() => new URLSearchParams(location.search).get('siteId') ?? undefined, []);
  const initialModule = requestedSiteId ? 'tables' : 'settings';
  const [state, setState] = React.useState<ManagerState>({ status: 'loading' });

  const load = React.useCallback(async (
    siteId?: string,
    module: ModuleKey = initialModule,
    tableView: TableView = 'overview',
  ) => {
    // options 是扩展的管理后台页面。它不直接读数据库，而是通过 background 的 message API
    // 一次加载索引概览、设置，以及当前选中站点的完整快照。
    setState({ status: 'loading' });
    try {
      const [overviews, settings] = await Promise.all([
        browser.runtime.sendMessage({ type: 'GET_INDEX_OVERVIEWS' } satisfies RuntimeMessage) as Promise<IndexOverview[]>,
        browser.runtime.sendMessage({ type: 'GET_APP_SETTINGS' } satisfies RuntimeMessage) as Promise<AppSettings>,
      ]);
      const selectedSiteId = siteId ?? requestedSiteId ?? overviews[0]?.site.siteId;
      const selected = selectedSiteId
        ? await browser.runtime.sendMessage({ type: 'GET_SITE_SNAPSHOT', siteId: selectedSiteId } satisfies RuntimeMessage) as SiteSnapshot | undefined
        : undefined;
      setState({ status: 'ready', module, tableView, overviews, selected, settings });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Could not load manager data.',
      });
    }
  }, [initialModule, requestedSiteId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const selectModule = (module: ModuleKey) => {
    if (state.status !== 'ready') return;
    setState({ ...state, module });
  };

  const selectTableView = (tableView: TableView) => {
    if (state.status !== 'ready') return;
    setState({ ...state, tableView });
  };

  const saveSettings = async (settings: Partial<AppSettings>) => {
    if (state.status !== 'ready') return;
    const next = await browser.runtime.sendMessage({ type: 'SAVE_APP_SETTINGS', settings } satisfies RuntimeMessage) as AppSettings;
    setState({ ...state, settings: next });
  };

  const selectSite = async (siteId: string) => {
    if (state.status !== 'ready') return;
    await load(siteId, 'tables', state.tableView);
  };

  const deleteSelected = async () => {
    if (state.status !== 'ready' || !state.selected) return;
    const { siteId, scopeTitle } = state.selected.site;
    if (!window.confirm(t(state.settings.language, 'manager.confirmDeleteIndex', { title: scopeTitle }))) return;
    await browser.runtime.sendMessage({ type: 'DELETE_SITE_INDEX', siteId } satisfies RuntimeMessage);
    await load(undefined, 'tables', 'overview');
  };

  const clearSelectedProgress = async () => {
    if (state.status !== 'ready' || !state.selected) return;
    const { siteId, scopeTitle } = state.selected.site;
    if (!window.confirm(t(state.settings.language, 'manager.confirmClearSiteProgress', { title: scopeTitle }))) return;
    await browser.runtime.sendMessage({ type: 'CLEAR_SITE_PROGRESS', siteId } satisfies RuntimeMessage);
    await load(siteId, 'tables', state.tableView);
  };

  const clearAllProgress = async () => {
    if (state.status !== 'ready') return;
    if (!window.confirm(t(state.settings.language, 'manager.confirmClearAllProgress'))) return;
    await browser.runtime.sendMessage({ type: 'CLEAR_ALL_PROGRESS' } satisfies RuntimeMessage);
    await load(state.selected?.site.siteId, 'tables', state.tableView);
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

  return (
    <main className="page app-shell">
      <aside className="module-nav">
        <div className="brand">
          <span>{t(language, 'common.brand')}</span>
          <strong>{t(language, 'manager.title')}</strong>
        </div>
        <button className={state.module === 'settings' ? 'module active' : 'module'} type="button" onClick={() => selectModule('settings')}>
          <span>{t(language, 'manager.settings')}</span>
          <small>{t(language, 'manager.pluginPreferences')}</small>
        </button>
        <button className={state.module === 'tables' ? 'module active' : 'module'} type="button" onClick={() => selectModule('tables')}>
          <span>{t(language, 'manager.tables')}</span>
          <small>{t(language, 'manager.indexesAndRecords')}</small>
        </button>
        {state.module === 'tables' && (
          <div className="index-nav" aria-label={t(language, 'manager.indexes')}>
            <span className="subnav-title">{t(language, 'manager.indexes')}</span>
            {state.overviews.length === 0 ? (
              <span className="subnav-empty">{t(language, 'manager.noIndexes')}</span>
            ) : state.overviews.map((overview) => (
              <button
                className={overview.site.siteId === state.selected?.site.siteId ? 'index-nav-item active' : 'index-nav-item'}
                key={overview.site.siteId}
                type="button"
                onClick={() => void selectSite(overview.site.siteId)}
              >
                <strong>{overview.site.scopeTitle}</strong>
                <small>{t(language, 'manager.indexSummary', { count: overview.pageCount, percent: fmtPercent(overview.totalPercent) })}</small>
              </button>
            ))}
          </div>
        )}
      </aside>

      <section className="workspace">
        <header className="masthead">
          <div>
            <p className="page-title">{state.module === 'settings' ? t(language, 'manager.settings') : t(language, 'manager.tableManagement')}</p>
          </div>
          <button className="ghost" type="button" onClick={() => void load(state.selected?.site.siteId, state.module, state.tableView)}>{t(language, 'common.refresh')}</button>
        </header>

        {state.module === 'settings' ? (
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
        ) : (
          <section className="tables-layout">
            <section className="detail">
              <div className="detail-toolbar">
                <div>
                  <h2>{state.selected?.site.scopeTitle ?? t(language, 'manager.tables')}</h2>
                  <p className="muted">
                    {state.selected
                      ? `${state.selected.site.host} · ${t(language, 'common.updated', { date: fmtDate(state.selected.site.updatedAt) })}`
                      : t(language, 'manager.selectIndex')}
                  </p>
                </div>
                <div className="tabs" aria-label={t(language, 'manager.tableViews')}>
                  {TABLE_VIEWS.map((view) => (
                    <button className={state.tableView === view ? 'tab active' : 'tab'} key={view} type="button" onClick={() => selectTableView(view)}>
                      {tableViewLabel(language, view)}
                    </button>
                  ))}
                </div>
              </div>

              {state.tableView === 'overview' && (
                <OverviewTable
                  clearAllProgress={() => void clearAllProgress()}
                  clearSelectedProgress={() => void clearSelectedProgress()}
                  deleteSelected={() => void deleteSelected()}
                  fmtDate={fmtDate}
                  fmtHeight={fmtHeight}
                  fmtPercent={fmtPercent}
                  language={language}
                  selected={state.selected}
                  totalPages={totalPages}
                  totalProgressRows={totalProgressRows}
                />
              )}

              {state.tableView === 'sites' && (
                <div className="table">
                  <div className="row sites-header">
                    <span>siteId</span>
                    <span>{t(language, 'manager.scope')}</span>
                    <span>{t(language, 'common.updatedLabel')}</span>
                  </div>
                  {state.overviews.map((overview) => (
                    <button className="row table-button" key={overview.site.siteId} type="button" onClick={() => void selectSite(overview.site.siteId)}>
                      <span>{overview.site.siteId}</span>
                      <span>{overview.site.scopeTitle}</span>
                      <span>{fmtDate(overview.site.updatedAt)}</span>
                    </button>
                  ))}
                </div>
              )}

              {state.tableView === 'pages' && (
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

              {state.tableView === 'progress' && (
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

              {state.tableView === 'settings' && (
                <div className="table">
                  <div className="row settings-header">
                    <span>{t(language, 'manager.key')}</span>
                    <span>{t(language, 'manager.value')}</span>
                  </div>
                  <div className="row settings-row">
                    <span>showReadingMap</span>
                    <span>{String(state.settings.showReadingMap)}</span>
                  </div>
                  <div className="row settings-row">
                    <span>debugIndexingLogs</span>
                    <span>{String(state.settings.debugIndexingLogs)}</span>
                  </div>
                  <div className="row settings-row">
                    <span>language</span>
                    <span>{state.settings.language}</span>
                  </div>
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
  language: LanguageCode;
  totalPages: number;
  totalProgressRows: number;
  fmtDate(value: number): string;
  fmtHeight(value: number): string;
  fmtPercent(value: number): string;
  deleteSelected(): void;
  clearSelectedProgress(): void;
  clearAllProgress(): void;
};

function OverviewTable(props: OverviewProps) {
  if (!props.selected) {
    return <div className="empty">{t(props.language, 'manager.selectIndexDetails')}</div>;
  }

  const totalHeight = props.selected.pages.reduce((sum, page) => sum + page.contentHeight, 0);
  const totalViewed = props.selected.progress.reduce((sum, progress) => sum + progress.viewedHeight, 0);

  return (
    <>
      <div className="stats">
        <div><span>{t(props.language, 'manager.sites')}</span><strong>1</strong></div>
        <div><span>{t(props.language, 'manager.pages')}</span><strong>{props.selected.pages.length} / {props.totalPages}</strong></div>
        <div><span>{t(props.language, 'manager.progressRows')}</span><strong>{props.selected.progress.length} / {props.totalProgressRows}</strong></div>
        <div><span>{t(props.language, 'manager.totalHeight')}</span><strong>{props.fmtHeight(totalHeight)}</strong></div>
        <div><span>{t(props.language, 'manager.viewedHeight')}</span><strong>{props.fmtHeight(totalViewed)}</strong></div>
        <div><span>{t(props.language, 'manager.siteId')}</span><strong className="compact">{props.selected.site.siteId}</strong></div>
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
