import type { StoreName } from './types';

const DB_NAME = 'developer-docs-progress-tracker';
const DB_VERSION = 3;

let dbPromise: Promise<IDBDatabase> | undefined;

// 打开并缓存 IndexedDB 连接；首次打开时负责创建对象仓库和索引。
export function openDb(): Promise<IDBDatabase> {
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
      if (!db.objectStoreNames.contains('siteSettings')) {
        // siteSettings 保存站点级功能开关。它和 site 元数据分开，后续增加网站级配置时不污染索引记录。
        db.createObjectStore('siteSettings', { keyPath: 'siteId' });
      }
      if (!db.objectStoreNames.contains('indexCheckpoints')) {
        // indexCheckpoints 保存索引超时后的临时断点；完整索引成功写入 pages 后会删除。
        db.createObjectStore('indexCheckpoints', { keyPath: 'siteId' });
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

  return dbPromise;
}

// 在指定对象仓库上执行一次 IndexedDB 事务，并把事件式事务包装成 Promise。
export function tx<T>(stores: StoreName[], mode: IDBTransactionMode, run: (stores: Record<StoreName, IDBObjectStore>) => Promise<T>): Promise<T> {
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
export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// 通过对象仓库上的二级索引读取所有匹配记录，例如按 siteId 读取全部 pages。
export function indexAll<T>(store: IDBObjectStore, indexName: string, value: IDBValidKey): Promise<T[]> {
  return requestToPromise<T[]>(store.index(indexName).getAll(value));
}
