import { normalizePageSettings, type PageSettings } from '../../settings/page-settings';
import { normalizePageUrl } from '../../shared/url';
import { requestToPromise, tx } from './connection';
import type { PageSettingsRecord } from './types';

export async function getPageSettings(siteId: string, url: string): Promise<PageSettingsRecord> {
  const normalizedUrl = normalizePageUrl(url);
  return tx(['pageSettings'], 'readonly', async ({ pageSettings }) => {
    const stored = await requestToPromise<PageSettingsRecord | undefined>(pageSettings.get([siteId, normalizedUrl]));
    return {
      siteId,
      url: normalizedUrl,
      ...normalizePageSettings(stored),
    };
  });
}

export async function savePageSettings(siteId: string, url: string, settings: Partial<PageSettings>): Promise<PageSettingsRecord> {
  const current = await getPageSettings(siteId, url);
  const next: PageSettingsRecord = {
    siteId,
    url: current.url,
    ...normalizePageSettings({ ...current, ...settings }),
  };
  await tx(['pageSettings'], 'readwrite', async ({ pageSettings }) => {
    pageSettings.put(next);
  });
  return next;
}
