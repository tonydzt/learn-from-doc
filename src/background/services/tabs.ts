import { browser } from 'wxt/browser';
import { indexedAutoInjectTargetForUrl } from '../../shared/origin-permissions';
import type { RuntimeMessage } from '../../shared/messages';
import { indexFailureConsolePayload } from '../../indexing/source-tab-log';
import { getAllSites } from '../../storage/db';
import { lfdDebug } from '../../shared/logger';
import { errorDetails } from '../errors';

// ---------------------------- content script注入 ----------------------------
/** 向指定标签页的 content script 发送 runtime 消息。 */
export function sendTabMessage<T>(tabId: number, message: RuntimeMessage): Promise<T> {
  return browser.tabs.sendMessage(tabId, message) as Promise<T>;
}

/** 手动向标签页注入 manifest 中声明的首个 content script。 */
export async function injectContentScript(tabId: number): Promise<void> {
  // 复用 manifest 的 content_scripts 配置，避免硬编码脚本路径。
  const file = browser.runtime.getManifest().content_scripts?.[0]?.js?.[0];
  if (!file) throw new Error('Content script file not found.');
  // executeScript 的 files 需要精确类型，这里做一次约束收窄。
  const scriptFile = file as NonNullable<Parameters<typeof browser.scripting.executeScript>[0]['files']>[number];
  await browser.scripting.executeScript({
    target: { tabId },
    files: [scriptFile],
  });
}

/** 通过探测消息判断目标标签页是否已加载 content script。 */
async function hasContentScript(tabId: number): Promise<boolean> {
  try {
    const ok = await sendTabMessage<boolean>(tabId, { type: 'CONTENT_SCRIPT_PING' });
    return ok === true;
  } catch {
    // 发送失败通常说明脚本未注入，或页面不支持扩展消息通信。
    return false;
  }
}

/** 仅在缺失时注入 content script，避免重复注入。 */
async function injectContentScriptIfMissing(tabId: number): Promise<void> {
  if (await hasContentScript(tabId)) return;
  await injectContentScript(tabId);
}

/** 对命中自动注入规则且已授权的页面，确保 content script 存在。 */
export async function maybeInjectIndexedTab(tabId: number | undefined, url: string | undefined): Promise<void> {
  if (tabId == null || !url) return;
  const target = indexedAutoInjectTargetForUrl(url, await getAllSites());
  if (!target) return;
  // 只有拿到对应 origin 权限后，才允许执行注入。
  const hasPermission = await browser.permissions.contains({ origins: [target.originPattern] });
  if (!hasPermission) return;
  await injectContentScriptIfMissing(tabId);
}

// ---------------------------- 广播变更 ----------------------------
/** 广播站点设置变更，通知所有已打开标签页刷新本地状态。 */
export async function notifySiteSettingsUpdated(siteId: string, settings: Extract<RuntimeMessage, { type: 'SITE_SETTINGS_UPDATED' }>['settings']) {
  const tabs = await browser.tabs.query({});
  await Promise.all(tabs.map((tab) => {
    if (tab.id == null) return undefined;
    return browser.tabs.sendMessage(tab.id, {
      type: 'SITE_SETTINGS_UPDATED',
      siteId,
      settings,
    } satisfies RuntimeMessage).catch(() => undefined);
  }));
}

/** 广播索引数据已更新通知，驱动页面侧重启/刷新阅读追踪。
 *
 * 使用场景：
 * 1) startIndex 完成并写入最新页面索引后
 * 2) 导入 portable 数据并写入站点索引后
 *
 * 注意：这不是 INDEX_RUN_PROGRESS（实时进度）广播。
 */
export async function notifyIndexUpdated(siteId: string) {
  const tabs = await browser.tabs.query({});
  await Promise.all(tabs.map((tab) => {
    if (tab.id == null) return undefined;
    return browser.tabs.sendMessage(tab.id, { type: 'INDEX_PROGRESS_UPDATED', siteId } satisfies RuntimeMessage).catch(() => undefined);
  }));
}

// ---------------------------- 索引失败日志回传 ----------------------------
/** 将索引失败信息打到源标签页控制台，便于用户定位问题。 */
export async function logIndexFailureToSourceTab(tabId: number, error: unknown): Promise<void> {
  const [label, details] = indexFailureConsolePayload(errorDetails(error));
  await browser.scripting.executeScript({
    target: { tabId },
    func: (message, payload) => {
      console.error(message, payload);
    },
    args: [label, details],
  }).catch((logError) => {
    lfdDebug('failed to log index error to source tab', {
      tabId,
      originalError: details,
      logError: errorDetails(logError),
    });
  });
}
