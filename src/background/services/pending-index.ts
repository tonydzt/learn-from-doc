// 功能：优化框架adapter授权流程
// 框架adapter在popup页面识别框架，点击创建索引后，授权完立即创建索引，而不是还要回到popup页面，再做一遍页面识别框架和点击创建索引

import { browser } from 'wxt/browser';
import type { PendingIndexAfterPermission } from '../../shared/messages';

// 这个 key 只保存“缺少 origin 权限时，用户已经点击过创建索引”的一次性动作。
// 使用 storage.local 而不是内存变量，是为了 popup 被授权弹窗关闭或 MV3 service worker 暂停后仍能恢复。
const PENDING_INDEX_STORAGE_KEY = 'pendingIndexAfterPermission';
const PENDING_INDEX_MAX_AGE_MS = 5 * 60 * 1000;

// storage.local 读出的数据没有类型保证；恢复前先做最小结构校验，避免异常数据触发索引。
function isPendingIndexAfterPermission(value: unknown): value is PendingIndexAfterPermission {
  if (!value || typeof value !== 'object') return false;
  const pending = value as Partial<PendingIndexAfterPermission>;
  return typeof pending.tabId === 'number'
    && typeof pending.url === 'string'
    && typeof pending.originPattern === 'string'
    && typeof pending.createdAt === 'number';
}

export async function registerPendingIndexAfterPermission(pending: PendingIndexAfterPermission): Promise<void> {
  // 后来的点击会覆盖旧记录。当前产品一次只围绕当前页面创建索引，这比维护队列更简单。
  await browser.storage.local.set({ [PENDING_INDEX_STORAGE_KEY]: pending });
}

export async function clearPendingIndexAfterPermission(): Promise<void> {
  await browser.storage.local.remove(PENDING_INDEX_STORAGE_KEY);
}

export async function consumePendingIndexAfterPermission(
  addedOrigins: string[],
  now = Date.now(),
): Promise<PendingIndexAfterPermission | null> {
  const stored = await browser.storage.local.get(PENDING_INDEX_STORAGE_KEY);
  const pending = stored[PENDING_INDEX_STORAGE_KEY];
  if (!isPendingIndexAfterPermission(pending)) return null;
  // 过期记录不再可信：用户可能已离开原页面，或者这次授权不是为当时那次点击产生的。
  if (now - pending.createdAt > PENDING_INDEX_MAX_AGE_MS) {
    await clearPendingIndexAfterPermission();
    return null;
  }
  // 只接受与本次新增权限完全一致的 origin，避免用户授权其他站点时误触发索引。
  if (!addedOrigins.includes(pending.originPattern)) return null;
  await clearPendingIndexAfterPermission();
  return pending;
}
