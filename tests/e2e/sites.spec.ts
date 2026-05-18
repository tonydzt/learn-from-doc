import { expect, test, type Page } from '@playwright/test';
import { launchExtension, waitForPopupReady, type ExtensionHarness } from './extension';
import { selectedSites, type E2ESite } from './sites';

// 站点专用用例只覆盖 adapter 相关的真实 DOM 假设。
// 跨站点共享业务闭环放在 common.spec.ts，避免这里重复索引/进度流程。
for (const site of selectedSites()) {
  test.describe(`${site.id} site-specific behavior`, () => {
    test('matches the expected site adapter and document structure', async ({}, testInfo) => {
      const harness = await launchExtension(testInfo);
      try {
        const page = await harness.context.newPage();
        await page.goto(site.entryUrl, { waitUntil: 'domcontentloaded' });

        const popup = await harness.openPopup(page);
        await waitForPopupReady(popup, site.expectedScopeTitle);

        await runSiteSpecificAssertions(harness, page, site);
      } finally {
        await harness.close();
      }
    });
  });
}

async function runSiteSpecificAssertions(harness: ExtensionHarness, page: Page, site: E2ESite): Promise<void> {
  if (site.id === 'react-dev') {
    await assertReactDevAdapterBehavior(harness, page, site);
    return;
  }

  if (site.id === 'playwright-dev') {
    await assertPlaywrightDevAdapterBehavior(page);
    return;
  }

  if (site.id === 'openai-codex') {
    await assertOpenAICodexAdapterBehavior(page);
  }
}

// 测试：react.dev 的 Learn/Reference 两套 scope 能被 popup 区分，并且 Learn 页有可定位正文和导航。
// 不测试：索引创建、阅读进度、跨页持久化；这些属于 common.spec.ts 的通用业务闭环。
async function assertReactDevAdapterBehavior(harness: ExtensionHarness, page: Page, site: E2ESite): Promise<void> {
  await expect(page.locator('aside nav, nav[aria-label="Main"], nav[aria-label="Docs"], nav[aria-label="Sidebar"]').first()).toBeVisible();
  await expect(page.locator('main article, article, main').first()).toBeVisible();
  const referencePage = await harness.context.newPage();
  await referencePage.goto(site.scopeProbeUrl!, { waitUntil: 'domcontentloaded' });
  const referencePopup = await harness.openPopup(referencePage);
  await waitForPopupReady(referencePopup, 'React Reference');
}

// 测试：playwright.dev 的 Docusaurus 结构仍有 docs sidebar、main article，且 sidebar 链接归属 /docs scope。
// 不测试：折叠菜单展开后的完整链接数量；精确去重和排序更适合 adapter 单元测试。
async function assertPlaywrightDevAdapterBehavior(page: Page): Promise<void> {
  await expect(page.locator('nav[aria-label="Docs sidebar"]')).toBeVisible();
  await expect(page.locator('main article')).toBeVisible();
  const sidebarUrls = await page.locator('nav[aria-label="Docs sidebar"] a[href^="/docs"], nav[aria-label="Docs sidebar"] a[href^="https://playwright.dev/docs"]').evaluateAll((links) => {
    return links.map((link) => new URL((link as HTMLAnchorElement).href).href.split('#')[0]);
  });
  expect(sidebarUrls.length).toBeGreaterThan(0);
  expect(sidebarUrls.every((url) => url.startsWith('https://playwright.dev/docs'))).toBe(true);
}

// 测试：OpenAI Codex 页面仍能通过左侧 nav 和 article/changelog fallback 定位到 adapter 入口。
// 不测试：Codex 站点内每个文档链接是否都可索引；完整索引流程由通用 E2E 覆盖。
async function assertOpenAICodexAdapterBehavior(page: Page): Promise<void> {
  await expect(page.locator('nav[data-left-nav][data-left-nav-id="/codex"]')).toBeVisible();
  await expect(page.locator('article#mainContent, #codex-changelog')).toBeVisible();
  const codexLinks = await page.locator('nav[data-left-nav][data-left-nav-id="/codex"] a[href]').evaluateAll((links) => {
    return links.map((link) => new URL((link as HTMLAnchorElement).href));
  });
  expect(codexLinks.length).toBeGreaterThan(0);
  expect(codexLinks.every((url) => url.hostname === 'developers.openai.com')).toBe(true);
}
