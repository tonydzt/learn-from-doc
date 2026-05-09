import React from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { pageProgressPercent } from '../../src/progress/calculations';
import type { AppSettings } from '../../src/settings/app-settings';
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

function boolLabel(value: boolean): string {
  return value ? 'On' : 'Off';
}

const TABLE_VIEWS: TableView[] = ['overview', 'sites', 'pages', 'progress', 'settings'];

function tableViewLabel(view: TableView): string {
  const labels: Record<TableView, string> = {
    overview: 'Overview',
    sites: 'Sites',
    pages: 'Pages',
    progress: 'Progress',
    settings: 'Settings',
  };
  return labels[view];
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
    if (!window.confirm(`Delete index for ${scopeTitle}?`)) return;
    await browser.runtime.sendMessage({ type: 'DELETE_SITE_INDEX', siteId } satisfies RuntimeMessage);
    await load(undefined, 'tables', 'overview');
  };

  const clearSelectedProgress = async () => {
    if (state.status !== 'ready' || !state.selected) return;
    const { siteId, scopeTitle } = state.selected.site;
    if (!window.confirm(`Clear reading progress for ${scopeTitle}? The index will be kept.`)) return;
    await browser.runtime.sendMessage({ type: 'CLEAR_SITE_PROGRESS', siteId } satisfies RuntimeMessage);
    await load(siteId, 'tables', state.tableView);
  };

  const clearAllProgress = async () => {
    if (state.status !== 'ready') return;
    if (!window.confirm('Clear all reading progress? Indexes will be kept.')) return;
    await browser.runtime.sendMessage({ type: 'CLEAR_ALL_PROGRESS' } satisfies RuntimeMessage);
    await load(state.selected?.site.siteId, 'tables', state.tableView);
  };

  if (state.status === 'loading') {
    return (
      <main className="page">
        <p className="eyebrow">Learn From Doc</p>
        <h1>Loading manager</h1>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="page">
        <p className="eyebrow">Learn From Doc</p>
        <h1>Manager</h1>
        <p className="error">{state.message}</p>
      </main>
    );
  }

  const progressByUrl = new Map(state.selected?.progress.map((item) => [item.url, item]) ?? []);
  const totalPages = state.overviews.reduce((sum, item) => sum + item.pageCount, 0);
  const totalProgressRows = state.selected?.progress.length ?? 0;

  return (
    <main className="page app-shell">
      <aside className="module-nav">
        <div className="brand">
          <span>Learn From Doc</span>
          <strong>Manager</strong>
        </div>
        <button className={state.module === 'settings' ? 'module active' : 'module'} type="button" onClick={() => selectModule('settings')}>
          <span>Settings</span>
          <small>Plugin preferences</small>
        </button>
        <button className={state.module === 'tables' ? 'module active' : 'module'} type="button" onClick={() => selectModule('tables')}>
          <span>Tables</span>
          <small>Indexes and records</small>
        </button>
        {state.module === 'tables' && (
          <div className="index-nav" aria-label="Indexes">
            <span className="subnav-title">Indexes</span>
            {state.overviews.length === 0 ? (
              <span className="subnav-empty">No indexes yet.</span>
            ) : state.overviews.map((overview) => (
              <button
                className={overview.site.siteId === state.selected?.site.siteId ? 'index-nav-item active' : 'index-nav-item'}
                key={overview.site.siteId}
                type="button"
                onClick={() => void selectSite(overview.site.siteId)}
              >
                <strong>{overview.site.scopeTitle}</strong>
                <small>{overview.pageCount} pages · {fmtPercent(overview.totalPercent)}</small>
              </button>
            ))}
          </div>
        )}
      </aside>

      <section className="workspace">
        <header className="masthead">
          <div>
            <p className="eyebrow">{state.module === 'settings' ? 'Settings' : 'Table management'}</p>
            <h1>{state.module === 'settings' ? 'Plugin controls' : 'Data tables'}</h1>
          </div>
          <button className="ghost" type="button" onClick={() => void load(state.selected?.site.siteId, state.module, state.tableView)}>Refresh</button>
        </header>

        {state.module === 'settings' ? (
          <section className="panel settings-panel">
            <div>
              <p className="section-kicker">Reading UI</p>
              <h2>Right-side reading map</h2>
              <p className="muted">Show the slim page map on supported indexed documentation pages.</p>
            </div>
            <label className="switch-row">
              <span>
                <strong>显示右侧阅读地图</strong>
                <small>Current status: {boolLabel(state.settings.showReadingMap)}</small>
              </span>
              <input
                checked={state.settings.showReadingMap}
                type="checkbox"
                onChange={(event) => void saveSettings({ showReadingMap: event.currentTarget.checked })}
              />
              <i aria-hidden="true" />
            </label>
            <div className="settings-table">
              <div><span>showReadingMap</span><strong>{String(state.settings.showReadingMap)}</strong></div>
            </div>
          </section>
        ) : (
          <section className="tables-layout">
            <section className="detail">
              <div className="detail-toolbar">
                <div>
                  <h2>{state.selected?.site.scopeTitle ?? 'Tables'}</h2>
                  <p className="muted">
                    {state.selected
                      ? `${state.selected.site.host} · Updated ${fmtDate(state.selected.site.updatedAt)}`
                      : 'Select an index from the left menu.'}
                  </p>
                </div>
                <div className="tabs" aria-label="Table views">
                  {TABLE_VIEWS.map((view) => (
                    <button className={state.tableView === view ? 'tab active' : 'tab'} key={view} type="button" onClick={() => selectTableView(view)}>
                      {tableViewLabel(view)}
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
                  selected={state.selected}
                  totalPages={totalPages}
                  totalProgressRows={totalProgressRows}
                />
              )}

              {state.tableView === 'sites' && (
                <div className="table">
                  <div className="row sites-header">
                    <span>siteId</span>
                    <span>Scope</span>
                    <span>Updated</span>
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
                    <span>Page</span>
                    <span>Height</span>
                    <span>Progress</span>
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
                  }) ?? <div className="empty">Select an index to view pages.</div>}
                </div>
              )}

              {state.tableView === 'progress' && (
                <div className="table">
                  <div className="row progress-header">
                    <span>URL</span>
                    <span>Viewed</span>
                    <span>Ranges</span>
                    <span>Updated</span>
                  </div>
                  {state.selected?.progress.map((progress) => (
                    <a className="row progress-row" href={progress.url} key={progress.url} rel="noreferrer" target="_blank">
                      <span>{progress.url}</span>
                      <span>{fmtHeight(progress.viewedHeight)}</span>
                      <span>{progress.viewedRanges.length}</span>
                      <span>{fmtDate(progress.updatedAt)}</span>
                    </a>
                  )) ?? <div className="empty">Select an index to view progress.</div>}
                </div>
              )}

              {state.tableView === 'settings' && (
                <div className="table">
                  <div className="row settings-header">
                    <span>Key</span>
                    <span>Value</span>
                  </div>
                  <div className="row">
                    <span>showReadingMap</span>
                    <span>{String(state.settings.showReadingMap)}</span>
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
    return <div className="empty">Select an index to view details.</div>;
  }

  const totalHeight = props.selected.pages.reduce((sum, page) => sum + page.contentHeight, 0);
  const totalViewed = props.selected.progress.reduce((sum, progress) => sum + progress.viewedHeight, 0);

  return (
    <>
      <div className="stats">
        <div><span>Sites</span><strong>1</strong></div>
        <div><span>Pages</span><strong>{props.selected.pages.length} / {props.totalPages}</strong></div>
        <div><span>Progress rows</span><strong>{props.selected.progress.length} / {props.totalProgressRows}</strong></div>
        <div><span>Total height</span><strong>{props.fmtHeight(totalHeight)}</strong></div>
        <div><span>Viewed height</span><strong>{props.fmtHeight(totalViewed)}</strong></div>
        <div><span>Site ID</span><strong className="compact">{props.selected.site.siteId}</strong></div>
      </div>

      <div className="danger-zone">
        <div>
          <p className="section-kicker">Danger zone</p>
          <h2>Safe destructive actions</h2>
          <p className="muted">Progress cleanup keeps indexes. Deleting an index removes its site, pages, and progress rows.</p>
        </div>
        <div className="danger-actions">
          <button className="danger" type="button" onClick={props.clearSelectedProgress}>Clear site progress</button>
          <button className="danger" type="button" onClick={props.clearAllProgress}>Clear all progress</button>
          <button className="danger strong" type="button" onClick={props.deleteSelected}>Delete index</button>
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
