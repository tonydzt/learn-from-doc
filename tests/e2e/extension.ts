import { chromium, expect, type BrowserContext, type Page, type TestInfo, type Worker } from '@playwright/test';
import path from 'node:path';
import { normalizePageUrl } from '../../src/shared/url';

export type ExtensionHarness = {
  context: BrowserContext;
  extensionId: string;
  // popup 依赖当前 active tab。传入 activePage 后 helper 会尽量让 popup 看到这一个业务页面。
  openPopup(activePage?: Page): Promise<Page>;
  openOptions(siteId?: string): Promise<Page>;
  close(): Promise<void>;
};

const extensionPath = path.resolve(process.cwd(), 'output/chrome-mv3');

export async function launchExtension(testInfo: TestInfo): Promise<ExtensionHarness> {
  // Chrome 扩展只能在 persistent context 里加载；每个测试使用独立 profile，隔离 IndexedDB/storage。
  const context = await chromium.launchPersistentContext(testInfo.outputPath('profile'), {
    headless: false,
    args: [
      // 本地/沙箱环境下 Chromium crashpad 可能写系统目录，禁用后减少无关启动失败。
      '--disable-crash-reporter',
      '--disable-crashpad',
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  // MV3 extension id 不在 manifest 里直接暴露。service worker URL 的 host 就是运行时 id。
  // 这里serviceWorkers一般长这样：chrome-extension://abcdefghijklmnopabcdefghijklmnop/background.js
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  // 从 service worker URL 提取 extension id，格式为：abcdefghijklmnopabcdefghijklmnop
  const extensionId = new URL(worker.url()).host;

  return {
    context,
    extensionId,
    openPopup: (activePage?: Page) => openExtensionPopup(context, worker, extensionId, activePage),
    openOptions: (siteId?: string) => context.newPage().then(async (page) => {
      await page.goto(`chrome-extension://${extensionId}/options.html${siteId ? `?siteId=${encodeURIComponent(siteId)}` : ''}`);
      return page;
    }),
    close: () => context.close(),
  };
}

async function openExtensionPopup(
  context: BrowserContext,
  worker: Worker,
  extensionId: string,
  activePage?: Page,
): Promise<Page> {
  if (activePage) await activePage.bringToFront();
  try {
    // 优先走真实 action popup，最接近用户点击扩展图标的行为。
    const popupPromise = context.waitForEvent('page', { timeout: 5_000 });
    await worker.evaluate(() => chrome.action.openPopup());
    const popup = await popupPromise;
    await popup.waitForURL(`chrome-extension://${extensionId}/popup.html`);
    console.info('[e2e] opened extension popup via chrome.action.openPopup()');
    return popup;
  } catch (error) {
    console.info('[e2e] chrome.action.openPopup() was not available; falling back to popup.html tab', {
      activePageUrl: activePage?.url(),
      error: error instanceof Error ? error.message : String(error),
    });
    // 某些 Chromium/平台组合不会稳定打开 action popup。
    // fallback 直接打开 popup.html，并只在这个 popup 页面里改写 active tab 查询结果。
    const popup = await context.newPage();
    if (activePage) {
      const targetTab = await tabForPage(worker, activePage.url());
      await popup.addInitScript(({ tabId, tabUrl }) => {
        const originalQuery = chrome.tabs.query.bind(chrome.tabs);
        chrome.tabs.query = ((queryInfo: chrome.tabs.QueryInfo, callback?: (result: chrome.tabs.Tab[]) => void) => {
          if (queryInfo.active && queryInfo.currentWindow) {
            const result = [{ id: tabId, url: tabUrl }] as chrome.tabs.Tab[];
            if (callback) {
              callback(result);
              return undefined;
            }
            return Promise.resolve(result);
          }
          return originalQuery(queryInfo, callback as never) as never;
        }) as typeof chrome.tabs.query;
      }, { tabId: targetTab.id, tabUrl: activePage.url() });
      await activePage.bringToFront();
    }
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    return popup;
  }
}

async function tabForPage(worker: Worker, pageUrl: string): Promise<{ id: number }> {
  // 从 service worker 查询真实 tab id，后续 START_INDEX 仍然会作用到业务页面 tab。
  return worker.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url });
    if (tab?.id == null) throw new Error(`No tab found for ${url}`);
    return { id: tab.id };
  }, pageUrl);
}

export async function waitForInjectedProgressUi(page: Page): Promise<void> {
  // 这两个 data attribute 是 content script 注入 UI 的稳定测试契约，避免依赖样式类名。
  // 页面上必须出现一个带有 data-developer-docs-progress-tracker="total" 属性的元素，并且这个元素必须是可见的。最多等待 30 秒。
  await expect(page.locator('[data-developer-docs-progress-tracker="total"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-developer-docs-progress-tracker="page-badge"]').first()).toBeVisible({ timeout: 30_000 });
}

export async function waitForPageProgressGreaterThan(page: Page, baseline: number): Promise<number> {
  // 页面初次加载时可见正文也会被计入阅读进度。
  // 因此滚动测试要比较“滚动前后是否增长”，不能只断言进度大于 0。
  await expect.poll(async () => currentPageProgress(page), { timeout: 30_000 }).toBeGreaterThan(baseline);
  return currentPageProgress(page);
}

export async function waitForPageProgressAtLeast(page: Page, url: string, minimum: number): Promise<void> {
  await expect.poll(async () => pageProgressForUrl(page, url), { timeout: 30_000 }).toBeGreaterThanOrEqual(minimum);
}

export async function currentPageProgress(page: Page): Promise<number> {
  return pageProgressForUrl(page, page.url());
}

export async function pageProgressForUrl(page: Page, url: string): Promise<number> {
  const expectedUrl = normalizePageUrl(url);
  const entry = (await pageProgressEntries(page)).find((item) => item.url === expectedUrl);
  return entry?.progress ?? 0;
}

export async function anotherIndexedPageUrl(page: Page, excludedUrl: string): Promise<string> {
  const normalizedExcludedUrl = normalizePageUrl(excludedUrl);
  const entry = (await pageProgressEntries(page)).find((item) => item.url !== normalizedExcludedUrl);
  if (!entry) throw new Error(`Could not find another indexed page from ${normalizedExcludedUrl}`);
  return entry.url;
}

async function pageProgressEntries(page: Page): Promise<Array<{ url: string; progress: number }>> {
  return page.locator('[data-developer-docs-progress-tracker="page-badge"]').evaluateAll((badges) => {
    const normalize = (input: string) => {
      const url = new URL(input);
      url.hash = '';
      url.searchParams.sort();
      return url.toString();
    };
    return badges.flatMap((badge) => {
      const anchor = badge.closest('a');
      const progress = Number.parseInt(badge.textContent ?? '', 10);
      if (!anchor || !Number.isFinite(progress)) return [];
      return [{ url: normalize(anchor.href), progress }];
    });
  });
}

export async function waitForPopupReady(popup: Page, expectedScopeTitle: string): Promise<void> {
  await expect(popup.getByRole('heading', { name: expectedScopeTitle })).toBeVisible({ timeout: 30_000 });
}

export async function createIndexFromPopup(popup: Page): Promise<void> {
  // 创建完成后按钮会变成 Rebuild index，用它作为索引流程结束信号。
  const createButton = popup.getByRole('button', { name: /Create index|Rebuild index/ });
  await expect(createButton).toBeVisible({ timeout: 30_000 });
  await createButton.click();
  await expect(popup.getByRole('button', { name: 'Rebuild index' })).toBeVisible({ timeout: 240_000 });
}

export async function expectPopupIndexed(popup: Page): Promise<void> {
  // popup 这里验证“已索引且能读到索引摘要”，详细的阅读进度持久化由页面 badge 断言负责。
  await expect(popup.getByRole('button', { name: 'Rebuild index' })).toBeVisible({ timeout: 30_000 });
  await expect(popup.locator('.hero-copy p')).toContainText(/pages indexed locally|本地已索引 \d+ 页/);
}
