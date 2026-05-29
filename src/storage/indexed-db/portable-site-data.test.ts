import type { PortableSiteBundle } from '../portable-data';
import type { PageIndexRecord, ProgressRecord, SiteRecord, SiteSettingsRecord } from './types';

const getPages = vi.fn();
const getProgressForSite = vi.fn();
const tx = vi.fn();

vi.mock('./pages', () => ({
  getPages: (...args: unknown[]) => getPages(...args),
}));

vi.mock('./progress', () => ({
  getProgressForSite: (...args: unknown[]) => getProgressForSite(...args),
}));

vi.mock('./connection', () => ({
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

const siteSettings: SiteSettingsRecord = {
  siteId: site.siteId,
  readingProgressEnabled: true,
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

function progress(url: string): ProgressRecord {
  return {
    siteId: site.siteId,
    url,
    viewedRanges: [{ start: 0, end: 50 }],
    viewedHeight: 50,
    updatedAt: 3,
  };
}

describe('portable site data storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes imported page and progress urls before storing them', async () => {
    const stores = {
      sites: { put: vi.fn() },
      pages: { delete: vi.fn(), put: vi.fn() },
      progress: { delete: vi.fn(), put: vi.fn() },
      siteSettings: { put: vi.fn() },
    };
    getPages.mockResolvedValue([page('https://docs.example.com/old/')]);
    getProgressForSite.mockResolvedValue([progress('https://docs.example.com/old/')]);
    tx.mockImplementation(async (_stores, _mode, run) => run(stores));
    const { replacePortableSiteData } = await import('./portable-site-data');
    const bundle: PortableSiteBundle = {
      site,
      pages: [page('https://docs.example.com/intro/')],
      progress: [progress('https://docs.example.com/intro/')],
      siteSettings,
    };

    await replacePortableSiteData(bundle);

    expect(stores.pages.put).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://docs.example.com/intro',
    }));
    expect(stores.progress.put).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://docs.example.com/intro',
    }));
  });
});
