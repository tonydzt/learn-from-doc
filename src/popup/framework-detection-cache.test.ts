import { browser } from 'wxt/browser';
import {
  cachedDetectedFrameworkContextForUrl,
  saveDetectedFrameworkContext,
} from './framework-detection-cache';
import type { PageAdapterContext } from '../shared/messages';

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(async () => undefined),
      },
    },
  },
}));

const fumadocsContext: PageAdapterContext = {
  supported: true,
  host: 'ui.shadcn.com',
  scopeKey: 'docs',
  scopeTitle: 'Fumadocs Docs',
  adapterKind: 'framework',
  frameworkName: 'Fumadocs',
  indexable: true,
};

describe('popup framework detection cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores supported framework detections by host and scope', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValue({});

    await saveDetectedFrameworkContext(fumadocsContext);

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      detectedFrameworkContexts: {
        'ui.shadcn.com::docs': fumadocsContext,
      },
    });
  });

  it('stores popup probe fallback detections without requiring a content adapter id', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValue({});
    const probeContext = {
      ...fumadocsContext,
      adapterId: undefined,
    };

    await saveDetectedFrameworkContext(probeContext);

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      detectedFrameworkContexts: {
        'ui.shadcn.com::docs': probeContext,
      },
    });
  });

  it('matches cached detections by host and first path segment', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValue({
      detectedFrameworkContexts: {
        'ui.shadcn.com::docs': fumadocsContext,
      },
    });

    expect(await cachedDetectedFrameworkContextForUrl('https://ui.shadcn.com/docs/components/button')).toEqual(fumadocsContext);
    expect(await cachedDetectedFrameworkContextForUrl('https://ui.shadcn.com/blocks')).toBeNull();
    expect(await cachedDetectedFrameworkContextForUrl('https://example.com/docs')).toBeNull();
  });

  it('matches root-wide cached detections across the same host', async () => {
    const rootContext: PageAdapterContext = {
      ...fumadocsContext,
      host: 'docs.sillytavern.app',
      scopeKey: 'root',
      scopeTitle: 'Retype Docs',
      frameworkName: 'Retype',
    };
    vi.mocked(browser.storage.local.get).mockResolvedValue({
      detectedFrameworkContexts: {
        'docs.sillytavern.app::root': rootContext,
      },
    });

    expect(await cachedDetectedFrameworkContextForUrl('https://docs.sillytavern.app/usage/')).toEqual(rootContext);
    expect(await cachedDetectedFrameworkContextForUrl('https://other.example/usage/')).toBeNull();
  });
});
