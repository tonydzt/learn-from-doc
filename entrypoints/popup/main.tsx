import React from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { getScopeForUrl } from '../../src/adapters';
import { t } from '../../src/i18n/messages';
import { totalProgressPercent } from '../../src/progress/calculations';
import { DEFAULT_LANGUAGE, type AppSettings, type LanguageCode } from '../../src/settings/app-settings';
import type { RuntimeMessage, SiteSnapshot, StartIndexResult } from '../../src/shared/messages';
import { siteIdFor } from '../../src/shared/url';
import './style.css';

type PopupContext = {
  supported: boolean;
  indexed: boolean;
  host?: string;
  scopeKey?: string;
  scopeTitle?: string;
  totalPercent?: number;
  pageCount?: number;
};
type SupportedScope = Required<Pick<PopupContext, 'host' | 'scopeKey' | 'scopeTitle'>>;

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; context: PopupContext; settings: AppSettings }
  | { status: 'error'; message: string };

type IndexRunProgress = Extract<RuntimeMessage, { type: 'INDEX_RUN_PROGRESS' }>['payload'];

function fmt(value: number | undefined): string {
  return `${Math.round(value ?? 0)}%`;
}

function scopeFromTabUrl(url: string | undefined): SupportedScope | null {
  if (!url) return null;
  try {
    return getScopeForUrl(url);
  } catch {
    return null;
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

function messageForPhase(language: LanguageCode, phase: IndexRunProgress['phase']): string {
  if (phase === 'collecting') return t(language, 'popup.collectingLinks');
  if (phase === 'saving') return t(language, 'popup.savingIndex');
  return t(language, 'popup.creatingIndex');
}

function App() {
  const [state, setState] = React.useState<LoadState>({ status: 'loading' });
  const [indexing, setIndexing] = React.useState(false);
  const [indexProgress, setIndexProgress] = React.useState<IndexRunProgress | null>(null);

  const restoreIndexProgress = React.useCallback((progress: IndexRunProgress | null) => {
    setIndexProgress(progress);
    setIndexing(Boolean(progress && progress.phase !== 'done'));
  }, []);

  const load = React.useCallback(async () => {
    // popup 每次打开都是一个短生命周期 React 页面。
    // 它先问 Chrome 当前激活 tab，再从 background 查询当前文档范围的索引快照。
    setState({ status: 'loading' });
    try {
      const indexRunProgressPromise = browser.runtime.sendMessage({ type: 'GET_INDEX_RUN_PROGRESS' } satisfies RuntimeMessage) as Promise<IndexRunProgress | null>;
      const settingsPromise = browser.runtime.sendMessage({ type: 'GET_APP_SETTINGS' } satisfies RuntimeMessage) as Promise<AppSettings>;
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab.id == null) throw new Error('No active tab found.');
      const scope = scopeFromTabUrl(tab.url);
      if (!scope) {
        const [indexRunProgress, settings] = await Promise.all([indexRunProgressPromise, settingsPromise]);
        restoreIndexProgress(indexRunProgress);
        setState({ status: 'ready', context: { supported: false, indexed: false }, settings });
        return;
      }

      const siteId = siteIdFor(scope.host, scope.scopeKey);
      const [snapshot, indexRunProgress, settings] = await Promise.all([
        browser.runtime.sendMessage({ type: 'GET_SITE_SNAPSHOT', siteId } satisfies RuntimeMessage) as Promise<SiteSnapshot | undefined>,
        indexRunProgressPromise,
        settingsPromise,
      ]);
      restoreIndexProgress(indexRunProgress);
      setState({
        status: 'ready',
        settings,
        context: {
          supported: true,
          indexed: Boolean(snapshot),
          ...scope,
          totalPercent: snapshot ? totalProgressPercent(snapshot.pages, snapshot.progress) : 0,
          pageCount: snapshot?.pages.length ?? 0,
        },
      });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Could not read the current page.',
      });
    }
  }, [restoreIndexProgress]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    // 监听 background 广播的索引进度，用来在 popup 内显示“正在测第几页”。
    const listener = (message: RuntimeMessage) => {
      if (message.type !== 'INDEX_RUN_PROGRESS') return undefined;
      restoreIndexProgress(message.payload);
      if (message.payload.phase === 'done') void load();
      return undefined;
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, [load, restoreIndexProgress]);

  const startIndex = async () => {
    setIndexing(true);
    setIndexProgress({
      phase: 'collecting',
      current: 0,
      total: 0,
    });
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab.id == null) throw new Error('No active tab found.');
      const result = await browser.runtime.sendMessage({ type: 'START_INDEX', tabId: tab.id } satisfies RuntimeMessage) as StartIndexResult;
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
    const context = state.status === 'ready' ? state.context : undefined;
    const siteId = context?.host && context.scopeKey ? siteIdFor(context.host, context.scopeKey) : undefined;
    const url = `${browser.runtime.getURL('/options.html')}${siteId ? `?siteId=${encodeURIComponent(siteId)}` : ''}`;
    await browser.tabs.create({ url });
  };

  if (state.status === 'loading') {
    return (
      <main className="shell">
        <div className="topline" />
        <p className="eyebrow">{t(DEFAULT_LANGUAGE, 'common.brand')}</p>
        <h1>{t(DEFAULT_LANGUAGE, 'popup.loading')}</h1>
        <div className="skeleton" />
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="shell">
        <div className="topline" />
        <p className="eyebrow">{t(DEFAULT_LANGUAGE, 'common.brand')}</p>
        <h1>{t(DEFAULT_LANGUAGE, 'popup.openReactDocs')}</h1>
        <p className="muted">{state.message}</p>
      </main>
    );
  }

  const { context } = state;
  const language = state.settings.language;
  const actionLabel = context.indexed ? t(language, 'popup.rebuildIndex') : t(language, 'popup.createIndex');

  return (
    <main className="shell">
      <div className="topline" />
      <header className="header">
        <div>
          <p className="eyebrow">{t(language, 'common.brand')}</p>
          <h1>{context.supported ? context.scopeTitle : t(language, 'popup.unsupportedPage')}</h1>
        </div>
        <div className="header-actions">
          {context.indexed ? <span className="status">{t(language, 'popup.indexed')}</span> : <span className="status muted-status">{t(language, 'popup.new')}</span>}
          <button className="icon-button" type="button" title={t(language, 'popup.openManager')} aria-label={t(language, 'popup.openManager')} onClick={() => void openManager()}>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
              <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.04.04a2.1 2.1 0 0 1-2.97 2.97l-.04-.04a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.09 1.65V21.4a2.1 2.1 0 0 1-4.2 0v-.06a1.8 1.8 0 0 0-1.18-1.65 1.8 1.8 0 0 0-1.98.36l-.04.04a2.1 2.1 0 0 1-2.97-2.97l.04-.04A1.8 1.8 0 0 0 3.7 15a1.8 1.8 0 0 0-1.65-1.09H2a2.1 2.1 0 0 1 0-4.2h.06A1.8 1.8 0 0 0 3.7 8.62a1.8 1.8 0 0 0-.36-1.98l-.04-.04a2.1 2.1 0 0 1 2.97-2.97l.04.04a1.8 1.8 0 0 0 1.98.36A1.8 1.8 0 0 0 9.38 2.4V2.2a2.1 2.1 0 0 1 4.2 0v.06a1.8 1.8 0 0 0 1.09 1.65 1.8 1.8 0 0 0 1.98-.36l.04-.04a2.1 2.1 0 0 1 2.97 2.97l-.04.04a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.65 1.09H21a2.1 2.1 0 0 1 0 4.2h-.06A1.8 1.8 0 0 0 19.4 15Z" />
            </svg>
          </button>
        </div>
      </header>

      {!context.supported ? (
        <section className="empty">
          <p>{t(language, 'popup.unsupportedDescription')}</p>
        </section>
      ) : (
        <>
          <section className="hero">
            <ProgressRing value={context.totalPercent ?? 0} />
            <div className="hero-copy">
              <span>{t(language, 'popup.totalProgress')}</span>
              <strong>{fmt(context.totalPercent)}</strong>
              <p>{context.indexed ? t(language, 'popup.pagesIndexed', { count: context.pageCount ?? 0 }) : t(language, 'popup.createIndexFirst')}</p>
            </div>
          </section>

          {indexing && indexProgress ? (
            <section className="index-progress">
              <div className="index-progress-row">
                <span>{messageForPhase(language, indexProgress.phase)}</span>
                <strong>{indexProgress.total > 0 ? `${indexProgress.current}/${indexProgress.total}` : '...'}</strong>
              </div>
              <div className="bar">
                <i style={{ width: `${indexProgress.total > 0 ? (indexProgress.current / indexProgress.total) * 100 : 8}%` }} />
              </div>
              <p>{indexProgress.currentTitle ?? (indexProgress.phase === 'saving' ? t(language, 'popup.savingIndex') : t(language, 'popup.scanningSidebar'))}</p>
            </section>
          ) : null}

          <button className="primary" type="button" onClick={() => void startIndex()} disabled={indexing}>
            {indexing ? t(language, 'popup.indexingPages') : actionLabel}
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
