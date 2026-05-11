import { browser } from 'wxt/browser';
import { APP_SETTINGS_STORAGE_KEY, normalizeAppSettings, type AppSettings } from '../settings/app-settings';

// settings 和 db.ts 里的 sites/pages/progress 使用不同存储：
// - settings 存在 browser.storage.local，适合少量全局偏好配置，像一个简单 key-value store。
// - sites/pages/progress 存在 IndexedDB，适合有多条记录、复合主键、索引和批量查询的结构化数据。
//
// 这里没有把 settings 放进 IndexedDB，主要是因为当前只有 showReadingMap 这类简单配置，
// 不需要表结构和事务；同时 browser.storage.local 支持 browser.storage.onChanged，
// options 页面修改配置后，content script 可以直接监听变化并实时更新页面 UI。

// 读取扩展全局设置；如果本地没有值或值结构不合法，就返回默认设置。
export async function getAppSettings(): Promise<AppSettings> {
  const values = await browser.storage.local.get(APP_SETTINGS_STORAGE_KEY);
  return normalizeAppSettings(values[APP_SETTINGS_STORAGE_KEY]);
}

// 保存部分设置。调用方可以只传要改的字段，这里会先读取当前设置，再合并和规范化。
export async function saveAppSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const next = normalizeAppSettings({ ...current, ...settings });
  await browser.storage.local.set({ [APP_SETTINGS_STORAGE_KEY]: next });
  return next;
}
