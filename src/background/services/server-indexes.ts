import {
  getAllSites,
  getPages,
  getProgressForSite,
  getSite,
  getSiteSettings,
  replacePortableSiteData,
  type SiteSettingsRecord,
} from '../../storage/db';
import {
  buildPortableData,
  PORTABLE_DATA_SCHEMA_VERSION,
  type PortableData,
  type PortableSiteBundle,
} from '../../storage/portable-data';
import { API_ORIGIN } from './api';
import { requireAccountAuth } from './account-auth';
import { notifyIndexUpdated } from './tabs';

export type ServerIndexAvailability = {
  available: boolean;
  kinds: string[];
  pageCount?: number;
  updatedAt?: string | number;
  site?: {
    siteId?: string;
    host?: string;
    scopeKey?: string;
    scopeTitle?: string;
    pageCount?: number;
    updatedAt?: string | number;
  };
};

export type PullServerIndexResult = {
  importedCount: number;
  serverUpdatedAt: number | null;
};

export type UploadServerIndexResult = {
  ok: true;
  serverUpdatedAt: number;
  siteCount: number;
};

type PullServerIndexResponse = {
  ok?: unknown;
  serverUpdatedAt?: unknown;
  payload?: unknown;
};

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function errorMessageFromPayload(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const error = (payload as { error?: unknown; message?: unknown }).error ?? (payload as { message?: unknown }).message;
  return typeof error === 'string' && error.length > 0 ? error : fallback;
}

function portableDataFromPayload(value: unknown): PortableData | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as PortableData;
  if (payload.schemaVersion !== PORTABLE_DATA_SCHEMA_VERSION) return null;
  if (!Array.isArray(payload.sites)) return null;
  return payload;
}

async function portableSiteBundle(siteId: string): Promise<PortableSiteBundle> {
  const site = await getSite(siteId);
  if (!site) throw new Error('No local index selected for upload.');
  const [pages, progress, siteSettings] = await Promise.all([
    getPages(siteId),
    getProgressForSite(siteId),
    getSiteSettings(siteId) as Promise<SiteSettingsRecord>,
  ]);
  return { site, pages, siteSettings, progress };
}

export async function getServerIndexAvailability(siteId: string): Promise<ServerIndexAvailability> {
  const { headers } = await requireAccountAuth('canPullServerData');
  const response = await fetch(`${API_ORIGIN}/api/indexes/availability?siteId=${encodeURIComponent(siteId)}`, {
    method: 'GET',
    headers,
  });
  const payload = await readJson(response);
  if (!response.ok) throw new Error(errorMessageFromPayload(payload, 'Could not check server index.'));
  if (!payload || typeof payload !== 'object') return { available: false, kinds: [] };
  const partial = payload as ServerIndexAvailability;
  return {
    available: partial.available === true,
    kinds: Array.isArray(partial.kinds) ? partial.kinds.filter((kind): kind is string => typeof kind === 'string') : [],
    ...(typeof partial.pageCount === 'number' ? { pageCount: partial.pageCount } : {}),
    ...(typeof partial.updatedAt === 'string' || typeof partial.updatedAt === 'number' ? { updatedAt: partial.updatedAt } : {}),
    ...(partial.site && typeof partial.site === 'object' ? { site: partial.site } : {}),
  };
}

async function pullServerIndexFromEndpoint(
  endpoint: 'pull' | 'review-pull',
  siteId: string,
  overwrite: boolean,
  headers: { Authorization: string },
): Promise<PullServerIndexResult> {
  const existing = (await getAllSites()).some((site) => site.siteId === siteId);
  if (existing && !overwrite) throw new Error('Local index already exists.');

  const response = await fetch(`${API_ORIGIN}/api/indexes/${endpoint}?siteId=${encodeURIComponent(siteId)}`, {
    method: 'GET',
    headers,
  });
  const payload = await readJson(response) as PullServerIndexResponse;
  if (!response.ok) throw new Error(errorMessageFromPayload(payload, 'Could not pull server index.'));

  const portable = portableDataFromPayload(payload.payload);
  if (!portable) return { importedCount: 0, serverUpdatedAt: null };
  const bundle = portable.sites.find((site) => site.site.siteId === siteId);
  if (!bundle) return { importedCount: 0, serverUpdatedAt: typeof payload.serverUpdatedAt === 'number' ? payload.serverUpdatedAt : null };

  await replacePortableSiteData(bundle);
  await notifyIndexUpdated(siteId);
  return {
    importedCount: 1,
    serverUpdatedAt: typeof payload.serverUpdatedAt === 'number' ? payload.serverUpdatedAt : null,
  };
}

export async function pullServerIndex(siteId: string, overwrite: boolean): Promise<PullServerIndexResult> {
  const { headers } = await requireAccountAuth('canPullServerData');
  return pullServerIndexFromEndpoint('pull', siteId, overwrite, headers);
}

export async function pullReviewServerIndex(siteId: string, overwrite: boolean): Promise<PullServerIndexResult> {
  const { headers } = await requireAccountAuth(['canPullServerData', 'canTestSystemIndexes']);
  return pullServerIndexFromEndpoint('review-pull', siteId, overwrite, headers);
}

export async function uploadServerIndex(siteId: string): Promise<UploadServerIndexResult> {
  const { headers } = await requireAccountAuth('canSync');
  const now = Date.now();
  const payload = buildPortableData({
    scope: 'site',
    includeProgress: true,
    exportedAt: now,
    sites: [await portableSiteBundle(siteId)],
  });

  const response = await fetch(`${API_ORIGIN}/api/indexes/upload`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      schemaVersion: PORTABLE_DATA_SCHEMA_VERSION,
      clientUpdatedAt: now,
      payload,
    }),
  });
  const result = await readJson(response);
  if (!response.ok) throw new Error(errorMessageFromPayload(result, 'Could not upload server index.'));
  if (!result || typeof result !== 'object') throw new Error('Upload response is invalid.');
  const partial = result as Partial<UploadServerIndexResult>;
  return {
    ok: true,
    serverUpdatedAt: typeof partial.serverUpdatedAt === 'number' ? partial.serverUpdatedAt : Date.now(),
    siteCount: typeof partial.siteCount === 'number' ? partial.siteCount : payload.sites.length,
  };
}
