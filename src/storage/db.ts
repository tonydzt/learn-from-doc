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

// 打开并缓存 IndexedDB 连接；首次打开时负责创建对象仓库和索引。
function openDb(): Promise<IDBDatabase> {
  // IndexedDB 类似浏览器内置的小型本地数据库。
  // onupgradeneeded 只在首次创建或 DB_VERSION 升级时执行，相当于迁移脚本。
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('sites')) {
        // sites 用 siteId 做主键，一条记录代表一个文档范围，例如 react.dev::learn。
        db.createObjectStore('sites', { keyPath: 'siteId' });
      }
      if (!db.objectStoreNames.contains('pages')) {
        // pages/progress 用 [siteId, url] 复合主键，表示“某站点范围下的某个页面”。
        // bySite 是二级索引，用来按 siteId 一次取出整个文档范围的所有页面。
        const pages = db.createObjectStore('pages', { keyPath: ['siteId', 'url'] });
        pages.createIndex('bySite', 'siteId');
      }
      if (!db.objectStoreNames.contains('progress')) {
        // progress 和 pages 使用同样的主键，方便用同一个 siteId/url 对齐索引页和阅读进度。
        const progress = db.createObjectStore('progress', { keyPath: ['siteId', 'url'] });
        progress.createIndex('bySite', 'siteId');
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

  return dbPromise;
}

// 在指定对象仓库上执行一次 IndexedDB 事务，并把事件式事务包装成 Promise。
function tx<T>(stores: StoreName[], mode: IDBTransactionMode, run: (stores: Record<StoreName, IDBObjectStore>) => Promise<T>): Promise<T> {
  // IndexedDB 的事务通过事件结束，不是 await 一条语句就完成。
  // 这里把事务包装成 Promise，让调用方可以用普通 async/await 写业务逻辑。
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(stores, mode);
    const storeMap = Object.fromEntries(stores.map((name) => [name, transaction.objectStore(name)])) as Record<StoreName, IDBObjectStore>;
    let result: T;

    // IndexedDB 事务真正完成的时机是 transaction.oncomplete，而不是 run() resolve 的瞬间。
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

// 把单个 IDBRequest 转成 Promise，统一 async/await 调用风格。
function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// 通过对象仓库上的二级索引读取所有匹配记录，例如按 siteId 读取全部 pages。
function indexAll<T>(store: IDBObjectStore, indexName: string, value: IDBValidKey): Promise<T[]> {
  return requestToPromise<T[]>(store.index(indexName).getAll(value));
}

// 读取一个文档范围的站点元数据。
export async function getSite(siteId: string): Promise<SiteRecord | undefined> {
  return tx(['sites'], 'readonly', ({ sites }) => requestToPromise<SiteRecord | undefined>(sites.get(siteId)));
}

// 读取所有已经创建过索引的文档范围。
export async function getAllSites(): Promise<SiteRecord[]> {
  return tx(['sites'], 'readonly', ({ sites }) => requestToPromise<SiteRecord[]>(sites.getAll()));
}

// 新增或覆盖一个站点元数据记录。
export async function putSite(site: SiteRecord): Promise<void> {
  await tx(['sites'], 'readwrite', async ({ sites }) => {
    sites.put(site);
  });
}

// 保存一次完整的站点索引：更新 site，并用新的 pages 列表替换旧 pages 列表。
export async function replaceSitePages(site: SiteRecord, pages: PageIndexRecord[]): Promise<void> {
  // 重建索引时替换 pages，但不删除 progress。
  // 这样同 URL 的历史阅读进度还能被后续计算继续使用。
  const existing = await getPages(site.siteId);
  await tx(['sites', 'pages'], 'readwrite', async ({ sites, pages: pageStore }) => {
    sites.put(site);
    existing.forEach((page) => pageStore.delete([site.siteId, page.url]));
    pages.forEach((page) => pageStore.put(page));
  });
}

// 读取某个文档范围下的所有页面索引，并按导航顺序返回。
export async function getPages(siteId: string): Promise<PageIndexRecord[]> {
  const pages = await tx(['pages'], 'readonly', ({ pages }) => indexAll<PageIndexRecord>(pages, 'bySite', siteId));
  return pages.sort((a, b) => a.order - b.order);
}

// 读取某个文档范围下的单页索引记录。
export async function getPage(siteId: string, url: string): Promise<PageIndexRecord | undefined> {
  // 复合主键查询必须传入和 keyPath 一样的数组顺序：[siteId, url]。
  return tx(['pages'], 'readonly', ({ pages }) => requestToPromise<PageIndexRecord | undefined>(pages.get([siteId, url])));
}

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

// 删除一个文档范围的完整索引，包括 site、pages 和对应 progress。
export async function deleteSiteIndex(siteId: string): Promise<void> {
  const [pages, progress] = await Promise.all([
    getPages(siteId),
    getProgressForSite(siteId),
  ]);

  await tx(['sites', 'pages', 'progress'], 'readwrite', async ({ sites, pages: pageStore, progress: progressStore }) => {
    sites.delete(siteId);
    // pages/progress 的主键都是 [siteId, url]，删除时也必须使用复合主键数组。
    pages.forEach((page) => pageStore.delete([siteId, page.url]));
    progress.forEach((record) => progressStore.delete([siteId, record.url]));
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
