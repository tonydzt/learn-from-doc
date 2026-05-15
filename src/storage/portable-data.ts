import type { AppSettings } from '../settings/app-settings';
import { normalizeAppSettings } from '../settings/app-settings';
import { normalizeSiteSettings } from '../settings/site-settings';
import type { PageIndexRecord, ProgressRecord, SiteRecord, SiteSettingsRecord } from './db';

export const PORTABLE_DATA_SCHEMA_VERSION = 1;

export type PortableDataScope = 'all' | 'site';

export type PortableSiteBundle = {
  site: SiteRecord;
  pages: PageIndexRecord[];
  siteSettings: SiteSettingsRecord;
  progress?: ProgressRecord[];
};

export type PortableData = {
  schemaVersion: typeof PORTABLE_DATA_SCHEMA_VERSION;
  exportedAt: number;
  scope: PortableDataScope;
  includeProgress: boolean;
  appSettings?: AppSettings;
  sites: PortableSiteBundle[];
};

export type PortableSerializedData = {
  data: string;
  encoding: 'text' | 'base64';
  mimeType: string;
  fileExtension: '.lfd.json' | '.lfd.json.gz';
  compressed: boolean;
};

export type PortableImportPreview = {
  schemaVersion: number;
  siteCount: number;
  includeProgress: boolean;
  appSettingsIncluded: boolean;
  conflicts: string[];
  sites: Array<{
    siteId: string;
    scopeTitle: string;
    host: string;
    pageCount: number;
    progressCount: number;
  }>;
};

export type PortableImportResult = {
  imported: PortableSiteBundle[];
  skipped: string[];
  appSettings?: AppSettings;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSiteRecord(value: unknown): value is SiteRecord {
  return isRecord(value)
    && typeof value.siteId === 'string'
    && typeof value.host === 'string'
    && typeof value.scopeKey === 'string'
    && typeof value.scopeTitle === 'string'
    && typeof value.createdAt === 'number'
    && typeof value.updatedAt === 'number';
}

function isPageRecord(value: unknown): value is PageIndexRecord {
  return isRecord(value)
    && typeof value.siteId === 'string'
    && typeof value.url === 'string'
    && typeof value.title === 'string'
    && typeof value.order === 'number'
    && typeof value.contentHeight === 'number';
}

function isProgressRecord(value: unknown): value is ProgressRecord {
  return isRecord(value)
    && typeof value.siteId === 'string'
    && typeof value.url === 'string'
    && Array.isArray(value.viewedRanges)
    && typeof value.viewedHeight === 'number'
    && typeof value.updatedAt === 'number';
}

function normalizePortableSiteBundle(value: unknown): PortableSiteBundle | null {
  if (!isRecord(value) || !isSiteRecord(value.site) || !Array.isArray(value.pages)) return null;
  if (!value.pages.every(isPageRecord)) return null;

  const siteId = value.site.siteId;
  const progress = Array.isArray(value.progress) && value.progress.every(isProgressRecord)
    ? value.progress
    : undefined;

  return {
    site: value.site,
    pages: value.pages,
    siteSettings: {
      siteId,
      ...normalizeSiteSettings(value.siteSettings),
    },
    ...(progress ? { progress } : {}),
  };
}

function normalizePortableData(value: unknown): PortableData {
  if (!isRecord(value)) throw new Error('Invalid portable data file.');
  if (value.schemaVersion !== PORTABLE_DATA_SCHEMA_VERSION) {
    throw new Error('Unsupported portable data schema version.');
  }
  if (value.scope !== 'all' && value.scope !== 'site') throw new Error('Invalid portable data scope.');
  if (typeof value.exportedAt !== 'number') throw new Error('Invalid portable data export timestamp.');
  if (typeof value.includeProgress !== 'boolean') throw new Error('Invalid portable data progress flag.');
  if (!Array.isArray(value.sites)) throw new Error('Invalid portable data sites.');

  const sites = value.sites.map(normalizePortableSiteBundle).filter((site): site is PortableSiteBundle => site !== null);
  if (sites.length === 0 && value.sites.length > 0) throw new Error('Portable data does not contain any valid sites.');

  return {
    schemaVersion: PORTABLE_DATA_SCHEMA_VERSION,
    exportedAt: value.exportedAt,
    scope: value.scope,
    includeProgress: value.includeProgress,
    ...(value.appSettings ? { appSettings: normalizeAppSettings(value.appSettings) } : {}),
    sites: sites.map((site) => ({
      ...site,
      ...(value.includeProgress && site.progress ? { progress: site.progress } : {}),
      ...(!value.includeProgress ? { progress: undefined } : {}),
    })),
  };
}

function compressionStreamSupported(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof Blob !== 'undefined' && typeof Blob.prototype.stream === 'function';
}

function decompressionStreamSupported(): boolean {
  return typeof DecompressionStream !== 'undefined' && typeof Blob !== 'undefined' && typeof Blob.prototype.stream === 'function';
}

async function gzipText(text: string): Promise<ArrayBuffer> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

async function gunzipBytes(data: ArrayBuffer): Promise<string> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

function decodeText(data: ArrayBuffer): string {
  return new TextDecoder().decode(data);
}

function arrayBufferToBase64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function buildPortableData(input: {
  scope: PortableDataScope;
  includeProgress: boolean;
  exportedAt: number;
  appSettings?: AppSettings;
  sites: PortableSiteBundle[];
}): PortableData {
  return {
    schemaVersion: PORTABLE_DATA_SCHEMA_VERSION,
    exportedAt: input.exportedAt,
    scope: input.scope,
    includeProgress: input.includeProgress,
    ...(input.appSettings ? { appSettings: normalizeAppSettings(input.appSettings) } : {}),
    sites: input.sites.map((site) => ({
      site: site.site,
      pages: site.pages,
      siteSettings: {
        siteId: site.site.siteId,
        ...normalizeSiteSettings(site.siteSettings),
      },
      ...(input.includeProgress ? { progress: site.progress ?? [] } : {}),
    })),
  };
}

export async function serializePortableData(payload: PortableData): Promise<PortableSerializedData> {
  const json = JSON.stringify(payload);
  if (!compressionStreamSupported()) {
    return {
      data: json,
      encoding: 'text',
      mimeType: 'application/json',
      fileExtension: '.lfd.json',
      compressed: false,
    };
  }

  return {
    data: arrayBufferToBase64(await gzipText(json)),
    encoding: 'base64',
    mimeType: 'application/gzip',
    fileExtension: '.lfd.json.gz',
    compressed: true,
  };
}

function timestampSlug(value: number): string {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function fileSafeSlug(value: string): string {
  return value.replace(/[^a-zA-Z0-9.-]+/g, '-').replace(/^-+|-+$/g, '') || 'site';
}

export function portableFileName(input: {
  scope: PortableDataScope;
  exportedAt: number;
  fileExtension: PortableSerializedData['fileExtension'];
  site?: SiteRecord;
}): string {
  const target = input.scope === 'all'
    ? 'all'
    : `${fileSafeSlug(input.site?.host ?? 'site')}-${fileSafeSlug(input.site?.scopeKey ?? 'index')}`;
  return `developer-docs-progress-tracker-${target}-${timestampSlug(input.exportedAt)}${input.fileExtension}`;
}

export function portableSerializedBlobPart(serialized: PortableSerializedData): string | ArrayBuffer {
  if (serialized.encoding === 'text') return serialized.data;
  const bytes = base64ToBytes(serialized.data);
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

export async function parsePortableData(data: string | ArrayBuffer): Promise<PortableData> {
  const text = typeof data === 'string'
    ? data
    : decompressionStreamSupported()
      ? await gunzipBytes(data).catch(() => decodeText(data))
      : decodeText(data);
  if (text.trim() === '[object Object]') {
    throw new Error('This export file was written by a broken build and cannot be imported. Please export a new backup with the latest version.');
  }
  try {
    return normalizePortableData(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Invalid portable data JSON.');
    throw error;
  }
}

export function portableImportPreview(payload: PortableData, existingSiteIds: Set<string>): PortableImportPreview {
  return {
    schemaVersion: payload.schemaVersion,
    siteCount: payload.sites.length,
    includeProgress: payload.includeProgress,
    appSettingsIncluded: Boolean(payload.appSettings),
    conflicts: payload.sites.map((site) => site.site.siteId).filter((siteId) => existingSiteIds.has(siteId)),
    sites: payload.sites.map((site) => ({
      siteId: site.site.siteId,
      scopeTitle: site.site.scopeTitle,
      host: site.site.host,
      pageCount: site.pages.length,
      progressCount: payload.includeProgress ? site.progress?.length ?? 0 : 0,
    })),
  };
}

export function importPortableData(payload: PortableData, options: {
  existingSiteIds: Set<string>;
  overwriteSiteIds: Set<string>;
}): PortableImportResult {
  const imported: PortableSiteBundle[] = [];
  const skipped: string[] = [];

  for (const site of payload.sites) {
    const siteId = site.site.siteId;
    if (options.existingSiteIds.has(siteId) && !options.overwriteSiteIds.has(siteId)) {
      skipped.push(siteId);
      continue;
    }
    imported.push({
      ...site,
      ...(payload.includeProgress ? { progress: site.progress ?? [] } : {}),
      ...(!payload.includeProgress ? { progress: undefined } : {}),
    });
  }

  return {
    imported,
    skipped,
    ...(payload.appSettings ? { appSettings: payload.appSettings } : {}),
  };
}
