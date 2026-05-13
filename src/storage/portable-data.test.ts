import { DEFAULT_APP_SETTINGS, type AppSettings } from '../settings/app-settings';
import type { PageIndexRecord, ProgressRecord, SiteRecord, SiteSettingsRecord } from './db';
import {
  buildPortableData,
  importPortableData,
  parsePortableData,
  portableSerializedBlobPart,
  portableFileName,
  portableImportPreview,
  serializePortableData,
  type PortableSiteBundle,
} from './portable-data';

const appSettings: AppSettings = {
  ...DEFAULT_APP_SETTINGS,
  language: 'zh-CN',
};

const reactSite: SiteRecord = {
  siteId: 'react.dev::learn',
  host: 'react.dev',
  scopeKey: 'learn',
  scopeTitle: 'Learn React',
  createdAt: 1000,
  updatedAt: 2000,
};

const playwrightSite: SiteRecord = {
  siteId: 'playwright.dev::docs',
  host: 'playwright.dev',
  scopeKey: 'docs',
  scopeTitle: 'Playwright Docs',
  createdAt: 3000,
  updatedAt: 4000,
};

function page(site: SiteRecord, order: number): PageIndexRecord {
  return {
    siteId: site.siteId,
    url: `https://${site.host}/${site.scopeKey}/${order}`,
    title: `${site.scopeTitle} ${order}`,
    order,
    contentHeight: 1000 + order,
  };
}

function progress(site: SiteRecord, order: number): ProgressRecord {
  return {
    siteId: site.siteId,
    url: `https://${site.host}/${site.scopeKey}/${order}`,
    viewedRanges: [{ start: 0, end: 100 }],
    viewedHeight: 100,
    updatedAt: 5000 + order,
  };
}

function settings(site: SiteRecord, readingProgressEnabled = true): SiteSettingsRecord {
  return {
    siteId: site.siteId,
    readingProgressEnabled,
  };
}

function bundle(site: SiteRecord, readingProgressEnabled = true): PortableSiteBundle {
  return {
    site,
    pages: [page(site, 0), page(site, 1)],
    siteSettings: settings(site, readingProgressEnabled),
    progress: [progress(site, 0)],
  };
}

describe('portable data', () => {
  it('builds a full export with all sites, app settings, site settings, and progress', () => {
    const payload = buildPortableData({
      scope: 'all',
      includeProgress: true,
      exportedAt: 9000,
      appSettings,
      sites: [bundle(reactSite, false), bundle(playwrightSite)],
    });

    expect(payload).toMatchObject({
      schemaVersion: 1,
      exportedAt: 9000,
      scope: 'all',
      includeProgress: true,
      appSettings,
    });
    expect(payload.sites.map((item) => item.site.siteId)).toEqual(['react.dev::learn', 'playwright.dev::docs']);
    expect(payload.sites[0].siteSettings).toEqual(settings(reactSite, false));
    expect(payload.sites[0].progress).toEqual([progress(reactSite, 0)]);
  });

  it('builds a site export without progress rows when progress is excluded', () => {
    const payload = buildPortableData({
      scope: 'site',
      includeProgress: false,
      exportedAt: 9000,
      appSettings,
      sites: [bundle(reactSite), bundle(playwrightSite)],
    });

    expect(payload.scope).toBe('site');
    expect(payload.sites).toHaveLength(2);
    expect(payload.sites[0].progress).toBeUndefined();
  });

  it('previews import conflicts against existing site ids', () => {
    const preview = portableImportPreview(
      buildPortableData({
        scope: 'all',
        includeProgress: false,
        exportedAt: 9000,
        appSettings,
        sites: [bundle(reactSite), bundle(playwrightSite)],
      }),
      new Set(['react.dev::learn']),
    );

    expect(preview).toEqual({
      schemaVersion: 1,
      siteCount: 2,
      includeProgress: false,
      appSettingsIncluded: true,
      conflicts: ['react.dev::learn'],
      sites: [
        { siteId: 'react.dev::learn', scopeTitle: 'Learn React', host: 'react.dev', pageCount: 2, progressCount: 0 },
        { siteId: 'playwright.dev::docs', scopeTitle: 'Playwright Docs', host: 'playwright.dev', pageCount: 2, progressCount: 0 },
      ],
    });
  });

  it('imports new sites and skips conflicts unless overwrite is allowed', () => {
    const payload = buildPortableData({
      scope: 'all',
      includeProgress: true,
      exportedAt: 9000,
      appSettings,
      sites: [bundle(reactSite), bundle(playwrightSite)],
    });

    const result = importPortableData(payload, {
      existingSiteIds: new Set(['react.dev::learn']),
      overwriteSiteIds: new Set(['react.dev::learn']),
    });

    expect(result.imported.map((item) => item.site.siteId)).toEqual(['react.dev::learn', 'playwright.dev::docs']);
    expect(result.skipped).toEqual([]);
    expect(result.appSettings).toEqual(appSettings);
  });

  it('keeps imported progress undefined when the export excludes progress', () => {
    const payload = buildPortableData({
      scope: 'all',
      includeProgress: false,
      exportedAt: 9000,
      appSettings,
      sites: [bundle(reactSite)],
    });

    const result = importPortableData(payload, {
      existingSiteIds: new Set(),
      overwriteSiteIds: new Set(),
    });

    expect(result.imported[0].progress).toBeUndefined();
  });

  it('rejects unsupported schemas while parsing serialized data', async () => {
    await expect(parsePortableData('{"schemaVersion":999,"sites":[]}')).rejects.toThrow('Unsupported portable data schema version.');
  });

  it('reports broken object-string exports clearly', async () => {
    await expect(parsePortableData('[object Object]')).rejects.toThrow('This export file was written by a broken build and cannot be imported.');
  });

  it('reports invalid JSON clearly', async () => {
    await expect(parsePortableData('not json')).rejects.toThrow('Invalid portable data JSON.');
  });

  it('round-trips serialized portable data', async () => {
    const payload = buildPortableData({
      scope: 'site',
      includeProgress: true,
      exportedAt: 9000,
      appSettings,
      sites: [bundle(reactSite)],
    });

    const serialized = await serializePortableData(payload);

    expect(serialized.fileExtension).toMatch(/\.lfd\.json(\.gz)?$/);
    expect(typeof serialized.data).toBe('string');
    await expect(parsePortableData(serialized.data)).resolves.toEqual(payload);
  });

  it('converts serialized data to a Blob-safe part', async () => {
    const payload = buildPortableData({
      scope: 'site',
      includeProgress: false,
      exportedAt: 9000,
      appSettings,
      sites: [bundle(reactSite)],
    });
    const serialized = await serializePortableData(payload);

    const part = portableSerializedBlobPart(serialized);

    expect(typeof part === 'string' || part instanceof ArrayBuffer).toBe(true);
  });

  it('builds portable file names for full and site exports', () => {
    expect(portableFileName({ scope: 'all', exportedAt: 1715688240000, fileExtension: '.lfd.json.gz' })).toBe('learn-from-doc-all-20240514-2004.lfd.json.gz');
    expect(portableFileName({ scope: 'site', site: reactSite, exportedAt: 1715688240000, fileExtension: '.lfd.json' })).toBe('learn-from-doc-react.dev-learn-20240514-2004.lfd.json');
  });
});
