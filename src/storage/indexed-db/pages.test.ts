import type { PageIndexRecord, SiteRecord } from './types';

const indexAll = vi.fn();
const requestToPromise = vi.fn();
const tx = vi.fn();

vi.mock('./connection', () => ({
  indexAll: (...args: unknown[]) => indexAll(...args),
  requestToPromise: (...args: unknown[]) => requestToPromise(...args),
  tx: (...args: unknown[]) => tx(...args),
}));

const site: SiteRecord = {
  siteId: 'docs.example.com::docs',
  host: 'docs.example.com',
  scopeKey: 'docs',
  scopeTitle: 'Example Docs',
  createdAt: 1,
  updatedAt: 2,
};

function page(url: string): PageIndexRecord {
  return {
    siteId: site.siteId,
    url,
    title: 'Page',
    order: 0,
    contentHeight: 100,
  };
}

describe('indexed db page storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes page urls before storing site pages', async () => {
    const sites = { put: vi.fn() };
    const pages = { delete: vi.fn(), put: vi.fn() };
    indexAll.mockResolvedValue([page('https://docs.example.com/old/')]);
    tx.mockImplementation(async (_stores, _mode, run) => run({ sites, pages }));
    const { replaceSitePages } = await import('./pages');

    await replaceSitePages(site, [page('https://docs.example.com/intro/')]);

    expect(pages.delete).toHaveBeenCalledWith([site.siteId, 'https://docs.example.com/old/']);
    expect(pages.put).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://docs.example.com/intro',
    }));
  });

  it('normalizes page urls before reading a single page', async () => {
    const pages = { get: vi.fn() };
    requestToPromise.mockResolvedValue(undefined);
    tx.mockImplementation(async (_stores, _mode, run) => run({ pages }));
    const { getPage } = await import('./pages');

    await getPage(site.siteId, 'https://docs.example.com/intro/');

    expect(pages.get).toHaveBeenCalledWith([site.siteId, 'https://docs.example.com/intro']);
  });
});
