import { indexedScopeForUrl } from '../../indexing/indexed-scope';
import { totalProgressPercent } from '../../progress/calculations';
import type { IndexOverview, SiteSnapshot } from '../../shared/messages';
import {
  clearAllProgress,
  clearSiteProgress,
  deletePageProgress,
  deleteSiteIndex,
  getAllSites,
  getPage,
  getPageSettings,
  getPages,
  getProgressForSite,
  getSite,
  savePageSettings,
  saveProgress,
} from '../../storage/db';

export { getPage, getPageSettings, getPages, getProgressForSite, savePageSettings, saveProgress };

export async function clearSiteProgressForBackground(siteId: string): Promise<void> {
  await clearSiteProgress(siteId);
}

export async function clearAllProgressForBackground(): Promise<void> {
  await clearAllProgress();
}

export async function deleteSiteIndexForBackground(siteId: string): Promise<void> {
  await deleteSiteIndex(siteId);
}

export async function deletePageProgressForBackground(siteId: string, url: string): Promise<void> {
  await deletePageProgress(siteId, url);
}

/** 基于已保存站点规则，计算 URL 当前命中的索引范围（整站/路径等）。 */
export async function getIndexedScopeForUrl(url: string) {
  return indexedScopeForUrl(url, await getAllSites());
}

/**
 * 汇总所有站点的索引概览数据：
 * - 页面总数与总内容高度
 * - 已浏览高度（按页面高度上限裁剪）
 * - 总进度百分比
 */
export async function getIndexOverviews(): Promise<IndexOverview[]> {
  const sites = await getAllSites();
  const overviews = await Promise.all(sites.map(async (site) => {
    const [pages, progress] = await Promise.all([
      getPages(site.siteId),
      getProgressForSite(site.siteId),
    ]);
    // 先按 URL 建索引，后续在累计浏览高度时做 O(1) 查找与边界裁剪。
    const contentHeightByUrl = new Map(pages.map((page) => [page.url, Math.max(0, page.contentHeight)]));
    return {
      site,
      pageCount: pages.length,
      totalContentHeight: pages.reduce((sum, page) => sum + page.contentHeight, 0),
      totalViewedHeight: progress.reduce((sum, record) => {
        const contentHeight = contentHeightByUrl.get(record.url);
        // 进度记录可能对应不到页面（页面被删/URL变化），这类记录不计入汇总。
        if (contentHeight == null) return sum;
        // viewedHeight 只统计到 [0, contentHeight]，避免异常值污染总量。
        return sum + Math.min(Math.max(0, record.viewedHeight), contentHeight);
      }, 0),
      totalPercent: totalProgressPercent(pages, progress),
      updatedAt: site.updatedAt,
    };
  }));
  // 按最近更新时间倒序，确保列表优先展示最新变更的站点。
  return overviews.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 拉取单站点快照（站点信息 + 页面列表 + 进度记录）；不存在时返回 undefined。 */
export async function getSiteSnapshot(siteId: string): Promise<SiteSnapshot | undefined> {
  const site = await getSite(siteId);
  if (!site) return undefined;
  const [pages, progress] = await Promise.all([
    getPages(siteId),
    getProgressForSite(siteId),
  ]);
  return { site, pages, progress };
}
