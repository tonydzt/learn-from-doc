import React from 'react';
import { browser } from 'wxt/browser';
import { t } from '../../../src/i18n/messages';
import type { AppSettings } from '../../../src/settings/app-settings';
import type { AccountSession } from '../../../src/settings/account-session';
import type { SiteSettings } from '../../../src/settings/site-settings';
import type {
  IndexOverview,
  PortableExportResult,
  PortableImportPreviewResult,
  PortableImportResultMessage,
  RuntimeMessage,
  SiteSnapshot,
} from '../../../src/shared/messages';
import { uploadServerIndexes } from '../../../src/shared/server-index-upload';
import { parsePortableData, portableSerializedBlobPart } from '../../../src/storage/portable-data';
import { OptionsShell } from './components/OptionsShell';
import type { DetailTab, ManagerState, PageKey } from './types';
import { SettingsPage } from './pages/SettingsPage';
import { AccountPage } from './pages/AccountPage';
import { SiteDetailPage } from './pages/SiteDetailPage';
import { SitesPage } from './pages/SitesPage';

export function OptionsApp() {
  const searchParams = React.useMemo(() => new URLSearchParams(location.search), []);
  const requestedSiteId = searchParams.get('siteId') ?? undefined;
  const requestedPage = searchParams.get('page') === 'account' ? 'account' : undefined;
  const initialPage: PageKey = requestedPage ?? (requestedSiteId ? 'siteDetail' : 'sites');
  const [state, setState] = React.useState<ManagerState>({ status: 'loading' });
  const [includePortableProgress, setIncludePortableProgress] = React.useState(false);
  const [accountBusy, setAccountBusy] = React.useState(false);
  const [accountError, setAccountError] = React.useState<string | null>(null);
  const [uploadingHost, setUploadingHost] = React.useState<string | null>(null);
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
      const [overviews, settings, accountSession] = await Promise.all([
        browser.runtime.sendMessage({ type: 'GET_INDEX_OVERVIEWS' } satisfies RuntimeMessage) as Promise<IndexOverview[]>,
        browser.runtime.sendMessage({ type: 'GET_APP_SETTINGS' } satisfies RuntimeMessage) as Promise<AppSettings>,
        browser.runtime.sendMessage({ type: 'GET_ACCOUNT_SESSION' } satisfies RuntimeMessage) as Promise<AccountSession | null>,
      ]);
      const selectedSiteId = page === 'siteDetail' ? siteId ?? requestedSiteId ?? overviews[0]?.site.siteId : undefined;
      const selected = selectedSiteId
        ? await browser.runtime.sendMessage({ type: 'GET_SITE_SNAPSHOT', siteId: selectedSiteId } satisfies RuntimeMessage) as SiteSnapshot | undefined
        : undefined;
      const siteSettings = selected
        ? await browser.runtime.sendMessage({ type: 'GET_SITE_SETTINGS', siteId: selected.site.siteId } satisfies RuntimeMessage) as SiteSettings
        : undefined;
      setState({ status: 'ready', page, detailTab, overviews, selected, siteSettings, settings, accountSession });
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

  const loginAccount = async (email: string, password: string) => {
    if (state.status !== 'ready') return;
    setAccountBusy(true);
    setAccountError(null);
    try {
      const accountSession = await browser.runtime.sendMessage({
        type: 'LOGIN_ACCOUNT',
        email,
        password,
      } satisfies RuntimeMessage) as AccountSession;
      setState({ ...state, accountSession });
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Login failed.');
    } finally {
      setAccountBusy(false);
    }
  };

  const logoutAccount = async () => {
    if (state.status !== 'ready') return;
    setAccountBusy(true);
    setAccountError(null);
    try {
      await browser.runtime.sendMessage({ type: 'LOGOUT_ACCOUNT' } satisfies RuntimeMessage);
      setState({ ...state, accountSession: null });
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Logout failed.');
    } finally {
      setAccountBusy(false);
    }
  };

  const refreshAccountPermissions = async () => {
    if (state.status !== 'ready') return;
    setAccountBusy(true);
    setAccountError(null);
    try {
      const accountSession = await browser.runtime.sendMessage({ type: 'REFRESH_ACCOUNT_PERMISSIONS' } satisfies RuntimeMessage) as AccountSession | null;
      setState({ ...state, accountSession });
      if (!accountSession) setAccountError('Login expired. Please log in again.');
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Could not refresh permissions.');
    } finally {
      setAccountBusy(false);
    }
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

  const selectSite = async (siteId: string, detailTab: DetailTab = 'overview') => {
    if (state.status !== 'ready') return;
    window.history.replaceState(null, '', `${location.pathname}?siteId=${encodeURIComponent(siteId)}`);
    await load(siteId, 'siteDetail', detailTab);
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

  const deletePageProgress = async (url: string) => {
    if (state.status !== 'ready' || !state.selected) return;
    const { siteId } = state.selected.site;
    if (!window.confirm(t(state.settings.language, 'manager.confirmDeletePageProgress'))) return;
    await browser.runtime.sendMessage({ type: 'DELETE_PAGE_PROGRESS', siteId, url } satisfies RuntimeMessage);
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

  const uploadSiteIndexes = async (siteIds: string[]) => {
    if (state.status !== 'ready' || siteIds.length === 0 || uploadingHost !== null) return;
    const host = state.overviews.find((overview) => overview.site.siteId === siteIds[0])?.site.host;
    if (!host) return;
    setUploadingHost(host);
    try {
      await uploadServerIndexes(siteIds, (message) => browser.runtime.sendMessage(message));
      await load(state.selected?.site.siteId, state.page, state.detailTab);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not upload server index.');
    } finally {
      setUploadingHost(null);
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
  const pageTitle = state.page === 'settings'
    ? t(language, 'manager.settings')
    : state.page === 'account'
      ? t(language, 'manager.account')
    : state.page === 'sites'
      ? t(language, 'manager.sites')
      : state.selected?.site.host ?? t(language, 'manager.indexes');

  return (
    <OptionsShell
      language={language}
      page={state.page}
      pageTitle={pageTitle}
      refresh={() => void load(state.selected?.site.siteId, state.page, state.detailTab)}
      selectPage={selectPage}
    >
      {state.page === 'settings' ? (
        <SettingsPage settings={state.settings} saveSettings={(settings) => void saveSettings(settings)} />
      ) : state.page === 'account' ? (
        <AccountPage
          accountBusy={accountBusy}
          accountError={accountError}
          accountSession={state.accountSession}
          loginAccount={(email, password) => void loginAccount(email, password)}
          logoutAccount={() => void logoutAccount()}
          refreshAccountPermissions={() => void refreshAccountPermissions()}
        />
      ) : state.page === 'sites' ? (
        <SitesPage
          fileInputRef={fileInputRef}
          includePortableProgress={includePortableProgress}
          language={language}
          overviews={state.overviews}
          downloadPortableData={(scope, siteId) => void downloadPortableData(scope, siteId)}
          importPortableFile={(file) => void importPortableFile(file)}
          selectSite={(siteId) => void selectSite(siteId)}
          setIncludePortableProgress={setIncludePortableProgress}
          uploadSiteIndexes={(siteIds) => void uploadSiteIndexes(siteIds)}
          uploadingHost={uploadingHost}
        />
      ) : (
        <SiteDetailPage
          clearAllProgress={() => void clearAllProgress()}
          clearSelectedProgress={() => void clearSelectedProgress()}
          deletePageProgress={(url) => void deletePageProgress(url)}
          deleteSelected={() => void deleteSelected()}
          detailTab={state.detailTab}
          language={language}
          overviews={state.overviews}
          selected={state.selected}
          siteSettings={state.siteSettings}
          saveSiteSettings={(settings) => void saveSiteSettings(settings)}
          selectDetailTab={selectDetailTab}
          selectPage={selectPage}
          selectScope={(siteId) => void selectSite(siteId, state.detailTab)}
        />
      )}
    </OptionsShell>
  );
}
