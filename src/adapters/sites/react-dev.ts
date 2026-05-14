import { normalizePageUrl } from '../../shared/url';
import type { DocScope, DocSiteAdapter, ProgressInsertionTargets, SidebarLink } from '../types';

const SIDEBAR_SELECTORS = [
  'aside nav',
  'nav[aria-label="Main"]',
  'nav[aria-label="Docs"]',
  'nav[aria-label="Sidebar"]',
];

// 按候选 selector 顺序返回第一个匹配到的 DOM 元素。
function firstElement<T extends Element>(selectors: string[], root: ParentNode = document): T | null {
  // 这些 selector 只服务 react.dev adapter，不是通用网页识别规则。
  // 新站点应新增 adapter，而不是把这里继续泛化。
  for (const selector of selectors) {
    const element = root.querySelector<T>(selector);
    if (element) return element;
  }
  return null;
}

// 定位 react.dev 左侧文档导航根节点。
function sidebarRoot(): Element | null {
  return firstElement(SIDEBAR_SELECTORS);
}

// 判断当前路径是否属于本插件首版支持的 React 文档范围。
function isReactDocPath(pathname: string): boolean {
  return pathname === '/learn'
    || pathname.startsWith('/learn/')
    || pathname === '/reference/react'
    || pathname.startsWith('/reference/react/');
}

// 把 URL 路径归类到一个文档范围。
// scopeKey 会参与 siteId 生成，用来区分 Learn React 和 React Reference 两棵目录。
function scopeFromPath(pathname: string): Pick<DocScope, 'scopeKey' | 'scopeTitle'> | null {
  if (pathname === '/learn' || pathname.startsWith('/learn/')) {
    return { scopeKey: 'learn', scopeTitle: 'Learn React' };
  }
  if (pathname === '/reference/react' || pathname.startsWith('/reference/react/')) {
    return { scopeKey: 'reference-react', scopeTitle: 'React Reference' };
  }
  return null;
}

// 判断某个链接是否仍在当前文档范围内，避免 Learn 和 Reference 的页面互相混入索引。
function isInScope(url: URL, scopeKey: string): boolean {
  if (scopeKey === 'learn') return url.pathname === '/learn' || url.pathname.startsWith('/learn/');
  if (scopeKey === 'reference-react') return url.pathname === '/reference/react' || url.pathname.startsWith('/reference/react/');
  return false;
}

// 从导航链接 DOM 中提取稳定标题；如果文本为空，就回退到 href。
function linkTitle(anchor: HTMLAnchorElement): string {
  return (anchor.textContent ?? '').replace(/\s+/g, ' ').trim() || anchor.href;
}

export const ReactDevAdapter: DocSiteAdapter = {
  id: 'react-dev',

  // 判断当前 URL 是否应该由 react.dev adapter 处理。
  matches(url) {
    return url.hostname === 'react.dev' && isReactDocPath(url.pathname);
  },

  getDocScopeForUrl(url) {
    const scope = scopeFromPath(url.pathname);
    if (!scope) return null;
    return {
      host: url.hostname,
      ...scope,
    };
  },

  // 返回当前页面所属的文档范围，用于生成 siteId 和展示范围标题。
  getDocScope() {
    return this.getDocScopeForUrl(new URL(location.href));
  },

  // 索引前展开左侧懒加载/折叠导航，保证 getSidebarLinks 能收集完整目录。
  async expandLazyNavigation() {
    const root = sidebarRoot();
    if (!root) return;

    const clickExpandableButtons = () => {
      // react.dev 左侧导航有折叠节点；索引前先展开，否则只能收集当前可见链接。
      const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]'));
      buttons.forEach((button) => button.click());
      return buttons.length;
    };

    for (let i = 0; i < 8; i += 1) {
      const clicked = clickExpandableButtons();
      if (clicked === 0) break;
      // 点击展开后 React 需要一点时间渲染新节点，再继续下一轮查找。
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }
  },

  // 收集当前文档范围内的左侧导航链接，并按规范化 URL 去重。
  getSidebarLinks() {
    const root = sidebarRoot();
    const scope = this.getDocScope();
    if (!root || !scope) return [];

    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'));
    const byUrl = new Map<string, SidebarLink>();

    for (const element of links) {
      // 同一个页面可能在导航中重复出现；按规范化 URL 去重，避免索引和总进度重复计算。
      const url = new URL(element.href, location.href);
      if (url.hostname !== 'react.dev' || !isInScope(url, scope.scopeKey)) continue;

      const normalized = normalizePageUrl(url.toString());
      if (!byUrl.has(normalized)) {
        byUrl.set(normalized, {
          url: normalized,
          title: linkTitle(element),
          element,
        });
      }
    }

    return [...byUrl.values()];
  },

  // 定位正文根节点；阅读采样和索引测量都基于这个元素的渲染高度。
  getArticleRoot() {
    return firstElement<HTMLElement>([
      'main article',
      'article',
      'main [class*="prose"]',
      'main',
    ]);
  },

  // 返回页面内进度 UI 的插入位置：总进度放在 sidebar 顶部，单页 badge 放在各导航链接内。
  getProgressInsertionTargets(): ProgressInsertionTargets | null {
    const root = sidebarRoot();
    if (!root) return null;

    return {
      sidebarRoot: root,
      totalProgressBefore: root.firstElementChild,
      pageLinkTargets: this.getSidebarLinks().map((link) => ({
        url: link.url,
        title: link.title,
        anchor: link.element,
      })),
    };
  },
};
