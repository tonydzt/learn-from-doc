import { mergeRanges, viewedHeight, type ViewedRange } from '../../progress/ranges';
import { normalizePageUrl } from '../../shared/url';
import { indexAll, tx } from './connection';
import { getAllSites } from './sites';
import type { ProgressRecord } from './types';

// 读取某个文档范围下的全部阅读进度记录。
export async function getProgressForSite(siteId: string): Promise<ProgressRecord[]> {
  return tx(['progress'], 'readonly', ({ progress }) => indexAll<ProgressRecord>(progress, 'bySite', siteId));
}

// 保存单页阅读进度；调用方传入已浏览区间，这里负责合并区间并计算已浏览高度。
export async function saveProgress(siteId: string, url: string, ranges: ViewedRange[], contentHeight: number): Promise<ProgressRecord> {
  // progress 存的是“已看过的正文高度区间”，不是滚动次数或最后位置；
  // 用户反向滚动、重复看同一段，都不会重复计数。
  const record: ProgressRecord = {
    siteId,
    url: normalizePageUrl(url),
    viewedRanges: mergeRanges(ranges),
    viewedHeight: viewedHeight(ranges, contentHeight),
    updatedAt: Date.now(),
  };

  await tx(['progress'], 'readwrite', async ({ progress }) => {
    progress.put(record);
  });
  return record;
}

// 删除单个页面的阅读进度记录，保留页面索引本身。
export async function deletePageProgress(siteId: string, url: string): Promise<void> {
  // pages/progress 共用 [siteId, url] 复合主键，删除时也必须使用相同顺序的数组键。
  const normalizedUrl = normalizePageUrl(url);
  await tx(['progress'], 'readwrite', async ({ progress }) => {
    progress.delete([siteId, normalizedUrl]);
  });
}

// 只清空某个文档范围的阅读进度，保留已创建的页面索引。
export async function clearSiteProgress(siteId: string): Promise<void> {
  const progress = await getProgressForSite(siteId);
  await tx(['progress'], 'readwrite', async ({ progress: progressStore }) => {
    progress.forEach((record) => progressStore.delete([siteId, record.url]));
  });
}

// 清空所有文档范围的阅读进度，保留所有站点和页面索引。
export async function clearAllProgress(): Promise<void> {
  const sites = await getAllSites();
  const progressBySite = await Promise.all(sites.map((site) => getProgressForSite(site.siteId)));
  await tx(['progress'], 'readwrite', async ({ progress }) => {
    progressBySite.flat().forEach((record) => progress.delete([record.siteId, record.url]));
  });
}
