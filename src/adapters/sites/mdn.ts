import { normalizePageUrl } from '../../shared/url';
import type { DocScope, DocSiteAdapter, ProgressInsertionTargets, SidebarLink } from '../types';

const MDN_HOST = 'developer.mozilla.org';
const WEB_PATH_PREFIX = '/en-US/docs/Web';

function sidebarRoot(): Element | null {
  return document.querySelector('nav.left-sidebar');
}

function linkRoot(): Element | null {
  return sidebarRoot() ?? document.querySelector('main#content');
}

function linkTitle(anchor: HTMLAnchorElement): string {
  return (anchor.textContent ?? '').replace(/\s+/g, ' ').trim() || anchor.href;
}

function webScopeForUrl(url: URL): DocScope | null {
  if (url.hostname !== MDN_HOST || (url.pathname !== WEB_PATH_PREFIX && !url.pathname.startsWith(`${WEB_PATH_PREFIX}/`))) {
    return null;
  }

  const section = url.pathname.slice(`${WEB_PATH_PREFIX}/`.length).split('/')[0];
  if (!section) {
    return {
      host: url.hostname,
      scopeKey: 'mdn-web',
      scopeTitle: 'MDN Web Docs',
    };
  }

  return {
    host: url.hostname,
    scopeKey: `mdn-web-${section.toLowerCase()}`,
    scopeTitle: `MDN Web: ${decodeURIComponent(section).replace(/_/g, ' ')}`,
  };
}

function isLandingPage(url: URL): boolean {
  return url.pathname === WEB_PATH_PREFIX;
}

function isInScope(url: URL, scope: DocScope): boolean {
  if (scope.scopeKey === 'mdn-web') return false;
  return webScopeForUrl(url)?.scopeKey === scope.scopeKey;
}

export const MdnAdapter: DocSiteAdapter = {
  id: 'mdn',

  matches(url) {
    return webScopeForUrl(url) !== null;
  },

  getDocScopeForUrl(url) {
    return webScopeForUrl(url);
  },

  getDocScope() {
    return this.getDocScopeForUrl(new URL(location.href));
  },

  async expandLazyNavigation() {
    // MDN renders the complete section tree in the sidebar DOM, including closed <details> nodes.
  },

  getSidebarLinks() {
    const root = linkRoot();
    const scope = this.getDocScope();
    if (!root || !scope) return [];

    const byUrl = new Map<string, SidebarLink>();
    for (const element of Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
      const url = new URL(element.href, location.href);
      if (!isInScope(url, scope)) continue;

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
    return document.querySelector<HTMLElement>('main#content .layout__body');
  },

  isPageIndexable() {
    return !isLandingPage(new URL(location.href)) && Boolean(linkRoot());
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
