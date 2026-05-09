import { normalizePageUrl } from '../shared/url';
import type { DocScope, DocSiteAdapter, ProgressInsertionTargets, SidebarLink } from './types';

const SIDEBAR_SELECTORS = [
  'aside nav',
  'nav[aria-label="Main"]',
  'nav[aria-label="Docs"]',
  'nav[aria-label="Sidebar"]',
];

function firstElement<T extends Element>(selectors: string[], root: ParentNode = document): T | null {
  for (const selector of selectors) {
    const element = root.querySelector<T>(selector);
    if (element) return element;
  }
  return null;
}

function sidebarRoot(): Element | null {
  return firstElement(SIDEBAR_SELECTORS);
}

function isReactDocPath(pathname: string): boolean {
  return pathname === '/learn'
    || pathname.startsWith('/learn/')
    || pathname === '/reference/react'
    || pathname.startsWith('/reference/react/');
}

function scopeFromPath(pathname: string): Pick<DocScope, 'scopeKey' | 'scopeTitle'> | null {
  if (pathname === '/learn' || pathname.startsWith('/learn/')) {
    return { scopeKey: 'learn', scopeTitle: 'Learn React' };
  }
  if (pathname === '/reference/react' || pathname.startsWith('/reference/react/')) {
    return { scopeKey: 'reference-react', scopeTitle: 'React Reference' };
  }
  return null;
}

function isInScope(url: URL, scopeKey: string): boolean {
  if (scopeKey === 'learn') return url.pathname === '/learn' || url.pathname.startsWith('/learn/');
  if (scopeKey === 'reference-react') return url.pathname === '/reference/react' || url.pathname.startsWith('/reference/react/');
  return false;
}

function linkTitle(anchor: HTMLAnchorElement): string {
  return (anchor.textContent ?? '').replace(/\s+/g, ' ').trim() || anchor.href;
}

export const ReactDevAdapter: DocSiteAdapter = {
  id: 'react-dev',

  matches(url) {
    return url.hostname === 'react.dev' && isReactDocPath(url.pathname);
  },

  getDocScope() {
    const url = new URL(location.href);
    const scope = scopeFromPath(url.pathname);
    if (!scope) return null;
    return {
      host: url.hostname,
      ...scope,
    };
  },

  async expandLazyNavigation() {
    const root = sidebarRoot();
    if (!root) return;

    const clickExpandableButtons = () => {
      const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]'));
      buttons.forEach((button) => button.click());
      return buttons.length;
    };

    for (let i = 0; i < 8; i += 1) {
      const clicked = clickExpandableButtons();
      if (clicked === 0) break;
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }
  },

  getSidebarLinks() {
    const root = sidebarRoot();
    const scope = this.getDocScope();
    if (!root || !scope) return [];

    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'));
    const byUrl = new Map<string, SidebarLink>();

    for (const element of links) {
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

  getArticleRoot() {
    return firstElement<HTMLElement>([
      'main article',
      'article',
      'main [class*="prose"]',
      'main',
    ]);
  },

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
