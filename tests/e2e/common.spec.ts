import { expect, test, type Page } from '@playwright/test';
import {
  anotherIndexedPageUrl,
  createIndexFromPopup,
  currentPageProgress,
  expectPopupIndexed,
  launchExtension,
  waitForInjectedProgressUi,
  waitForPageProgressAtLeast,
  waitForPageProgressGreaterThan,
  waitForPopupReady,
  type ExtensionHarness,
} from './extension';
import { selectedSites, type E2ESite } from './sites';

// 通用业务用例按 registry 参数化运行：每个站点都必须跑同一组场景。
// 当前文件覆盖 6 个通用场景：
// 1. 打开站点入口页，并让 popup 识别当前文档 scope。
// 2. 通过 popup 创建索引，验证索引流程能完成。
// 3. 页面注入进度 UI，滚动正文后能记录阅读进度。
// 4. 跳到另一个已索引页面，验证新页面进度增长，且旧页面进度仍按旧条目加载。
// 5. popup 和页面刷新后仍能读回索引/进度，验证数据持久化。
// 6. options 管理页能看到目标站点索引，并能删除它。
//
// 这里不测试各站点 adapter 的特殊 DOM 假设；那些放在 sites.spec.ts。
// 使用 E2E_SITE=<site-id> 时，selectedSites() 会把这些场景过滤成单个站点执行。
for (const site of selectedSites()) {
  test.describe(`${site.id} common business flow`, () => {
    test('indexes, tracks reading progress, persists it, and deletes the index from options', async ({}, testInfo) => {
      const harness = await launchExtension(testInfo);
      try {
        const page = await openSiteEntryPage(harness, site);
        const popup = await assertPopupRecognizesSite(harness, page, site);

        await createSiteIndexFromPopup(popup);
        const progressAfterScroll = await trackReadingProgressOnPage(page);
        const secondPageProgress = await trackAnotherPageAndAssertPreviousProgress(page, progressAfterScroll);
        await assertPopupReadsPersistedIndex(popup, page, site);
        await assertPageProgressPersistsAfterReload(page, secondPageProgress);
        await deleteSiteIndexFromOptions(harness, site);
      } finally {
        await harness.close();
      }
    });
  });
}

// 测试：真实打开 registry 配置的站点入口页，作为后续 popup 识别和索引的业务页面。
// 不测试：站点具体 DOM 结构是否满足 adapter 假设；这属于站点专用用例。
async function openSiteEntryPage(harness: ExtensionHarness, site: E2ESite): Promise<Page> {
  const page = await harness.context.newPage();
  await page.goto(site.entryUrl, { waitUntil: 'domcontentloaded' });
  return page;
}

// 测试：popup 能基于当前 active tab 识别到正确文档 scope。
// 不测试：popup 内每个展示字段的视觉布局，只验证进入了可索引的目标 scope。
async function assertPopupRecognizesSite(harness: ExtensionHarness, page: Page, site: E2ESite): Promise<Page> {
  const popup = await harness.openPopup(page);
  await waitForPopupReady(popup, site.expectedScopeTitle);
  return popup;
}

// 测试：用户从 popup 点击 Create/Rebuild index 后，background 索引流程能跑到完成态。
// 不测试：索引里每个页面的精确数量或顺序；那些更适合 adapter/unit test 保证。
async function createSiteIndexFromPopup(popup: Page): Promise<void> {
  await createIndexFromPopup(popup);
}

// 测试：索引完成后 content script 会注入进度 UI，并且滚动正文会让页面进度相对初始值增长。
// 不测试：全站总进度百分比是否大于 0，因为大 scope 下单页阅读可能被四舍五入成 0%。
async function trackReadingProgressOnPage(page: Page): Promise<TrackedPageProgress> {
  await page.bringToFront();
  await waitForInjectedProgressUi(page);
  const progressBeforeScroll = await currentPageProgress(page);
  const url = page.url();
  const progress = await scrollAndWaitForCurrentPageProgress(page, progressBeforeScroll);
  return { url, progress };
}

// 测试：跳到另一个已索引页面后，阅读进度要对应“新页面自己的条目”增长；
// 同时返回旧页面时，旧页面自己的条目仍然能加载到之前记录的进度。
// 不测试：站点 SPA 路由机制本身是否正确；这里只通过已索引 URL 验证跨页面进度归属不串条目。
async function trackAnotherPageAndAssertPreviousProgress(
  page: Page,
  previousPageProgress: TrackedPageProgress,
): Promise<TrackedPageProgress> {
  const nextUrl = await anotherIndexedPageUrl(page, previousPageProgress.url);

  await page.goto(nextUrl, { waitUntil: 'domcontentloaded' });
  await waitForInjectedProgressUi(page);
  const progressBeforeScroll = await currentPageProgress(page);
  const progress = await scrollAndWaitForCurrentPageProgress(page, progressBeforeScroll);

  await page.goto(previousPageProgress.url, { waitUntil: 'domcontentloaded' });
  await waitForInjectedProgressUi(page);
  await waitForPageProgressAtLeast(page, previousPageProgress.url, previousPageProgress.progress);

  await page.goto(nextUrl, { waitUntil: 'domcontentloaded' });
  await waitForInjectedProgressUi(page);
  await waitForPageProgressAtLeast(page, nextUrl, progress);

  return { url: nextUrl, progress };
}

async function scrollAndWaitForCurrentPageProgress(page: Page, progressBeforeScroll: number): Promise<number> {
  // 分段滚动比一次性大滚动更容易肉眼观察，也更接近真实阅读动作。
  for (let step = 0; step < 3; step += 1) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(1_500);
  }

  // 额外停留一会儿，让 content script 的节流保存和页面 badge 刷新都有时间完成。
  await page.waitForTimeout(5_000);
  return waitForPageProgressGreaterThan(page, progressBeforeScroll);
}

// 测试：重新加载 popup 后仍然能读到已创建的索引摘要。
// 不测试：popup 总进度展示是否大于 0；阅读进度持久化由页面 badge 场景验证。
async function assertPopupReadsPersistedIndex(popup: Page, businessPage: Page, site: E2ESite): Promise<void> {
  await businessPage.bringToFront();
  await popup.reload();
  await waitForPopupReady(popup, site.expectedScopeTitle);
  await expectPopupIndexed(popup);
}

// 测试：刷新业务页面后，当前页面对应 badge 仍然不低于滚动后的值，证明进度已持久化。
// 不测试：所有 sidebar 链接的进度值，只关心当前业务闭环是否写入并恢复成功。
async function assertPageProgressPersistsAfterReload(page: Page, progressAfterScroll: TrackedPageProgress): Promise<void> {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForInjectedProgressUi(page);
  await waitForPageProgressAtLeast(page, progressAfterScroll.url, progressAfterScroll.progress);
}

// 测试：options 管理页能定位目标站点索引，并能通过 Delete index 删除它。
// 不测试：导入导出、清空进度、站点设置等 options 其他管理能力。
async function deleteSiteIndexFromOptions(harness: ExtensionHarness, site: E2ESite): Promise<void> {
  const options = await harness.openOptions(site.expectedSiteId);
  await expect(options.locator('.page-title')).toContainText(site.expectedScopeTitle, { timeout: 30_000 });
  options.once('dialog', (dialog) => dialog.accept());
  await options.getByRole('button', { name: 'Delete index' }).click();
  await expect(options.getByRole('button', { name: 'Delete index' })).toHaveCount(0, { timeout: 30_000 });
  await expect(options.locator('.site-list-main', { hasText: site.expectedScopeTitle })).toHaveCount(0);
}

type TrackedPageProgress = {
  url: string;
  progress: number;
};
