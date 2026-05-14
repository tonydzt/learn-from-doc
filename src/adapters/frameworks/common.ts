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
  requiresHydrationWait?: boolean;
};

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

function scopeKeyFromSidebar(root: Element, host: string): string {
  const paths = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .map((anchor) => new URL(anchor.href, location.href))
    .filter((url) => url.hostname === host)
    .map((url) => url.pathname);
  const prefix = commonPathPrefix(paths);
  return pathSegments(prefix)[0] ?? pathSegments(location.pathname)[0] ?? 'root';
}

export function createFrameworkAdapter(config: FrameworkAdapterConfig): DocSiteAdapter {
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
    requiresHydrationWait: config.requiresHydrationWait,

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
