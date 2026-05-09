import React from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import type { IndexOverview, PageContextResponse, RuntimeMessage, StartIndexResult } from '../../src/shared/messages';
import { siteIdFor } from '../../src/shared/url';
import './style.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; context: PageContextResponse }
  | { status: 'error'; message: string };

type IndexRunProgress = Extract<RuntimeMessage, { type: 'INDEX_RUN_PROGRESS' }>['payload'];

function fmt(value: number | undefined): string {
  return `${Math.round(value ?? 0)}%`;
}

function fmtHeight(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k px`;
  return `${Math.round(value)} px`;
}

function isSupportedTabUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'react.dev'
      && (parsed.pathname === '/learn'
        || parsed.pathname.startsWith('/learn/')
        || parsed.pathname === '/reference/react'
        || parsed.pathname.startsWith('/reference/react/'));
  } catch {
    return false;
  }
}

function ProgressRing({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="ring" style={{ '--progress': `${clamped * 3.6}deg` } as React.CSSProperties}>
      <span>{fmt(clamped)}</span>
    </div>
  );
}

function App() {
  const [state, setState] = React.useState<LoadState>({ status: 'loading' });
  const [indexing, setIndexing] = React.useState(false);
  const [indexProgress, setIndexProgress] = React.useState<IndexRunProgress | null>(null);
  const [overview, setOverview] = React.useState<IndexOverview | null>(null);

  const load = React.useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab.id == null) throw new Error('No active tab found.');
      if (!isSupportedTabUrl(tab.url)) {
        setState({ status: 'ready', context: { supported: false, indexed: false } });
        return;
      }
      const context = await browser.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' } satisfies RuntimeMessage) as PageContextResponse;
      if (context.host && context.scopeKey) {
        const overviews = await browser.runtime.sendMessage({ type: 'GET_INDEX_OVERVIEWS' } satisfies RuntimeMessage) as IndexOverview[];
        const currentSiteId = siteIdFor(context.host, context.scopeKey);
        setOverview(overviews.find((item) => item.site.siteId === currentSiteId) ?? null);
      } else {
        setOverview(null);
      }
      setState({ status: 'ready', context });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Could not read the current page.',
      });
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const listener = (message: RuntimeMessage) => {
      if (message.type !== 'INDEX_RUN_PROGRESS') return undefined;
      setIndexProgress(message.payload);
      return undefined;
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  const startIndex = async (debug = false) => {
    setIndexing(true);
    setIndexProgress({
      phase: 'collecting',
      current: 0,
      total: 0,
      debug,
    });
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab.id == null) throw new Error('No active tab found.');
      const result = await browser.runtime.sendMessage({ type: 'START_INDEX', tabId: tab.id, debug } satisfies RuntimeMessage) as StartIndexResult;
      if (!result.ok) throw new Error(result.error);
      await load();
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Indexing failed.',
      });
    } finally {
      setIndexing(false);
    }
  };

  const openManager = async () => {
    const siteId = overview?.site.siteId;
    const url = `${browser.runtime.getURL('/options.html')}${siteId ? `?siteId=${encodeURIComponent(siteId)}` : ''}`;
    await browser.tabs.create({ url });
  };

  if (state.status === 'loading') {
    return (
      <main className="shell">
        <div className="topline" />
        <p className="eyebrow">Learn From Doc</p>
        <h1>Reading map is loading</h1>
        <div className="skeleton" />
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="shell">
        <div className="topline" />
        <p className="eyebrow">Learn From Doc</p>
        <h1>Open React Docs</h1>
        <p className="muted">{state.message}</p>
      </main>
    );
  }

  const { context } = state;
  const actionLabel = context.indexed ? 'Rebuild index' : 'Create index';

  return (
    <main className="shell">
      <div className="topline" />
      <header className="header">
        <div>
          <p className="eyebrow">Learn From Doc</p>
          <h1>{context.supported ? context.scopeTitle : 'Unsupported page'}</h1>
        </div>
        {context.indexed ? <span className="status">Indexed</span> : <span className="status muted-status">New</span>}
      </header>

      {!context.supported ? (
        <section className="empty">
          <p>This extension currently supports React Docs pages under react.dev/learn and react.dev/reference/react.</p>
        </section>
      ) : (
        <>
          <section className="hero">
            <ProgressRing value={context.totalPercent ?? 0} />
            <div className="hero-copy">
              <span>Total progress</span>
              <strong>{fmt(context.totalPercent)}</strong>
              <p>{context.indexed ? `${context.pageCount ?? 0} pages indexed locally` : 'Create a local index before tracking progress.'}</p>
            </div>
          </section>

          <section className="meters">
            <div>
              <span>Current page</span>
              <strong>{fmt(context.pagePercent)}</strong>
            </div>
            <div className="bar">
              <i style={{ width: `${context.pagePercent ?? 0}%` }} />
            </div>
          </section>

          {context.indexed ? (
            <section className="debug-panel">
              <div>
                <span>Page indexed</span>
                <strong>{context.currentPageIndexed ? 'yes' : 'no'}</strong>
              </div>
              <div>
                <span>Viewed height</span>
                <strong>{fmtHeight(context.currentViewedHeight ?? 0)}</strong>
              </div>
              <div>
                <span>Page height</span>
                <strong>{fmtHeight(context.currentPageContentHeight ?? 0)}</strong>
              </div>
              <p>{context.currentUrl}</p>
            </section>
          ) : null}

          {overview ? (
            <button className="index-card" type="button" onClick={() => void openManager()}>
              <div className="index-card-head">
                <span>Index overview</span>
                <strong>{overview.pageCount} pages</strong>
              </div>
              <div className="index-card-grid">
                <div>
                  <span>Total height</span>
                  <strong>{fmtHeight(overview.totalContentHeight)}</strong>
                </div>
                <div>
                  <span>Read height</span>
                  <strong>{fmtHeight(overview.totalViewedHeight)}</strong>
                </div>
              </div>
              <p>Open index manager</p>
            </button>
          ) : null}

          {indexing && indexProgress ? (
            <section className="index-progress">
              <div className="index-progress-row">
                <span>{indexProgress.phase === 'collecting' ? 'Collecting links' : 'Creating index'}</span>
                <strong>{indexProgress.total > 0 ? `${indexProgress.current}/${indexProgress.total}` : '...'}</strong>
              </div>
              <div className="bar">
                <i style={{ width: `${indexProgress.total > 0 ? (indexProgress.current / indexProgress.total) * 100 : 8}%` }} />
              </div>
              <p>{indexProgress.currentTitle ?? (indexProgress.phase === 'saving' ? 'Saving index locally' : 'Scanning sidebar')}</p>
            </section>
          ) : null}

          <button className="primary" type="button" onClick={() => void startIndex(false)} disabled={indexing}>
            {indexing ? 'Indexing pages...' : actionLabel}
          </button>
          <button className="secondary" type="button" onClick={() => void startIndex(true)} disabled={indexing}>
            Debug index one page
          </button>
        </>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
