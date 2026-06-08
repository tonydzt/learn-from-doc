import type { SiteSettings } from '../../settings/site-settings';
import { getSiteSettings, saveSiteSettings } from '../../storage/db';
import { getAppSettings, saveAppSettings } from '../../storage/settings';
import { notifySiteSettingsUpdated } from './tabs';

export { getAppSettings, getSiteSettings };

/**
 * 读取应用级配置中的 `debugIndexingLogs` 开关。
 * 用于控制后台索引流程是否输出调试日志。
 */
export async function isDebugIndexingLogsEnabled(): Promise<boolean> {
  return (await getAppSettings()).debugIndexingLogs;
}

/**
 * 后台层对应用配置保存方法的轻量封装。
 * 复用底层 `saveAppSettings` 的参数类型，确保调用方与存储层类型一致。
 */
export function saveAppSettingsForBackground(settings: Parameters<typeof saveAppSettings>[0]) {
  return saveAppSettings(settings);
}

/**
 * 保存站点配置，并在保存后通知相关标签页刷新站点配置状态。
 */
export async function saveSiteSettingsForBackground(siteId: string, settings: Partial<SiteSettings>) {
  // 先持久化站点配置，拿到最终保存后的配置对象。
  const saved = await saveSiteSettings(siteId, settings);
  // 再广播配置变更，确保页面侧拿到最新配置。
  await notifySiteSettingsUpdated(siteId, saved);
  return saved;
}
