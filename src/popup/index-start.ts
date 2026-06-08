// 功能：优化框架adapter授权流程
// 框架adapter在popup页面识别框架，点击创建索引后，授权完立即创建索引，而不是还要回到popup页面，再做一遍页面识别框架和点击创建索引

import { browser } from 'wxt/browser';
import type { PageAdapterContext, RuntimeMessage } from '../shared/messages';
import { originPermissionPatternForUrl, shouldRequestPersistentOriginPermission } from '../shared/origin-permissions';

// 准备一次“创建/重建索引”点击，并决定由谁继续启动索引：
// - start-now：不在这里请求权限，popup 继续走原来的 START_INDEX 流程。
//   这包含“已有权限”，也包含“当前页面不该请求/不能请求持久 origin 权限”的情况；
//   后者如果确实不可索引，会交给原索引流程自然失败。
// - background-resumes：当前页面需要 origin 权限但尚未授权，先登记 pending action，
//   再由 popup 保持用户手势请求权限，授权后让 background 续跑。
export async function prepareIndexStart(input: {
  tabId: number;
  url: string | undefined;
  adapterKind: PageAdapterContext['adapterKind'];
  now?: number;
}): Promise<'start-now' | 'background-resumes'> {
  // 没识别出 site/framework adapter，或 URL 不是可请求权限的普通网页时，不主动弹授权。
  if (!shouldRequestPersistentOriginPermission({ url: input.url, adapterKind: input.adapterKind })) {
    return 'start-now';
  }
  const originPattern = originPermissionPatternForUrl(input.url);
  // 没有合法 origin pattern 就无法调用 permissions.request，只能回到原 START_INDEX 路径。
  if (!originPattern) return 'start-now';
  if (await browser.permissions.contains({ origins: [originPattern] })) return 'start-now';

  // 不 await 这个注册消息：Firefox 要求 permissions.request 尽量贴近用户点击事件。
  // 若授权比注册处理更早到达，background 会在注册完成后补查权限并恢复索引。
  void browser.runtime.sendMessage({
    type: 'REGISTER_PENDING_INDEX_AFTER_PERMISSION',
    pending: {
      tabId: input.tabId,
      url: input.url!,
      originPattern,
      createdAt: input.now ?? Date.now(),
    },
  } satisfies RuntimeMessage).catch(() => undefined);

  const granted = await browser.permissions.request({ origins: [originPattern] });
  if (!granted) {
    // 用户拒绝授权时清掉一次性动作，避免未来某次无关授权误触发这次索引。
    await browser.runtime.sendMessage({
      type: 'CLEAR_PENDING_INDEX_AFTER_PERMISSION',
    } satisfies RuntimeMessage);
    throw new Error('Origin permission is required to index and auto-enable this documentation site.');
  }
  // 授权成功后的索引由 background 的 permissions.onAdded 监听器接管；
  // popup 可能已经被浏览器关闭，所以这里不再发送 START_INDEX。
  return 'background-resumes';
}
