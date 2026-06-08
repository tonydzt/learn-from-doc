import { indexAll, requestToPromise, tx } from './connection';
import type { PageIndexRecord, PageSettingsRecord, ProgressRecord, SiteRecord } from './types';

// 读取一个文档范围的站点元数据。
export async function getSite(siteId: string): Promise<SiteRecord | undefined> {
  return tx(['sites'], 'readonly', ({ sites }) => requestToPromise<SiteRecord | undefined>(sites.get(siteId)));
}

// 读取所有已经创建过索引的文档范围。
export async function getAllSites(): Promise<SiteRecord[]> {
  return tx(['sites'], 'readonly', ({ sites }) => requestToPromise<SiteRecord[]>(sites.getAll()));
}

// 删除一个文档范围的完整索引，包括 site、pages、progress 和单页设置。
export async function deleteSiteIndex(siteId: string): Promise<void> {
  const [pages, progress, pageSettings] = await Promise.all([
    tx(['pages'], 'readonly', ({ pages }) => indexAll<PageIndexRecord>(pages, 'bySite', siteId)),
    tx(['progress'], 'readonly', ({ progress }) => indexAll<ProgressRecord>(progress, 'bySite', siteId)),
    tx(['pageSettings'], 'readonly', ({ pageSettings }) => indexAll<PageSettingsRecord>(pageSettings, 'bySite', siteId)),
  ]);

  await tx(['sites', 'pages', 'progress', 'siteSettings', 'pageSettings'], 'readwrite', async ({ sites, pages: pageStore, progress: progressStore, siteSettings, pageSettings: pageSettingsStore }) => {
    sites.delete(siteId);
    siteSettings.delete(siteId);
    // pages/progress 的主键都是 [siteId, url]，删除时也必须使用复合主键数组。
    pages.forEach((page) => pageStore.delete([siteId, page.url]));
    progress.forEach((record) => progressStore.delete([siteId, record.url]));
    pageSettings.forEach((settings) => pageSettingsStore.delete([siteId, settings.url]));
  });
}
