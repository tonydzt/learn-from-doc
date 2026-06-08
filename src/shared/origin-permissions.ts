import { indexedScopeForUrl } from '../indexing/indexed-scope';
import type { SiteRecord } from '../storage/db';

/**
 * 把一个具体页面 URL 转成浏览器 optional host permission 使用的 origin pattern。
 *
 * 示例：
 * - 页面：`https://ui.shadcn.com/docs/components/button`
 * - 权限：`https://ui.shadcn.com/*`
 *
 * 这里故意只保留 origin（协议 + 域名 + 端口），不保留 `/docs/...` 路径。
 * 浏览器的 host permission 是按 origin 授权的；拿到这个权限后，扩展才能在该站点
 * 的其他文档页面里注入 content script、测量正文高度和恢复阅读进度。
 *
 * 非 http/https 页面（例如 chrome://extensions）不是普通网页，扩展不能用这种方式请求
 * origin 权限，所以返回 null。URL 解析失败也返回 null，调用方据此跳过权限逻辑。
 */
export function originPermissionPatternForUrl(input: string | URL | undefined): string | null {
  if (!input) return null;
  try {
    const url = typeof input === 'string' ? new URL(input) : input;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return `${url.origin}/*`;
  } catch {
    return null;
  }
}

/**
 * 判断当前页面是否值得请求“持久 origin 权限”。
 *
 * activeTab 权限只在用户当前这次打开 popup 时临时有效；popup 关闭或后续后台索引页面时，
 * 扩展仍需要持久 host permission 才能继续注入脚本。因此，只有已经识别出 adapter 的页面
 * 才会请求持久权限：
 *
 * - `adapterKind: 'site'`：内置站点 adapter，例如 react.dev、playwright.dev。
 * - `adapterKind: 'framework'`：手动检测出的通用文档框架，例如 Docusaurus、Fumadocs。
 *
 * 如果没有 adapterKind，说明当前 URL 还只是“一个普通 https 页面”，不能仅凭 URL 就向用户
 * 请求站点权限，避免过度授权。
 */
export function shouldRequestPersistentOriginPermission(input: {
  url: string | URL | undefined;
  adapterKind?: 'site' | 'framework';
}): boolean {
  return input.adapterKind != null && originPermissionPatternForUrl(input.url) != null;
}

/**
 * 计算某个 URL 是否属于“已经建立过索引、且可以在授权后自动注入”的目标。
 *
 * 使用场景在 background：
 * 1. 用户已经为某个框架站点创建过索引，比如 `ui.shadcn.com::docs`。
 * 2. 用户之后打开该站点的其他文档页。
 * 3. background 根据已保存的 sites 列表判断这个 URL 是否落在某个已索引 scope 内。
 * 4. 如果命中，并且浏览器已经授予该 origin 权限，就可以自动注入 content script，
 *    让阅读进度 UI 自动出现。
 *
 * 返回值同时带上：
 * - `site`：命中的已索引站点范围，用来知道属于哪个文档 scope。
 * - `originPattern`：后续给 `browser.permissions.contains({ origins: [...] })` 检查授权。
 *
 * 如果 URL 不是普通网页、没有命中已索引 scope，或输入为空，就返回 null。
 */
export function indexedAutoInjectTargetForUrl(input: string | URL | undefined, sites: SiteRecord[]): {
  site: SiteRecord;
  originPattern: string;
} | null {
  const originPattern = originPermissionPatternForUrl(input);
  if (!originPattern || !input) return null;
  const site = indexedScopeForUrl(String(input), sites);
  return site ? { site, originPattern } : null;
}
