import { browser } from 'wxt/browser';
import { maybeInjectIndexedTab } from './tabs';
import { getAllSites } from '../../storage/db';
import { injectContentScript } from '../../shared/content-script-injection';

vi.mock('wxt/browser', () => ({
  browser: {
    permissions: {
      contains: vi.fn(async () => true),
    },
    tabs: {
      sendMessage: vi.fn(),
      query: vi.fn(async () => []),
    },
  },
}));

vi.mock('../../shared/content-script-injection', () => ({
  injectContentScript: vi.fn(async () => undefined),
}));

vi.mock('../../storage/db', () => ({
  getAllSites: vi.fn(async () => [{
    siteId: 'pydantic.dev::docs',
    host: 'pydantic.dev',
    scopeKey: 'docs',
    scopeTitle: 'Starlight Docs',
    createdAt: 1,
    updatedAt: 1,
  }]),
}));

describe('background tab content script injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(browser.permissions.contains).mockResolvedValue(true);
  });

  it('injects an indexed tab when the matching origin permission is granted', async () => {
    const url = 'https://pydantic.dev/docs/validation/latest/examples/files/';

    await maybeInjectIndexedTab(7, url, 'background:onUpdated');

    expect(browser.permissions.contains).toHaveBeenCalledWith({ origins: ['https://pydantic.dev/*'] });
    expect(injectContentScript).toHaveBeenCalledWith(7, 'background:onUpdated');
  });

  it('does not inject when the tab id is missing', async () => {
    await maybeInjectIndexedTab(undefined, 'https://pydantic.dev/docs/validation/latest/examples/files/');

    expect(injectContentScript).not.toHaveBeenCalled();
  });

  it('does not inject when the url is missing', async () => {
    await maybeInjectIndexedTab(7, undefined);

    expect(injectContentScript).not.toHaveBeenCalled();
  });

  it('does not inject when the url is outside indexed scopes', async () => {
    await maybeInjectIndexedTab(7, 'https://example.com/docs/');

    expect(injectContentScript).not.toHaveBeenCalled();
  });

  it('does not inject without the matching origin permission', async () => {
    vi.mocked(browser.permissions.contains).mockResolvedValue(false);

    await maybeInjectIndexedTab(7, 'https://pydantic.dev/docs/validation/latest/examples/files/');

    expect(injectContentScript).not.toHaveBeenCalled();
  });

  it('uses the latest indexed site list when checking the url', async () => {
    await maybeInjectIndexedTab(7, 'https://pydantic.dev/docs/validation/latest/examples/files/');

    expect(getAllSites).toHaveBeenCalledTimes(1);
  });
});
