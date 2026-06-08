import { normalizeSiteSettings } from '../../settings/site-settings';
import { normalizePageUrl } from '../../shared/url';
import type { PortableSiteBundle } from '../portable-data';
import { tx } from './connection';
import { getPages } from './pages';
import { getProgressForSite } from './progress';

// 导入便携数据时替换站点索引和站点配置；只有导入包包含 progress 字段时才替换阅读进度。
export async function replacePortableSiteData(bundle: PortableSiteBundle): Promise<void> {
  const [existingPages, existingProgress] = await Promise.all([
    getPages(bundle.site.siteId),
    bundle.progress ? getProgressForSite(bundle.site.siteId) : Promise.resolve([]),
  ]);
  const pagesToStore = bundle.pages.map((page) => ({
    ...page,
    url: normalizePageUrl(page.url),
  }));
  const progressToStore = bundle.progress?.map((record) => ({
    ...record,
    url: normalizePageUrl(record.url),
  }));

  await tx(['sites', 'pages', 'progress', 'siteSettings'], 'readwrite', async ({ sites, pages, progress, siteSettings }) => {
    sites.put(bundle.site);
    siteSettings.put({
      siteId: bundle.site.siteId,
      ...normalizeSiteSettings(bundle.siteSettings),
    });
    existingPages.forEach((page) => pages.delete([bundle.site.siteId, page.url]));
    pagesToStore.forEach((page) => pages.put(page));

    if (progressToStore) {
      existingProgress.forEach((record) => progress.delete([bundle.site.siteId, record.url]));
      progressToStore.forEach((record) => progress.put(record));
    }
  });
}
