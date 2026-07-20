import { browser } from 'wxt/browser';
import {
  getCachedServerIndexAvailability,
  saveCachedServerIndexAvailability,
  SERVER_INDEX_AVAILABILITY_CACHE_KEY,
} from './server-index-availability';

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
      },
    },
  },
}));

describe('server index availability cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for missing cached availability', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValue({});

    await expect(getCachedServerIndexAvailability('react.dev::learn')).resolves.toBeNull();

    expect(browser.storage.local.get).toHaveBeenCalledWith(SERVER_INDEX_AVAILABILITY_CACHE_KEY);
  });

  it('returns cached availability for a site', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValue({
      [SERVER_INDEX_AVAILABILITY_CACHE_KEY]: {
        'react.dev::learn': {
          available: true,
          kinds: ['system', 'pending_review'],
          pageCount: 3,
          updatedAt: 123,
        },
      },
    });

    await expect(getCachedServerIndexAvailability('react.dev::learn')).resolves.toEqual({
      available: true,
      kinds: ['system', 'pending_review'],
      pageCount: 3,
      updatedAt: 123,
    });
  });

  it('merges saved availability with existing cached sites', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValue({
      [SERVER_INDEX_AVAILABILITY_CACHE_KEY]: {
        'playwright.dev::docs': { available: false },
      },
    });

    await saveCachedServerIndexAvailability('react.dev::learn', {
      available: true,
      kinds: ['user_upload'],
      pageCount: 3,
      updatedAt: 123,
    });

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      [SERVER_INDEX_AVAILABILITY_CACHE_KEY]: {
        'playwright.dev::docs': { available: false, kinds: [] },
        'react.dev::learn': {
          available: true,
          kinds: ['user_upload'],
          pageCount: 3,
          updatedAt: 123,
        },
      },
    });
  });

  it('ignores malformed cached values', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValue({
      [SERVER_INDEX_AVAILABILITY_CACHE_KEY]: {
        'react.dev::learn': { pageCount: 3 },
      },
    });

    await expect(getCachedServerIndexAvailability('react.dev::learn')).resolves.toBeNull();
  });

  it('normalizes missing or malformed kinds to an empty list', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValue({
      [SERVER_INDEX_AVAILABILITY_CACHE_KEY]: {
        'react.dev::learn': { available: true, kinds: [123, 'system', null] },
        'playwright.dev::docs': { available: false },
      },
    });

    await expect(getCachedServerIndexAvailability('react.dev::learn')).resolves.toEqual({
      available: true,
      kinds: ['system'],
    });
    await expect(getCachedServerIndexAvailability('playwright.dev::docs')).resolves.toEqual({
      available: false,
      kinds: [],
    });
  });
});
