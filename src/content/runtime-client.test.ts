import { browser } from 'wxt/browser';
import {
  getAppSettingsFromBackground,
  getIndexedScopeForCurrentPage,
  getPageFromBackground,
  getPageSettingsFromBackground,
  getPagesFromBackground,
  getProgressForSiteFromBackground,
  getSiteSettingsFromBackground,
  hasOriginPermissionFromBackground,
  savePageSettingsToBackground,
  saveProgressToBackground,
} from './runtime-client';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn(),
    },
  },
}));

describe('content runtime client', () => {
  beforeEach(() => {
    vi.mocked(browser.runtime.sendMessage).mockReset();
  });

  it('sends typed read messages to background', async () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);

    await getPagesFromBackground('react.dev::learn');
    await getPageFromBackground('react.dev::learn', 'https://react.dev/learn');
    await getPageSettingsFromBackground('react.dev::learn', 'https://react.dev/learn');
    await getProgressForSiteFromBackground('react.dev::learn');
    await getSiteSettingsFromBackground('react.dev::learn');
    await getAppSettingsFromBackground();

    expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(1, { type: 'GET_SITE_PAGES', siteId: 'react.dev::learn' });
    expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(2, { type: 'GET_PAGE_RECORD', siteId: 'react.dev::learn', url: 'https://react.dev/learn' });
    expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(3, { type: 'GET_PAGE_SETTINGS', siteId: 'react.dev::learn', url: 'https://react.dev/learn' });
    expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(4, { type: 'GET_SITE_PROGRESS', siteId: 'react.dev::learn' });
    expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(5, { type: 'GET_SITE_SETTINGS', siteId: 'react.dev::learn' });
    expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(6, { type: 'GET_APP_SETTINGS' });
  });

  it('sends permission and current page scope messages', async () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);

    await hasOriginPermissionFromBackground();
    await getIndexedScopeForCurrentPage();

    expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(1, {
      type: 'HAS_ORIGIN_PERMISSION',
      origin: 'https://react.dev/*',
    });
    expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(2, {
      type: 'GET_INDEXED_SCOPE_FOR_URL',
      url: 'https://react.dev/learn',
    });
  });

  it('sends progress writes', async () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValue({ ok: true });

    await savePageSettingsToBackground('react.dev::learn', 'https://react.dev/learn', { readingProgressEnabled: false });
    await saveProgressToBackground('react.dev::learn', 'https://react.dev/learn', [{ start: 0, end: 100 }], 500);

    expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(1, {
      type: 'SAVE_PAGE_SETTINGS',
      siteId: 'react.dev::learn',
      url: 'https://react.dev/learn',
      settings: { readingProgressEnabled: false },
    });
    expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(2, {
      type: 'SAVE_PROGRESS_RECORD',
      siteId: 'react.dev::learn',
      url: 'https://react.dev/learn',
      ranges: [{ start: 0, end: 100 }],
      contentHeight: 500,
    });
  });
});
