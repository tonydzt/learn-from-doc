import { browser } from 'wxt/browser';
import { prepareIndexStart } from './index-start';

vi.mock('wxt/browser', () => ({
  browser: {
    permissions: {
      contains: vi.fn(),
      request: vi.fn(),
    },
    runtime: {
      sendMessage: vi.fn(async () => ({ ok: true })),
    },
  },
}));

describe('popup index start permission handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps an already authorized index run in the popup direct path', async () => {
    vi.mocked(browser.permissions.contains).mockResolvedValue(true);

    expect(await prepareIndexStart({
      tabId: 17,
      url: 'https://ui.shadcn.com/docs',
      adapterKind: 'framework',
      now: 1_000,
    })).toBe('start-now');

    expect(browser.runtime.sendMessage).not.toHaveBeenCalled();
    expect(browser.permissions.request).not.toHaveBeenCalled();
  });

  it('registers background continuation only when origin permission is missing', async () => {
    vi.mocked(browser.permissions.contains).mockResolvedValue(false);
    vi.mocked(browser.permissions.request).mockResolvedValue(true);

    expect(await prepareIndexStart({
      tabId: 17,
      url: 'https://ui.shadcn.com/docs',
      adapterKind: 'framework',
      now: 1_000,
    })).toBe('background-resumes');

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'REGISTER_PENDING_INDEX_AFTER_PERMISSION',
      pending: {
        tabId: 17,
        url: 'https://ui.shadcn.com/docs',
        originPattern: 'https://ui.shadcn.com/*',
        createdAt: 1_000,
      },
    });
    expect(browser.permissions.request).toHaveBeenCalledWith({
      origins: ['https://ui.shadcn.com/*'],
    });
  });

  it('clears background continuation when permission is denied', async () => {
    vi.mocked(browser.permissions.contains).mockResolvedValue(false);
    vi.mocked(browser.permissions.request).mockResolvedValue(false);

    await expect(prepareIndexStart({
      tabId: 17,
      url: 'https://ui.shadcn.com/docs',
      adapterKind: 'framework',
      now: 1_000,
    })).rejects.toThrow('Origin permission is required');

    expect(browser.runtime.sendMessage).toHaveBeenLastCalledWith({
      type: 'CLEAR_PENDING_INDEX_AFTER_PERMISSION',
    });
  });
});
