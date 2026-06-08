import { normalizePageUrl } from '../../shared/url';
import type { DocScope, DocSiteAdapter, FrameworkDetection, ProgressInsertionTargets, SidebarLink } from '../types';

type FrameworkAdapterConfig = {
  id: string;
  frameworkName: string;
  sidebarSelectors: string[];
  articleSelectors: string[];
  signatureSelectors: string[];
  expandableSelectors?: string[];
  progressRootSelectors?: string[];
  includeNextFlightPageLinks?: boolean;
  requiresIndexingLoadWait?: boolean;
  requiresStableInitialArticle?: boolean;
  siteOverrides?: FrameworkSiteOverride[];
};

type FrameworkSiteOverride = {
  host: string;
  pathPrefix?: string;
  includeNextFlightPageLinks?: boolean;
  requiresIndexingLoadWait?: boolean;
  requiresStableInitialArticle?: boolean;
};

type EffectiveFrameworkConfig = Pick<
  FrameworkAdapterConfig,
  'includeNextFlightPageLinks' | 'requiresIndexingLoadWait' | 'requiresStableInitialArticle'
>;

function firstElement<T extends Element>(selectors: string[], root: ParentNode = document): T | null {
  for (const selector of selectors) {
    const element = root.querySelector<T>(selector);
    if (element) return element;
  }
  return null;
}

function linkTitle(anchor: HTMLAnchorElement): string {
  return (anchor.textContent ?? '').replace(/\s+/g, ' ').trim() || anchor.href;
}

function isHidden(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return true;
  const style = element.getAttribute('style') ?? '';
  return /display\s*:\s*none|visibility\s*:\s*hidden/i.test(style);
}

function linkPriority(anchor: HTMLAnchorElement): number {
  let priority = 0;
  if (!isHidden(anchor)) priority += 10;
  if (anchor.getAttribute('aria-current') === 'page') priority += 8;
  if (anchor.classList.contains('menu__link--active') || anchor.classList.contains('active')) priority += 4;
  if (linkTitle(anchor) !== anchor.href) priority += 1;
  return priority;
}

function betterSidebarLink(current: SidebarLink | undefined, next: SidebarLink): SidebarLink {
  if (!current) return next;
  return linkPriority(next.element) > linkPriority(current.element) ? next : current;
}

function hasHiddenDirectMenuList(element: HTMLElement): boolean {
  return Array.from(element.children).some((child) => {
    if (!(child instanceof HTMLElement) || !child.classList.contains('menu__list')) return false;
    const style = child.getAttribute('style') ?? '';
    return child.hidden || /display\s*:\s*none/i.test(style);
  });
}

function shouldExpandControl(control: HTMLElement): boolean {
  if (control instanceof HTMLDetailsElement) return !control.open;
  if (control.getAttribute('aria-expanded') === 'false') return true;
  if (control.classList.contains('menu__caret')) {
    const category = control.closest<HTMLElement>('li');
    return Boolean(category && (/collapsed/.test(category.className) || hasHiddenDirectMenuList(category)));
  }
  return true;
}

function pathSegments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean);
}

function normalizePathPrefix(pathPrefix: string): string {
  if (pathPrefix === '/') return '/';
  return pathPrefix.endsWith('/') ? pathPrefix.slice(0, -1) : pathPrefix;
}

function pathMatchesPrefix(pathname: string, pathPrefix?: string): boolean {
  if (!pathPrefix) return true;
  const normalized = normalizePathPrefix(pathPrefix);
  return normalized === '/'
    || pathname === normalized
    || pathname.startsWith(`${normalized}/`);
}

/**
 * 返回这些 path 的路径段级公共前缀，用于推断当前文档树范围。
 * 例：["/docs/ui", "/docs/ui/components"] => "/docs/ui"
 * 例：["/docs/ui", "/docs/usage"] => "/docs"，不会返回字符串前缀 "/docs/u"。
 */
function commonPathPrefix(paths: string[]): string {
  if (paths.length === 0) return '';
  const split = paths.map(pathSegments);
  const prefix: string[] = [];
  for (let index = 0; ; index += 1) {
    const segment = split[0]?.[index];
    if (!segment || split.some((item) => item[index] !== segment)) break;
    prefix.push(segment);
  }
  return prefix.length > 0 ? `/${prefix.join('/')}` : '';
}

/**
 * 从侧栏同域链接推断当前文档树前缀。
 * 例：/docs/ui、/docs/ui/components、/docs/ui/layouts => /docs/ui。
 * 用于过滤 Next flight 中的链接，避免混入 /docs/headless 等其他文档树。
 */
function visibleSidebarPathPrefix(root: Element, host: string): string {
  const paths = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .map((anchor) => new URL(anchor.href, location.href))
    .filter((url) => url.hostname === host && url.pathname !== '/')
    .map((url) => url.pathname);
  return commonPathPrefix(paths);
}

function scopeKeyFromSidebar(root: Element, host: string): string {
  const paths = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .map((anchor) => new URL(anchor.href, location.href))
    .filter((url) => url.hostname === host)
    .map((url) => url.pathname);
  if (paths.includes('/')) return 'root';
  const prefix = commonPathPrefix(paths);
  return pathSegments(prefix)[0] ?? pathSegments(location.pathname)[0] ?? 'root';
}

function decodeJsonStringValue(value: string): string {
  // Next flight 数据是以“转义后的 JSON 片段”形式塞在 script 文本里的，
  // 所以正则捕获到的值里可能还会有 `\u0026`、`\"` 这类转义。
  // 把捕获值临时包成一个 JSON 字符串交给 JSON.parse，
  // 可以复用浏览器/运行时自带的转义解析逻辑，避免为了这点数据写完整 flight parser。
  // 如果某个值格式异常，就保留原始捕获结果，不因为标题解析失败而丢掉链接。
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value;
  }
}

/**
 * 从 Next flight 中补充 DOM 侧栏未渲染的当前文档树链接。
 * 例：prefix=/docs/ui，保留 /docs/ui/components/auto-type-table，过滤 /docs/headless/page-tree。
 * 仅提取 page 的 name/url，并用隐藏 anchor 兼容后续 SidebarLink 逻辑。
 */
function nextFlightPageLinks(prefix: string): SidebarLink[] {
  if (!prefix) return [];
  const byUrl = new Map<string, SidebarLink>();
  // Next.js 版本的 Fumadocs 会把文档源树序列化进 self.__next_f 脚本片段。
  // DOM 侧栏可能要等用户进入某个折叠目录后才渲染子链接，
  // 但这些页面记录其实已经在 flight 数据里了。
  // 这里不解析整个 flight 协议，只匹配我们需要的最小结构：页面标题和 URL。
  const pagePattern = /\\"type\\":\\"page\\",\\"name\\":\\"([^\\"]+)\\"[\s\S]*?\\"url\\":\\"([^\\"]+)\\"/g;

  for (const script of Array.from(document.scripts)) {
    let match: RegExpExecArray | null;
    while ((match = pagePattern.exec(script.textContent ?? ''))) {
      const title = decodeJsonStringValue(match[1] ?? '');
      const path = decodeJsonStringValue(match[2] ?? '');
      // 同一个 host 的 flight 数据里可能包含多棵文档树。
      // 只保留当前可见侧栏范围内的页面，避免重建 `/docs/ui` 索引时，
      // 意外混入 `/docs/guides`、`/docs` 或其他兄弟产品的页面。
      if (path !== prefix && !path.startsWith(`${prefix}/`)) continue;

      const url = new URL(path, location.href);
      if (url.hostname !== location.hostname || url.protocol !== 'https:') continue;
      const normalized = normalizePageUrl(url.toString());
      // 进度 UI 的插入逻辑要求每个 SidebarLink 都带一个 anchor 元素。
      // 从 flight 数据里发现的链接，在当前页面上不一定有真实可见的 a 标签，
      // 所以这里创建一个隐藏的占位 anchor。
      // 如果同一个 URL 已经有真实 DOM anchor，betterSidebarLink 会保留真实可见的那个，
      // 因为可见链接的优先级更高。
      const element = document.createElement('a');
      element.href = normalized;
      element.hidden = true;
      element.textContent = title;
      byUrl.set(normalized, {
        url: normalized,
        title: title || normalized,
        element,
      });
    }
  }

  return [...byUrl.values()];
}

export function createFrameworkAdapter(config: FrameworkAdapterConfig): DocSiteAdapter {
  const effectiveConfig = (url = new URL(location.href)): EffectiveFrameworkConfig => {
    const override = config.siteOverrides?.find((item) => (
      item.host === url.hostname && pathMatchesPrefix(url.pathname, item.pathPrefix)
    ));
    return {
      includeNextFlightPageLinks: override?.includeNextFlightPageLinks ?? config.includeNextFlightPageLinks,
      requiresIndexingLoadWait: override?.requiresIndexingLoadWait ?? config.requiresIndexingLoadWait,
      requiresStableInitialArticle: override?.requiresStableInitialArticle ?? config.requiresStableInitialArticle,
    };
  };
  const sidebarRoot = () => firstElement(config.sidebarSelectors);
  const articleRoot = () => firstElement<HTMLElement>(config.articleSelectors);
  const hasSignature = () => config.signatureSelectors.some((selector) => Boolean(document.querySelector(selector)));

  const detect = (): FrameworkDetection | null => {
    const root = sidebarRoot();
    const article = articleRoot();
    if (!root || !article || !hasSignature()) return null;
    return {
      frameworkName: config.frameworkName,
      confidence: 'high',
      indexable: true,
    };
  };

  const adapter: DocSiteAdapter = {
    id: config.id,
    kind: 'framework',
    frameworkName: config.frameworkName,
    get requiresIndexingLoadWait() {
      return effectiveConfig().requiresIndexingLoadWait;
    },
    get requiresStableInitialArticle() {
      return effectiveConfig().requiresStableInitialArticle;
    },

    matches() {
      return Boolean(detect());
    },

    detect,

    getDocScopeForUrl(url: URL): DocScope | null {
      if (!detect()) return null;
      const root = sidebarRoot();
      if (!root) return null;
      return {
        host: url.hostname,
        scopeKey: scopeKeyFromSidebar(root, url.hostname),
        scopeTitle: `${config.frameworkName} Docs`,
        frameworkName: config.frameworkName,
      };
    },

    getDocScope() {
      return this.getDocScopeForUrl(new URL(location.href));
    },

    async expandLazyNavigation() {
      const root = sidebarRoot();
      if (!root) return;

      const selectors = config.expandableSelectors ?? ['button[aria-expanded="false"]', 'a[aria-expanded="false"]'];
      const clickExpandableControls = () => {
        const controls = Array.from(root.querySelectorAll<HTMLElement>(selectors.join(', '))).filter(shouldExpandControl);
        controls.forEach((control) => {
          if (control instanceof HTMLDetailsElement) {
            control.open = true;
          } else {
            control.click();
          }
        });
        const details = Array.from(root.querySelectorAll<HTMLDetailsElement>('details:not([open])'));
        details.forEach((element) => {
          element.open = true;
        });
        return controls.length + details.length;
      };

      for (let index = 0; index < 8; index += 1) {
        const expanded = clickExpandableControls();
        if (expanded === 0) break;
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }
    },

    getSidebarLinks() {
      const root = sidebarRoot();
      if (!root || !detect()) return [];

      const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'));
      const byUrl = new Map<string, SidebarLink>();

      for (const element of links) {
        const url = new URL(element.href, location.href);
        if (url.hostname !== location.hostname || url.protocol !== 'https:') continue;
        const normalized = normalizePageUrl(url.toString());
        byUrl.set(normalized, betterSidebarLink(byUrl.get(normalized), {
          url: normalized,
          title: linkTitle(element),
          element,
        }));
      }

      if (effectiveConfig().includeNextFlightPageLinks) {
        // 先收集 DOM 侧栏链接，再合并序列化出来的页面链接。
        // 这样完整渲染导航的框架仍然按原来的 DOM 侧栏工作；
        // 对显式开启该能力的 adapter，则可以补上懒加载/折叠导航漏掉的页面。
        for (const link of nextFlightPageLinks(visibleSidebarPathPrefix(root, location.hostname))) {
          byUrl.set(link.url, betterSidebarLink(byUrl.get(link.url), link));
        }
      }

      return [...byUrl.values()];
    },

    getArticleRoot() {
      return detect() ? articleRoot() : null;
    },

    isPageIndexable() {
      return detect()?.indexable ?? false;
    },

    getProgressInsertionTargets(): ProgressInsertionTargets | null {
      const root = sidebarRoot();
      if (!root || !detect()) return null;
      const progressRoot = config.progressRootSelectors
        ? firstElement(config.progressRootSelectors, root) ?? root
        : root;

      return {
        sidebarRoot: progressRoot,
        totalProgressBefore: progressRoot.firstElementChild,
        pageLinkTargets: this.getSidebarLinks().map((link) => ({
          url: link.url,
          title: link.title,
          anchor: link.element,
        })),
      };
    },
  };

  return adapter;
}
