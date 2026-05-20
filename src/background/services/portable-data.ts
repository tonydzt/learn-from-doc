import type {
  PortableExportResult,
  PortableImportPreviewResult,
  PortableImportResultMessage,
} from '../../shared/messages';
import {
  getAllSites,
  getPages,
  getProgressForSite,
  getSite,
  getSiteSettings,
  replacePortableSiteData,
  type SiteRecord,
  type SiteSettingsRecord,
} from '../../storage/db';
import {
  buildPortableData,
  importPortableData,
  portableFileName,
  portableImportPreview,
  serializePortableData,
  type PortableData,
  type PortableDataScope,
  type PortableSiteBundle,
} from '../../storage/portable-data';
import { getAppSettings, saveAppSettings } from '../../storage/settings';
import { notifyIndexUpdated } from './tabs';

/**
 * 组装单站点可移植数据包：
 * - 站点基础信息
 * - 页面索引
 * - 站点设置
 * - （可选）阅读进度
 */
async function getPortableSiteBundle(site: SiteRecord, includeProgress: boolean): Promise<PortableSiteBundle> {
  const [pages, progress, siteSettings] = await Promise.all([
    getPages(site.siteId),
    includeProgress ? getProgressForSite(site.siteId) : Promise.resolve([]),
    getSiteSettings(site.siteId) as Promise<SiteSettingsRecord>,
  ]);
  return {
    site,
    pages,
    siteSettings,
    ...(includeProgress ? { progress } : {}),
  };
}

/**
 * 导出可移植数据：
 * - `all`：导出全部站点，并携带应用设置
 * - `site`：导出指定站点（可选携带进度）
 */
export async function exportPortableData(scope: PortableDataScope, siteId: string | undefined, includeProgress: boolean): Promise<PortableExportResult> {
  const exportedAt = Date.now();
  // 根据 scope 选择导出范围；单站点模式下只取目标站点。
  const sites = scope === 'all'
    ? await getAllSites()
    : siteId
      ? [await getSite(siteId)].filter((site): site is SiteRecord => Boolean(site))
      : [];
  if (scope === 'site' && sites.length === 0) throw new Error('No site index selected for export.');

  const payload = buildPortableData({
    scope,
    includeProgress,
    exportedAt,
    ...(scope === 'all' ? { appSettings: await getAppSettings() } : {}),
    sites: await Promise.all(sites.map((site) => getPortableSiteBundle(site, includeProgress))),
  });
  const serialized = await serializePortableData(payload);
  return {
    ...serialized,
    fileName: portableFileName({
      scope,
      exportedAt,
      fileExtension: serialized.fileExtension,
      site: scope === 'site' ? sites[0] : undefined,
    }),
  };
}

/**
 * 预览导入结果（不落库）：
 * 对照当前已存在站点，计算可导入/冲突跳过等预览信息。
 */
export async function previewPortableImport(payload: PortableData): Promise<PortableImportPreviewResult> {
  // 先构建当前站点集合，用于冲突判定预览。
  const existing = new Set((await getAllSites()).map((site) => site.siteId));
  return {
    payload,
    preview: portableImportPreview(payload, existing),
  };
}

/**
 * 执行可移植数据导入：
 * - 按 overwriteSiteIds 处理冲突站点
 * - 写入导入站点数据
 * - 导入后通知页面侧刷新阅读追踪
 * - 若包含应用设置则同步写入
 */
export async function applyPortableImport(payload: PortableData, overwriteSiteIds: string[]): Promise<PortableImportResultMessage> {
  const existing = new Set((await getAllSites()).map((site) => site.siteId));
  const result = importPortableData(payload, {
    existingSiteIds: existing,
    overwriteSiteIds: new Set(overwriteSiteIds),
  });

  for (const site of result.imported) {
    // 落库时按站点逐个替换，避免与未导入站点互相影响。
    await replacePortableSiteData(site);
    // 场景：导入索引数据写入后，通知页面侧刷新阅读追踪状态。
    await notifyIndexUpdated(site.site.siteId);
  }
  if (result.appSettings) {
    await saveAppSettings(result.appSettings);
  }

  return {
    importedCount: result.imported.length,
    skipped: result.skipped,
  };
}
