import { normalizeSiteSettings, type SiteSettings } from '../../settings/site-settings';
import { requestToPromise, tx } from './connection';
import type { SiteSettingsRecord } from './types';

// 读取某个文档范围的站点级配置。没有记录时返回默认配置，保持旧版本行为不变。
export async function getSiteSettings(siteId: string): Promise<SiteSettingsRecord> {
  return tx(['siteSettings'], 'readonly', async ({ siteSettings }) => {
    const stored = await requestToPromise<SiteSettingsRecord | undefined>(siteSettings.get(siteId));
    return {
      siteId,
      ...normalizeSiteSettings(stored),
    };
  });
}

// 保存站点级配置。调用方可以只传要修改的字段。
export async function saveSiteSettings(siteId: string, settings: Partial<SiteSettings>): Promise<SiteSettingsRecord> {
  const current = await getSiteSettings(siteId);
  const next: SiteSettingsRecord = {
    siteId,
    ...normalizeSiteSettings({ ...current, ...settings }),
  };
  await tx(['siteSettings'], 'readwrite', async ({ siteSettings }) => {
    siteSettings.put(next);
  });
  return next;
}
