vi.mock('./connection', () => ({
  requestToPromise: vi.fn((request) => Promise.resolve(request)),
  tx: vi.fn(),
}));

vi.mock('../../shared/url', () => ({
  normalizePageUrl: vi.fn((url: string) => url.replace(/#.*$/, '')),
}));

const { tx } = vi.mocked(await import('./connection'));

describe('indexed db page settings storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns defaults for missing page settings', async () => {
    const pageSettings = { get: vi.fn(() => undefined) };
    tx.mockImplementation(async (_stores, _mode, run) => run({ pageSettings } as never));
    const { getPageSettings } = await import('./page-settings');

    await expect(getPageSettings('docs::root', 'https://docs.example.com/a#intro')).resolves.toEqual({
      siteId: 'docs::root',
      url: 'https://docs.example.com/a',
    });
  });

  it('normalizes urls and saves a reading progress override', async () => {
    const pageSettings = {
      get: vi.fn(() => undefined),
      put: vi.fn(),
    };
    tx.mockImplementation(async (_stores, _mode, run) => run({ pageSettings } as never));
    const { savePageSettings } = await import('./page-settings');

    await savePageSettings('docs::root', 'https://docs.example.com/a#intro', { readingProgressEnabled: false });

    expect(pageSettings.put).toHaveBeenCalledWith({
      siteId: 'docs::root',
      url: 'https://docs.example.com/a',
      readingProgressEnabled: false,
    });
  });

  it('ignores invalid stored values', async () => {
    const pageSettings = { get: vi.fn(() => ({ readingProgressEnabled: 'no' })) };
    tx.mockImplementation(async (_stores, _mode, run) => run({ pageSettings } as never));
    const { getPageSettings } = await import('./page-settings');

    await expect(getPageSettings('docs::root', 'https://docs.example.com/a')).resolves.toEqual({
      siteId: 'docs::root',
      url: 'https://docs.example.com/a',
    });
  });
});
