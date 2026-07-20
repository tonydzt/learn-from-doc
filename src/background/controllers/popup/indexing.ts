import { browser } from 'wxt/browser';
import type { BackgroundHandler } from '../../types';
import { startIndex } from '../../services/indexing';
import { logIndexFailureToSourceTab } from '../../services/tabs';
import { getIndexCheckpoint } from '../../../storage/db';
import {
  clearPendingIndexAfterPermission,
  consumePendingIndexAfterPermission,
  registerPendingIndexAfterPermission,
} from '../../services/pending-index';
import type { BackgroundContext } from '../../types';

// 授权弹窗可能关闭 popup，所以“首次授权后继续创建索引”必须由 background 接手。
// 这里用一个 Promise 队列串行处理 permissions.onAdded 和注册补偿触发，避免同一个 pending action 被并发消费。
let resumeQueue: Promise<unknown> = Promise.resolve();

export async function runIndex(context: BackgroundContext, tabId: number) {
  return startIndex(context, tabId).catch(async (error: unknown) => {
    context.indexRunProgress.clearSoon();
    await logIndexFailureToSourceTab(tabId, error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Indexing failed.',
    };
  });
}

async function resumePendingIndex(context: BackgroundContext, addedOrigins: string[]): Promise<void> {
  const pending = await consumePendingIndexAfterPermission(addedOrigins);
  if (!pending) return;
  const tab = await browser.tabs.get(pending.tabId).catch(() => undefined);
  // 用户授权期间可能已经切换了当前 tab URL。只允许原 URL 续跑，避免给别的页面误建索引。
  if (tab?.url !== pending.url) return;
  await runIndex(context, pending.tabId);
}

/** 从 browser.permissions.onAdded 入口恢复一次授权前注册的索引任务。 */
export function resumePendingIndexAfterPermission(context: BackgroundContext, addedOrigins: string[]): Promise<unknown> {
  const queued = resumeQueue.then(() => resumePendingIndex(context, addedOrigins));
  resumeQueue = queued.catch(() => undefined);
  return queued;
}

export const handlePopupMessages: BackgroundHandler = async (message, _sender, context) => {
  if (message.type === 'GET_INDEX_RUN_PROGRESS') return context.indexRunProgress.get();

  if (message.type === 'GET_INDEX_CHECKPOINT') {
    const checkpoint = await getIndexCheckpoint(message.siteId);
    return checkpoint ? {
      siteId: checkpoint.siteId,
      current: checkpoint.pages.length,
      total: checkpoint.links.length,
      updatedAt: checkpoint.updatedAt,
    } : null;
  }

  if (message.type === 'REGISTER_PENDING_INDEX_AFTER_PERMISSION') {
    await registerPendingIndexAfterPermission(message.pending);
    // popup 不能等待注册完成后再请求权限，否则 Firefox 可能认为 permissions.request
    // 已经脱离用户手势。若授权事件先到，这里在注册落盘后补查一次权限并恢复索引。
    if (await browser.permissions.contains({ origins: [message.pending.originPattern] })) {
      await resumePendingIndexAfterPermission(context, [message.pending.originPattern]);
    }
    return { ok: true };
  }

  if (message.type === 'CLEAR_PENDING_INDEX_AFTER_PERMISSION') {
    await clearPendingIndexAfterPermission();
    return { ok: true };
  }

  if (message.type === 'START_INDEX') return runIndex(context, message.tabId);

  return undefined;
};
