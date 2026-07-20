import { ACCOUNT_SESSION_STORAGE_KEY } from '../../settings/account-session';
import type { PortableData } from '../../storage/portable-data';
import {
  getServerIndexAvailability,
  pullReviewServerIndex,
  pullServerIndex,
  uploadServerIndex,
} from './server-indexes';

const getStoredAccountSession = vi.fn();
const getAllSites = vi.fn();
const getSite = vi.fn();
const getPages = vi.fn();
const getProgressForSite = vi.fn();
const getSiteSettings = vi.fn();
const replacePortableSiteData = vi.fn();
const notifyIndexUpdated = vi.fn();

vi.mock('../../storage/settings', () => ({
  getStoredAccountSession: () => getStoredAccountSession(),
}));

vi.mock('../../storage/db', () => ({
  getAllSites: () => getAllSites(),
  getSite: (siteId: string) => getSite(siteId),
  getPages: (siteId: string) => getPages(siteId),
  getProgressForSite: (siteId: string) => getProgressForSite(siteId),
  getSiteSettings: (siteId: string) => getSiteSettings(siteId),
  replacePortableSiteData: (bundle: unknown) => replacePortableSiteData(bundle),
}));

vi.mock('./tabs', () => ({
  notifyIndexUpdated: (siteId: string) => notifyIndexUpdated(siteId),
}));

const session = {
  accessToken: 'token-1',
  user: { id: 'user-1', email: 'reader@example.com' },
  permissions: { canSync: true, canPullServerData: true, canTestSystemIndexes: true },
  expiresAt: Date.parse('2100-01-01T00:00:00Z'),
  updatedAt: 1,
};

const site = {
  siteId: 'react.dev::learn',
  host: 'react.dev',
  scopeKey: 'learn',
  scopeTitle: 'React Learn',
  createdAt: 1,
  updatedAt: 2,
};

const page = {
  siteId: site.siteId,
  url: 'https://react.dev/learn',
  title: 'Quick Start',
  order: 0,
  contentHeight: 1000,
};

const progress = {
  siteId: site.siteId,
  url: page.url,
  viewedRanges: [{ start: 0, end: 500 }],
  viewedHeight: 500,
  updatedAt: 3,
};

function portablePayload(): PortableData {
  return {
    schemaVersion: 1,
    exportedAt: 10,
    scope: 'site',
    includeProgress: true,
    sites: [{
      site,
      pages: [page],
      siteSettings: { siteId: site.siteId, readingProgressEnabled: true },
      progress: [progress],
    }],
  };
}

describe('server index sync service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T00:00:00Z'));
    getStoredAccountSession.mockResolvedValue(session);
    getAllSites.mockResolvedValue([]);
    getSite.mockResolvedValue(site);
    getPages.mockResolvedValue([page]);
    getProgressForSite.mockResolvedValue([progress]);
    getSiteSettings.mockResolvedValue({ siteId: site.siteId, readingProgressEnabled: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('requires a logged in account before checking server availability', async () => {
    getStoredAccountSession.mockResolvedValue(null);

    await expect(getServerIndexAvailability(site.siteId)).rejects.toThrow('Please log in first.');
  });

  it('checks server availability with pull permission', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      available: true,
      kinds: ['system', 'user_upload', 'pending_review'],
      site: { siteId: site.siteId, pageCount: 1, updatedAt: 10 },
    }), { status: 200 }));

    await expect(getServerIndexAvailability(site.siteId)).resolves.toEqual({
      available: true,
      kinds: ['system', 'user_upload', 'pending_review'],
      site: { siteId: site.siteId, pageCount: 1, updatedAt: 10 },
    });

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/indexes/availability?siteId=react.dev%3A%3Alearn', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-1' },
    });
  });

  it('rejects server pull without pull permission', async () => {
    getStoredAccountSession.mockResolvedValue({
      ...session,
      permissions: { canSync: true, canPullServerData: false, canTestSystemIndexes: true },
    });

    await expect(pullServerIndex(site.siteId, true)).rejects.toThrow('Server data pull is not enabled for this account.');
  });

  it('does not overwrite a conflicting local index unless requested', async () => {
    getAllSites.mockResolvedValue([site]);

    await expect(pullServerIndex(site.siteId, false)).rejects.toThrow('Local index already exists.');
    expect(fetch).not.toHaveBeenCalled();
    expect(replacePortableSiteData).not.toHaveBeenCalled();
  });

  it('pulls a server index and imports the requested site', async () => {
    getAllSites.mockResolvedValue([site]);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      serverUpdatedAt: 20,
      payload: portablePayload(),
    }), { status: 200 }));

    await expect(pullServerIndex(site.siteId, true)).resolves.toEqual({
      importedCount: 1,
      serverUpdatedAt: 20,
    });

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/indexes/pull?siteId=react.dev%3A%3Alearn', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-1' },
    });
    expect(replacePortableSiteData).toHaveBeenCalledWith(portablePayload().sites[0]);
    expect(notifyIndexUpdated).toHaveBeenCalledWith(site.siteId);
  });

  it('rejects review server pull without test-system-index permission', async () => {
    getStoredAccountSession.mockResolvedValue({
      ...session,
      permissions: { canSync: true, canPullServerData: true, canTestSystemIndexes: false },
    });

    await expect(pullReviewServerIndex(site.siteId, true)).rejects.toThrow('System index testing is not enabled for this account.');
  });

  it('pulls a pending-review server index and imports the requested site', async () => {
    getAllSites.mockResolvedValue([site]);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      serverUpdatedAt: 20,
      payload: portablePayload(),
    }), { status: 200 }));

    await expect(pullReviewServerIndex(site.siteId, true)).resolves.toEqual({
      importedCount: 1,
      serverUpdatedAt: 20,
    });

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/indexes/review-pull?siteId=react.dev%3A%3Alearn', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-1' },
    });
    expect(replacePortableSiteData).toHaveBeenCalledWith(portablePayload().sites[0]);
    expect(notifyIndexUpdated).toHaveBeenCalledWith(site.siteId);
  });

  it('uploads the selected site with reading progress', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      serverUpdatedAt: 20,
      siteCount: 1,
    }), { status: 200 }));

    await expect(uploadServerIndex(site.siteId)).resolves.toEqual({
      ok: true,
      serverUpdatedAt: 20,
      siteCount: 1,
    });

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/indexes/upload', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schemaVersion: 1,
        clientUpdatedAt: Date.parse('2026-06-11T00:00:00Z'),
        payload: {
          schemaVersion: 1,
          exportedAt: Date.parse('2026-06-11T00:00:00Z'),
          scope: 'site',
          includeProgress: true,
          sites: [{
            site,
            pages: [page],
            siteSettings: { siteId: site.siteId, readingProgressEnabled: true },
            progress: [progress],
          }],
        },
      }),
    });
  });

  it('rejects upload without sync permission', async () => {
    getStoredAccountSession.mockResolvedValue({
      ...session,
      permissions: { canSync: false, canPullServerData: true, canTestSystemIndexes: true },
    });

    await expect(uploadServerIndex(site.siteId)).rejects.toThrow('Multi-device sync is not enabled for this account.');
  });
});
