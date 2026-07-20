import { browser } from 'wxt/browser';
import { lfdDebug } from '../shared/logger';
import {
  handleDevelopmentIndexShortcut,
  isDevelopmentIndexShortcut,
} from './development-index-shortcut';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn(),
    },
  },
}));
vi.mock('../shared/logger', () => ({
  lfdDebug: vi.fn(),
}));

function shortcutEvent(overrides: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    code: 'KeyL',
    ctrlKey: true,
    shiftKey: true,
    cancelable: true,
    ...overrides,
  });
}

describe('development index shortcut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recognizes only the page-level Ctrl+Shift+L shortcut', () => {
    expect(isDevelopmentIndexShortcut(shortcutEvent())).toBe(true);
    expect(isDevelopmentIndexShortcut(shortcutEvent({ metaKey: true }))).toBe(false);
    expect(isDevelopmentIndexShortcut(shortcutEvent({ repeat: true }))).toBe(false);
    expect(isDevelopmentIndexShortcut(shortcutEvent({ code: 'KeyK' }))).toBe(false);
  });

  it('requests indexing and reports completion', async () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValue({
      ok: true,
      site: { siteId: 'playwright.dev::python-docs' },
      pages: [{ url: 'https://playwright.dev/python/docs/intro' }],
    });
    const event = shortcutEvent();

    handleDevelopmentIndexShortcut(event);

    expect(event.defaultPrevented).toBe(true);
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'DEV_START_INDEX_FROM_PAGE' });
    await vi.waitFor(() => expect(lfdDebug).toHaveBeenCalledWith(
      'development index shortcut completed',
      { siteId: 'playwright.dev::python-docs', pageCount: 1 },
    ));
  });

  it('ignores unrelated key presses', () => {
    handleDevelopmentIndexShortcut(shortcutEvent({ code: 'KeyK' }));

    expect(browser.runtime.sendMessage).not.toHaveBeenCalled();
  });
});
