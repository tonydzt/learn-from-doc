import { indexAll, requestToPromise, tx } from './connection';
import type { PageIndexRecord, SiteRecord } from './types';

// 保存一次完整的站点索引：更新 site，并用新的 pages 列表替换旧 pages 列表。
export async function replaceSitePages(site: SiteRecord, pages: PageIndexRecord[]): Promise<void> {
  // 重建索引时替换 pages，但不删除 progress。
  // 这样同 URL 的历史阅读进度还能被后续计算继续使用。
  const existing = await getPages(site.siteId);
  await tx(['sites', 'pages'], 'readwrite', async ({ sites, pages: pageStore }) => {
    sites.put(site);
    existing.forEach((page) => pageStore.delete([site.siteId, page.url]));
    pages.forEach((page) => pageStore.put(page));
  });
}

// 读取某个文档范围下的所有页面索引，并按导航顺序返回。
export async function getPages(siteId: string): Promise<PageIndexRecord[]> {
  const pages = await tx(['pages'], 'readonly', ({ pages }) => indexAll<PageIndexRecord>(pages, 'bySite', siteId));
  return pages.sort((a, b) => a.order - b.order);
}

// 读取某个文档范围下的单页索引记录。
export async function getPage(siteId: string, url: string): Promise<PageIndexRecord | undefined> {
  // 复合主键查询必须传入和 keyPath 一样的数组顺序：[siteId, url]。
  return tx(['pages'], 'readonly', ({ pages }) => requestToPromise<PageIndexRecord | undefined>(pages.get([siteId, url])));
}
