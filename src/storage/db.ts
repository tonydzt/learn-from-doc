import { mergeRanges, viewedHeight, type ViewedRange } from '../progress/ranges';

const DB_NAME = 'learn-from-doc';
const DB_VERSION = 1;

export type SiteRecord = {
  siteId: string;
  host: string;
  scopeKey: string;
  scopeTitle: string;
  createdAt: number;
  updatedAt: number;
};

export type PageIndexRecord = {
  siteId: string;
  url: string;
  title: string;
  order: number;
  contentHeight: number;
};

export type ProgressRecord = {
  siteId: string;
  url: string;
  viewedRanges: ViewedRange[];
  viewedHeight: number;
  updatedAt: number;
};

type StoreName = 'sites' | 'pages' | 'progress';

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('sites')) {
        db.createObjectStore('sites', { keyPath: 'siteId' });
      }
      if (!db.objectStoreNames.contains('pages')) {
        const pages = db.createObjectStore('pages', { keyPath: ['siteId', 'url'] });
        pages.createIndex('bySite', 'siteId');
      }
      if (!db.objectStoreNames.contains('progress')) {
        const progress = db.createObjectStore('progress', { keyPath: ['siteId', 'url'] });
        progress.createIndex('bySite', 'siteId');
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

  return dbPromise;
}

function tx<T>(stores: StoreName[], mode: IDBTransactionMode, run: (stores: Record<StoreName, IDBObjectStore>) => Promise<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(stores, mode);
    const storeMap = Object.fromEntries(stores.map((name) => [name, transaction.objectStore(name)])) as Record<StoreName, IDBObjectStore>;
    let result: T;

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve(result);

    run(storeMap)
      .then((value) => {
        result = value;
      })
      .catch((error) => {
        transaction.abort();
        reject(error);
      });
  }));
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function indexAll<T>(store: IDBObjectStore, indexName: string, value: IDBValidKey): Promise<T[]> {
  return requestToPromise<T[]>(store.index(indexName).getAll(value));
}

export async function getSite(siteId: string): Promise<SiteRecord | undefined> {
  return tx(['sites'], 'readonly', ({ sites }) => requestToPromise<SiteRecord | undefined>(sites.get(siteId)));
}

export async function getAllSites(): Promise<SiteRecord[]> {
  return tx(['sites'], 'readonly', ({ sites }) => requestToPromise<SiteRecord[]>(sites.getAll()));
}

export async function putSite(site: SiteRecord): Promise<void> {
  await tx(['sites'], 'readwrite', async ({ sites }) => {
    sites.put(site);
  });
}

export async function replaceSitePages(site: SiteRecord, pages: PageIndexRecord[]): Promise<void> {
  const existing = await getPages(site.siteId);
  await tx(['sites', 'pages'], 'readwrite', async ({ sites, pages: pageStore }) => {
    sites.put(site);
    existing.forEach((page) => pageStore.delete([site.siteId, page.url]));
    pages.forEach((page) => pageStore.put(page));
  });
}

export async function getPages(siteId: string): Promise<PageIndexRecord[]> {
  const pages = await tx(['pages'], 'readonly', ({ pages }) => indexAll<PageIndexRecord>(pages, 'bySite', siteId));
  return pages.sort((a, b) => a.order - b.order);
}

export async function getPage(siteId: string, url: string): Promise<PageIndexRecord | undefined> {
  return tx(['pages'], 'readonly', ({ pages }) => requestToPromise<PageIndexRecord | undefined>(pages.get([siteId, url])));
}

export async function getProgressForSite(siteId: string): Promise<ProgressRecord[]> {
  return tx(['progress'], 'readonly', ({ progress }) => indexAll<ProgressRecord>(progress, 'bySite', siteId));
}

export async function getProgress(siteId: string, url: string): Promise<ProgressRecord | undefined> {
  return tx(['progress'], 'readonly', ({ progress }) => requestToPromise<ProgressRecord | undefined>(progress.get([siteId, url])));
}

export async function saveProgress(siteId: string, url: string, ranges: ViewedRange[], contentHeight: number): Promise<ProgressRecord> {
  const record: ProgressRecord = {
    siteId,
    url,
    viewedRanges: mergeRanges(ranges),
    viewedHeight: viewedHeight(ranges, contentHeight),
    updatedAt: Date.now(),
  };

  await tx(['progress'], 'readwrite', async ({ progress }) => {
    progress.put(record);
  });
  return record;
}

export async function deleteSiteIndex(siteId: string): Promise<void> {
  const [pages, progress] = await Promise.all([
    getPages(siteId),
    getProgressForSite(siteId),
  ]);

  await tx(['sites', 'pages', 'progress'], 'readwrite', async ({ sites, pages: pageStore, progress: progressStore }) => {
    sites.delete(siteId);
    pages.forEach((page) => pageStore.delete([siteId, page.url]));
    progress.forEach((record) => progressStore.delete([siteId, record.url]));
  });
}

export async function clearSiteProgress(siteId: string): Promise<void> {
  const progress = await getProgressForSite(siteId);
  await tx(['progress'], 'readwrite', async ({ progress: progressStore }) => {
    progress.forEach((record) => progressStore.delete([siteId, record.url]));
  });
}

export async function clearAllProgress(): Promise<void> {
  const sites = await getAllSites();
  const progressBySite = await Promise.all(sites.map((site) => getProgressForSite(site.siteId)));
  await tx(['progress'], 'readwrite', async ({ progress }) => {
    progressBySite.flat().forEach((record) => progress.delete([record.siteId, record.url]));
  });
}
