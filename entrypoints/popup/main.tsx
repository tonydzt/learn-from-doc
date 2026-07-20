import React from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { t } from '../../src/i18n/messages';
import { totalProgressPercent } from '../../src/progress/calculations';
import { detectionResultState, initialDetectionState } from '../../src/popup/detection';
import { cachedDetectedFrameworkContextForUrl, saveDetectedFrameworkContext } from '../../src/popup/framework-detection-cache';
import { probePageAdapterContext } from '../../src/popup/framework-probe';
import { prepareIndexStart } from '../../src/popup/index-start';
import { ServerIndexActions, serverAccountCapabilities } from '../../src/popup/server-index-actions';
import { DEFAULT_LANGUAGE, type AppSettings, type LanguageCode } from '../../src/settings/app-settings';
import {
  accountLoginStatus,
  type AccountLoginStatus,
  type AccountSession,
} from '../../src/settings/account-session';
import { injectContentScript } from '../../src/shared/content-script-injection';
import type { IndexCheckpointSummary, PageAdapterContext, RuntimeMessage, ServerIndexAvailabilityMessage, SiteSnapshot, StartIndexResult } from '../../src/shared/messages';
import { siteIdFor } from '../../src/shared/url';
import { getCachedServerIndexAvailability, saveCachedServerIndexAvailability } from '../../src/storage/browser-storage/server-index-availability';
import type { SiteRecord } from '../../src/storage/db';
import './style.css';

type PopupContext = {
  supported: boolean;
  indexed: boolean;
  host?: string;
  scopeKey?: string;
  scopeTitle?: string;
  adapterKind?: PageAdapterContext['adapterKind'];
  frameworkName?: string;
  canDetect?: boolean;
  detectionFailed?: boolean;
  totalPercent?: number;
  pageCount?: number;
  indexCheckpoint?: IndexCheckpointSummary | null;
  serverIndex?: ServerIndexAvailabilityMessage;
  canPullServerIndex?: boolean;
  canPullReviewServerIndex?: boolean;
  canUploadServerIndex?: boolean;
  accountStatus?: AccountLoginStatus;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; context: PopupContext; settings: AppSettings }
  | { status: 'error'; message: string };

type IndexRunProgress = Extract<RuntimeMessage, { type: 'INDEX_RUN_PROGRESS' }>['payload'];

function fmt(value: number | undefined): string {
  return `${Math.round(value ?? 0)}%`;
}

async function contextFromExistingContentScript(tabId: number): Promise<PageAdapterContext | null> {
  try {
    const context = await browser.tabs.sendMessage(tabId, { type: 'GET_PAGE_ADAPTER_CONTEXT' } satisfies RuntimeMessage) as PageAdapterContext;
    if (context.supported) return context;
  } catch {
    return null;
  }
  return null;
}

async function probeContextFromTab(tabId: number): Promise<PageAdapterContext> {
  const [result] = await browser.scripting.executeScript({
    target: { tabId },
    func: probePageAdapterContext,
  });
  return result?.result ?? { supported: false };
}

async function injectContentScriptForDetectedPage(tabId: number, fallback: PageAdapterContext): Promise<PageAdapterContext> {
  await injectContentScript(tabId, 'popup:detect-framework');
  try {
    const context = await browser.tabs.sendMessage(tabId, { type: 'GET_PAGE_ADAPTER_CONTEXT' } satisfies RuntimeMessage) as PageAdapterContext;
    return context.supported ? context : fallback;
  } catch {
    return fallback;
  }
}

async function contextFromInjectedContentScript(tabId: number): Promise<PageAdapterContext | null> {
  try {
    await injectContentScript(tabId, 'popup:cached-framework-context');
    return contextFromExistingContentScript(tabId);
  } catch {
    return null;
  }
}

function contextFromIndexedSite(site: SiteRecord): Required<Pick<PageAdapterContext, 'host' | 'scopeKey' | 'scopeTitle'>> & PageAdapterContext {
  return {
    supported: true,
    host: site.host,
    scopeKey: site.scopeKey,
    scopeTitle: site.scopeTitle,
    adapterKind: 'framework',
    indexable: true,
  };
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

function labelForAccountStatus(status: AccountLoginStatus | undefined): string {
  if (status === 'logged-in') return 'Logged in';
  if (status === 'expired') return 'Expired';
  return 'Log in';
}

function App() {
  const [state, setState] = React.useState<LoadState>({ status: 'loading' });
  const [indexing, setIndexing] = React.useState(false);
  const [detecting, setDetecting] = React.useState(false);
  const [indexProgress, setIndexProgress] = React.useState<IndexRunProgress | null>(null);
  const [serverBusy, setServerBusy] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const restoreIndexProgress = React.useCallback((progress: IndexRunProgress | null) => {
    setIndexProgress(progress);
    setIndexing(Boolean(progress && progress.phase !== 'done'));
  }, []);

  const checkServerIndexAvailability = React.useCallback(async (siteId: string, canPullServerIndex: boolean | undefined) => {
    if (canPullServerIndex !== true) return;
    try {
      const serverIndex = await browser.runtime.sendMessage({
        type: 'GET_SERVER_INDEX_AVAILABILITY',
        siteId,
      } satisfies RuntimeMessage) as ServerIndexAvailabilityMessage;
      await saveCachedServerIndexAvailability(siteId, serverIndex);
      setState((current) => {
        if (current.status !== 'ready') return current;
        if (!current.context.host || !current.context.scopeKey) return current;
        if (siteIdFor(current.context.host, current.context.scopeKey) !== siteId) return current;
        if (current.context.indexed) return current;
        return {
          ...current,
          context: {
            ...current.context,
            serverIndex,
          },
        };
      });
    } catch {
    }
  }, []);

  const loadSupportedContext = React.useCallback(async (
    pageContext: Required<Pick<PageAdapterContext, 'host' | 'scopeKey' | 'scopeTitle'>> & PageAdapterContext,
    indexRunProgressPromise: Promise<IndexRunProgress | null>,
    settingsPromise: Promise<AppSettings>,
  ) => {
    const siteId = siteIdFor(pageContext.host, pageContext.scopeKey);
    const [snapshot, indexCheckpoint, indexRunProgress, settings, accountSession] = await Promise.all([
      browser.runtime.sendMessage({ type: 'GET_SITE_SNAPSHOT', siteId } satisfies RuntimeMessage) as Promise<SiteSnapshot | undefined>,
      browser.runtime.sendMessage({ type: 'GET_INDEX_CHECKPOINT', siteId } satisfies RuntimeMessage) as Promise<IndexCheckpointSummary | null>,
      indexRunProgressPromise,
      settingsPromise,
      browser.runtime.sendMessage({ type: 'GET_ACCOUNT_SESSION' } satisfies RuntimeMessage) as Promise<AccountSession | null>,
    ]);
    const {
      accountStatus,
      canPull: canPullServerIndex,
      canPullReview: canPullReviewServerIndex,
      canUpload: canUploadServerIndex,
    } = serverAccountCapabilities(accountSession);
    const cachedServerIndex = !snapshot && canPullServerIndex
      ? await getCachedServerIndexAvailability(siteId)
      : null;
    restoreIndexProgress(indexRunProgress);
    setServerError(null);
    setState({
      status: 'ready',
      settings,
      context: {
        supported: true,
        indexed: Boolean(snapshot),
        host: pageContext.host,
        scopeKey: pageContext.scopeKey,
        scopeTitle: pageContext.scopeTitle,
        adapterKind: pageContext.adapterKind,
        frameworkName: pageContext.frameworkName,
        totalPercent: snapshot ? totalProgressPercent(snapshot.pages, snapshot.progress) : 0,
        pageCount: snapshot?.pages.length ?? 0,
        indexCheckpoint,
        serverIndex: cachedServerIndex ?? undefined,
        canPullServerIndex,
        canPullReviewServerIndex,
        canUploadServerIndex,
        accountStatus,
      },
    });
    if (!snapshot && canPullServerIndex) {
      void checkServerIndexAvailability(siteId, canPullServerIndex);
    }
  }, [checkServerIndexAvailability, restoreIndexProgress]);

  const load = React.useCallback(async () => {
    // popup 每次打开都是一个短生命周期 React 页面。
    // 它先问 Chrome 当前激活 tab，再从 background 查询当前文档范围的索引快照。
    setState({ status: 'loading' });
    try {
      const indexRunProgressPromise = browser.runtime.sendMessage({ type: 'GET_INDEX_RUN_PROGRESS' } satisfies RuntimeMessage) as Promise<IndexRunProgress | null>;
      const settingsPromise = browser.runtime.sendMessage({ type: 'GET_APP_SETTINGS' } satisfies RuntimeMessage) as Promise<AppSettings>;
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab.id == null) throw new Error('No active tab found.');
      const initial = initialDetectionState(tab.url);
      if (initial.status === 'supported') {
        await loadSupportedContext(initial.context as Required<Pick<PageAdapterContext, 'host' | 'scopeKey' | 'scopeTitle'>> & PageAdapterContext, indexRunProgressPromise, settingsPromise);
        return;
      }

      const existingContext = initial.status === 'needs-manual-detect'
        ? await contextFromExistingContentScript(tab.id)
        : null;
      const existingState = existingContext ? detectionResultState(existingContext) : null;
      if (existingState?.status === 'supported' && existingState.context.host && existingState.context.scopeKey && existingState.context.scopeTitle) {
        await loadSupportedContext(existingState.context as Required<Pick<PageAdapterContext, 'host' | 'scopeKey' | 'scopeTitle'>> & PageAdapterContext, indexRunProgressPromise, settingsPromise);
        return;
      }

      if (initial.status === 'needs-manual-detect' && tab.url) {
        const indexedSite = await browser.runtime.sendMessage({ type: 'GET_INDEXED_SCOPE_FOR_URL', url: tab.url } satisfies RuntimeMessage) as SiteRecord | null;
        if (indexedSite) {
          await loadSupportedContext(contextFromIndexedSite(indexedSite), indexRunProgressPromise, settingsPromise);
          return;
        }
      }

      if (initial.status === 'needs-manual-detect' && tab.url) {
        const cachedContext = await cachedDetectedFrameworkContextForUrl(tab.url);
        if (cachedContext?.host && cachedContext.scopeKey && cachedContext.scopeTitle) {
          const pageContext = await contextFromInjectedContentScript(tab.id);
          const restoredContext = pageContext?.supported && pageContext.host && pageContext.scopeKey && pageContext.scopeTitle
            ? pageContext
            : cachedContext;
          await loadSupportedContext(restoredContext as Required<Pick<PageAdapterContext, 'host' | 'scopeKey' | 'scopeTitle'>> & PageAdapterContext, indexRunProgressPromise, settingsPromise);
          return;
        }
      }

      if (initial.status !== 'needs-manual-detect') {
        const [indexRunProgress, settings, accountSession] = await Promise.all([
          indexRunProgressPromise,
          settingsPromise,
          browser.runtime.sendMessage({ type: 'GET_ACCOUNT_SESSION' } satisfies RuntimeMessage) as Promise<AccountSession | null>,
        ]);
        restoreIndexProgress(indexRunProgress);
        setState({
          status: 'ready',
          context: { supported: false, indexed: false, accountStatus: accountLoginStatus(accountSession) },
          settings,
        });
        return;
      }

      const [indexRunProgress, settings, accountSession] = await Promise.all([
        indexRunProgressPromise,
        settingsPromise,
        browser.runtime.sendMessage({ type: 'GET_ACCOUNT_SESSION' } satisfies RuntimeMessage) as Promise<AccountSession | null>,
      ]);
      restoreIndexProgress(indexRunProgress);
      setState({
        status: 'ready',
        context: { supported: false, indexed: false, canDetect: true, accountStatus: accountLoginStatus(accountSession) },
        settings,
      });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Could not read the current page.',
      });
    }
  }, [loadSupportedContext, restoreIndexProgress]);

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
      const context = state.status === 'ready' ? state.context : undefined;
      const startMode = await prepareIndexStart({
        tabId: tab.id,
        url: tab.url,
        adapterKind: context?.supported ? context.adapterKind : undefined,
      });
      if (startMode === 'background-resumes') return;
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

  const detectFramework = async () => {
    setDetecting(true);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab.id == null) throw new Error('No active tab found.');
      const probedContext = await probeContextFromTab(tab.id);
      const detected = detectionResultState(probedContext);
      if (detected.status !== 'supported' || !detected.context.host || !detected.context.scopeKey || !detected.context.scopeTitle) {
        if (state.status === 'ready') {
          setState({
            status: 'ready',
            settings: state.settings,
            context: { supported: false, indexed: false, detectionFailed: true },
          });
        }
        return;
      }
      const pageContext = await injectContentScriptForDetectedPage(tab.id, detected.context);
      await saveDetectedFrameworkContext(pageContext);
      await loadSupportedContext(
        pageContext as Required<Pick<PageAdapterContext, 'host' | 'scopeKey' | 'scopeTitle'>> & PageAdapterContext,
        browser.runtime.sendMessage({ type: 'GET_INDEX_RUN_PROGRESS' } satisfies RuntimeMessage) as Promise<IndexRunProgress | null>,
        browser.runtime.sendMessage({ type: 'GET_APP_SETTINGS' } satisfies RuntimeMessage) as Promise<AppSettings>,
      );
    } catch (error) {
      if (state.status === 'ready') {
        setState({
          status: 'ready',
          settings: state.settings,
          context: { supported: false, indexed: false, detectionFailed: true },
        });
      } else {
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Detection failed.',
        });
      }
    } finally {
      setDetecting(false);
    }
  };

  const openManager = async () => {
    const context = state.status === 'ready' ? state.context : undefined;
    const siteId = context?.host && context.scopeKey ? siteIdFor(context.host, context.scopeKey) : undefined;
    const url = `${browser.runtime.getURL('/options.html')}${siteId ? `?siteId=${encodeURIComponent(siteId)}` : ''}`;
    await browser.tabs.create({ url });
  };

  const openAccountManager = async () => {
    await browser.tabs.create({ url: `${browser.runtime.getURL('/options.html')}?page=account` });
  };

  const pullServerIndex = async () => {
    if (state.status !== 'ready' || !state.context.host || !state.context.scopeKey) return;
    const siteId = siteIdFor(state.context.host, state.context.scopeKey);
    if (state.context.indexed && !window.confirm(t(state.settings.language, 'popup.confirmPullOverwrite'))) return;
    setServerBusy(true);
    setServerError(null);
    try {
      await browser.runtime.sendMessage({
        type: 'PULL_SERVER_INDEX',
        siteId,
        overwrite: state.context.indexed,
      } satisfies RuntimeMessage);
      await load();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Could not pull server index.');
    } finally {
      setServerBusy(false);
    }
  };

  const pullReviewServerIndex = async () => {
    if (state.status !== 'ready' || !state.context.host || !state.context.scopeKey) return;
    const siteId = siteIdFor(state.context.host, state.context.scopeKey);
    if (state.context.indexed && !window.confirm(t(state.settings.language, 'popup.confirmPullOverwrite'))) return;
    setServerBusy(true);
    setServerError(null);
    try {
      await browser.runtime.sendMessage({
        type: 'PULL_REVIEW_SERVER_INDEX',
        siteId,
        overwrite: state.context.indexed,
      } satisfies RuntimeMessage);
      await load();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Could not pull server index.');
    } finally {
      setServerBusy(false);
    }
  };

  const uploadServerIndex = async () => {
    if (state.status !== 'ready' || !state.context.host || !state.context.scopeKey) return;
    const siteId = siteIdFor(state.context.host, state.context.scopeKey);
    setServerBusy(true);
    setServerError(null);
    try {
      await browser.runtime.sendMessage({
        type: 'UPLOAD_SERVER_INDEX',
        siteId,
      } satisfies RuntimeMessage);
      await load();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Could not upload server index.');
    } finally {
      setServerBusy(false);
    }
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
  const hasResumeCheckpoint = Boolean(context.indexCheckpoint && context.indexCheckpoint.current < context.indexCheckpoint.total);
  const actionLabel = hasResumeCheckpoint ? t(language, 'popup.resumeIndex') : context.indexed ? t(language, 'popup.rebuildIndex') : t(language, 'popup.createIndex');

  return (
    <main className="shell">
      <div className="topline" />
      <header className="header">
        <div>
          <p className="eyebrow">{t(language, 'common.brand')}</p>
          <h1>{context.supported ? context.scopeTitle : t(language, 'popup.unsupportedPage')}</h1>
          {context.frameworkName ? <p className="framework-label">Detected: {context.frameworkName}</p> : null}
        </div>
        <div className="header-actions">
          {context.accountStatus === 'logged-in' ? (
            <span className="account-status-pill">{labelForAccountStatus(context.accountStatus)}</span>
          ) : (
            <button className="account-status-button" type="button" onClick={() => void openAccountManager()}>
              {labelForAccountStatus(context.accountStatus)}
            </button>
          )}
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
          <p>{context.detectionFailed ? t(language, 'popup.noFrameworkDetected') : t(language, 'popup.unsupportedDescription')}</p>
          {context.canDetect ? (
            <button className="secondary" type="button" onClick={() => void detectFramework()} disabled={detecting}>
              {detecting ? t(language, 'popup.detectingFramework') : t(language, 'popup.detectFramework')}
            </button>
          ) : null}
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
          ) : hasResumeCheckpoint && context.indexCheckpoint ? (
            <section className="index-progress">
              <div className="index-progress-row">
                <span>{t(language, 'popup.resumeIndex')}</span>
                <strong>{`${context.indexCheckpoint.current}/${context.indexCheckpoint.total}`}</strong>
              </div>
              <div className="bar">
                <i style={{ width: `${(context.indexCheckpoint.current / context.indexCheckpoint.total) * 100}%` }} />
              </div>
              <p>{t(language, 'popup.resumeIndexHint', { current: context.indexCheckpoint.current, total: context.indexCheckpoint.total })}</p>
            </section>
          ) : null}

          <ServerIndexActions
            canPull={context.canPullServerIndex === true}
            canPullReview={context.canPullReviewServerIndex === true}
            canUpload={context.canUploadServerIndex === true}
            indexed={context.indexed}
            language={language}
            serverBusy={serverBusy}
            serverError={serverError}
            serverIndex={context.serverIndex}
            onPull={() => void pullServerIndex()}
            onPullReview={() => void pullReviewServerIndex()}
            onUpload={() => void uploadServerIndex()}
          />

          <button className="primary" type="button" onClick={() => void startIndex()} disabled={indexing}>
            {indexing ? (hasResumeCheckpoint ? t(language, 'popup.resumeIndexingPages') : t(language, 'popup.indexingPages')) : actionLabel}
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
