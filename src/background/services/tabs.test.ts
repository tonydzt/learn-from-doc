import { browser } from 'wxt/browser';
import { maybeInjectIndexedTab } from './tabs';
import { getAllSites } from '../../storage/db';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      getManifest: vi.fn(() => ({
        content_scripts: [{ js: ['content-scripts/content.js'] }],
      })),
    },
    permissions: {
      contains: vi.fn(async () => true),
    },
    scripting: {
      executeScript: vi.fn(async () => undefined),
    },
  },
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

function contentScriptInjectionCount(): number {
  return vi.mocked(browser.scripting.executeScript).mock.calls
    .filter(([details]) => details.files?.includes('content-scripts/content.js'))
    .length;
}

describe('background tab content script injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(browser.permissions.contains).mockResolvedValue(true);
  });

  it('injects an indexed tab only once for repeated updates on the same normalized URL', async () => {
    const url = 'https://pydantic.dev/docs/validation/latest/examples/files/';

    await maybeInjectIndexedTab(7, url, 'background:onUpdated');
    await maybeInjectIndexedTab(7, url, 'background:onUpdated');

    expect(contentScriptInjectionCount()).toBe(1);
  });

  it('treats hash-only changes as the same already injected document', async () => {
    const tabId = 8;
    const url = 'https://pydantic.dev/docs/validation/latest/examples/files/';

    await maybeInjectIndexedTab(tabId, url, 'background:onUpdated');
    await maybeInjectIndexedTab(tabId, `${url}#section`, 'background:onUpdated');

    expect(contentScriptInjectionCount()).toBe(1);
  });

  it('can inject the same tab again after it navigates to a different indexed page', async () => {
    const tabId = 9;

    await maybeInjectIndexedTab(tabId, 'https://pydantic.dev/docs/validation/latest/examples/files/', 'background:onUpdated');
    await maybeInjectIndexedTab(tabId, 'https://pydantic.dev/docs/validation/latest/examples/custom/', 'background:onUpdated');

    expect(contentScriptInjectionCount()).toBe(2);
  });

  it('coalesces concurrent auto-injection checks for the same tab and URL', async () => {
    const tabId = 10;
    const url = 'https://pydantic.dev/docs/validation/latest/examples/files/';

    await Promise.all([
      maybeInjectIndexedTab(tabId, url, 'background:onUpdated'),
      maybeInjectIndexedTab(tabId, url, 'background:onActivated'),
    ]);

    expect(contentScriptInjectionCount()).toBe(1);
  });
});
