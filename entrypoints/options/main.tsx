import React from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { pageProgressPercent } from '../../src/progress/calculations';
import type { IndexOverview, RuntimeMessage, SiteSnapshot } from '../../src/shared/messages';
import './style.css';

type ManagerState =
  | { status: 'loading' }
  | { status: 'ready'; overviews: IndexOverview[]; selected?: SiteSnapshot }
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

function App() {
  const [state, setState] = React.useState<ManagerState>({ status: 'loading' });
  const requestedSiteId = React.useMemo(() => new URLSearchParams(location.search).get('siteId') ?? undefined, []);

  const load = React.useCallback(async (siteId?: string) => {
    setState({ status: 'loading' });
    try {
      const overviews = await browser.runtime.sendMessage({ type: 'GET_INDEX_OVERVIEWS' } satisfies RuntimeMessage) as IndexOverview[];
      const selectedSiteId = siteId ?? requestedSiteId ?? overviews[0]?.site.siteId;
      const selected = selectedSiteId
        ? await browser.runtime.sendMessage({ type: 'GET_SITE_SNAPSHOT', siteId: selectedSiteId } satisfies RuntimeMessage) as SiteSnapshot | undefined
        : undefined;
      setState({ status: 'ready', overviews, selected });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Could not load index data.',
      });
    }
  }, [requestedSiteId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const deleteSelected = async () => {
    if (state.status !== 'ready' || !state.selected) return;
    const { siteId, scopeTitle } = state.selected.site;
    if (!window.confirm(`Delete index for ${scopeTitle}?`)) return;
    await browser.runtime.sendMessage({ type: 'DELETE_SITE_INDEX', siteId } satisfies RuntimeMessage);
    await load();
  };

  if (state.status === 'loading') {
    return (
      <main className="page">
        <p className="eyebrow">Learn From Doc</p>
        <h1>Loading indexes</h1>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="page">
        <p className="eyebrow">Learn From Doc</p>
        <h1>Index manager</h1>
        <p className="error">{state.message}</p>
      </main>
    );
  }

  const progressByUrl = new Map(state.selected?.progress.map((item) => [item.url, item]) ?? []);

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <p className="eyebrow">Learn From Doc</p>
          <h1>Index manager</h1>
        </div>
        <button className="ghost" type="button" onClick={() => void load(state.selected?.site.siteId)}>Refresh</button>
      </header>

      <section className="layout">
        <aside className="sidebar">
          <h2>Indexes</h2>
          {state.overviews.length === 0 ? (
            <p className="muted">No indexes yet.</p>
          ) : state.overviews.map((overview) => (
            <button
              className={overview.site.siteId === state.selected?.site.siteId ? 'site active' : 'site'}
              key={overview.site.siteId}
              type="button"
              onClick={() => void load(overview.site.siteId)}
            >
              <strong>{overview.site.scopeTitle}</strong>
              <span>{overview.pageCount} pages · {fmtPercent(overview.totalPercent)}</span>
            </button>
          ))}
        </aside>

        <section className="detail">
          {!state.selected ? (
            <div className="empty">Select an index to view details.</div>
          ) : (
            <>
              <div className="detail-head">
                <div>
                  <h2>{state.selected.site.scopeTitle}</h2>
                  <p>{state.selected.site.host} · Updated {fmtDate(state.selected.site.updatedAt)}</p>
                </div>
                <button className="danger" type="button" onClick={() => void deleteSelected()}>Delete index</button>
              </div>

              <div className="stats">
                <div><span>Pages</span><strong>{state.selected.pages.length}</strong></div>
                <div><span>Total height</span><strong>{fmtHeight(state.selected.pages.reduce((sum, page) => sum + page.contentHeight, 0))}</strong></div>
                <div><span>Tracked pages</span><strong>{state.selected.progress.length}</strong></div>
              </div>

              <div className="table">
                <div className="row header">
                  <span>Page</span>
                  <span>Height</span>
                  <span>Progress</span>
                </div>
                {state.selected.pages.map((page) => {
                  const progress = progressByUrl.get(page.url);
                  return (
                    <a className="row" href={page.url} key={page.url} rel="noreferrer" target="_blank">
                      <span>{page.title}</span>
                      <span>{fmtHeight(page.contentHeight)}</span>
                      <span>{fmtPercent(pageProgressPercent(page, progress))}</span>
                    </a>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
