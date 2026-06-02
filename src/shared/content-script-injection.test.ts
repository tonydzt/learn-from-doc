import { browser } from 'wxt/browser';
import {
  CONTENT_SCRIPT_PENDING_ATTR,
  CONTENT_SCRIPT_READY_ATTR,
  INJECTION_SOURCE_ATTR,
} from './constants';
import { injectContentScript } from './content-script-injection';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      getManifest: vi.fn(() => ({
        content_scripts: [{ js: ['content-scripts/content.js'] }],
      })),
    },
    scripting: {
      executeScript: vi.fn(),
    },
  },
}));

function mockExecuteScript() {
  vi.mocked(browser.scripting.executeScript).mockImplementation(async (details) => {
    if (details.func) {
      const result = details.func(...(details.args ?? []));
      return [{ result }] as never;
    }
    return [] as never;
  });
}

function fileInjectionCount(): number {
  return vi.mocked(browser.scripting.executeScript).mock.calls
    .filter(([details]) => details.files?.includes('content-scripts/content.js'))
    .length;
}

describe('content script injection helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.removeAttribute(CONTENT_SCRIPT_READY_ATTR);
    document.documentElement.removeAttribute(CONTENT_SCRIPT_PENDING_ATTR);
    document.documentElement.removeAttribute(INJECTION_SOURCE_ATTR);
    mockExecuteScript();
  });

  it('skips file injection when the content script is already ready', async () => {
    document.documentElement.setAttribute(CONTENT_SCRIPT_READY_ATTR, 'true');

    await injectContentScript(1, 'test:ready');

    expect(fileInjectionCount()).toBe(0);
  });

  it('skips file injection when a manual injection is already pending', async () => {
    document.documentElement.setAttribute(CONTENT_SCRIPT_PENDING_ATTR, 'true');

    await injectContentScript(1, 'test:pending');

    expect(fileInjectionCount()).toBe(0);
  });

  it('marks pending and source before injecting the manifest content script', async () => {
    await injectContentScript(1, 'test:fresh');

    expect(document.documentElement.getAttribute(CONTENT_SCRIPT_PENDING_ATTR)).toBe('true');
    expect(document.documentElement.getAttribute(INJECTION_SOURCE_ATTR)).toBe('test:fresh');
    expect(fileInjectionCount()).toBe(1);
  });

  it('clears pending when file injection fails', async () => {
    vi.mocked(browser.scripting.executeScript).mockImplementation(async (details) => {
      if (details.func) {
        const result = details.func(...(details.args ?? []));
        return [{ result }] as never;
      }
      throw new Error('inject failed');
    });

    await expect(injectContentScript(1, 'test:fail')).rejects.toThrow('inject failed');

    expect(document.documentElement.hasAttribute(CONTENT_SCRIPT_PENDING_ATTR)).toBe(false);
  });
});
