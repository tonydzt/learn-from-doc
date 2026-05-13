import { normalizePageUrl } from '../shared/url';
import type { DocSiteAdapter, ProgressInsertionTargets, SidebarLink } from './types';

function sidebarRoot(): Element | null {
  return document.querySelector('nav[aria-label="Docs sidebar"]');
}

function isPlaywrightDocsPath(pathname: string): boolean {
  return pathname === '/docs' || pathname.startsWith('/docs/');
}

function linkTitle(anchor: HTMLAnchorElement): string {
  return (anchor.textContent ?? '').replace(/\s+/g, ' ').trim() || anchor.href;
}

function isCategoryToggle(anchor: HTMLAnchorElement): boolean {
  return anchor.getAttribute('role') === 'button' || anchor.classList.contains('menu__link--sublist');
}

export const PlaywrightDevAdapter: DocSiteAdapter = {
  id: 'playwright-dev',

  matches(url) {
    return url.hostname === 'playwright.dev' && isPlaywrightDocsPath(url.pathname);
  },

  getDocScopeForUrl(url) {
    if (!this.matches(url)) return null;
    return {
      host: url.hostname,
      scopeKey: 'playwright-docs',
      scopeTitle: 'Playwright Docs',
    };
  },

  getDocScope() {
    return this.getDocScopeForUrl(new URL(location.href));
  },

  async expandLazyNavigation() {
    const root = sidebarRoot();
    if (!root) return;

    const clickExpandableControls = () => {
      const controls = Array.from(root.querySelectorAll<HTMLElement>([
        'button[aria-expanded="false"]',
        'a[role="button"][aria-expanded="false"]',
        'a.menu__link--sublist[aria-expanded="false"]',
      ].join(', ')));
      controls.forEach((control) => control.click());
      return controls.length;
    };

    for (let i = 0; i < 8; i += 1) {
      const clicked = clickExpandableControls();
      if (clicked === 0) break;
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }
  },

  getSidebarLinks() {
    const root = sidebarRoot();
    if (!root) return [];

    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'));
    const byUrl = new Map<string, SidebarLink>();

    for (const element of links) {
      const url = new URL(element.href, location.href);
      if (url.hostname !== 'playwright.dev' || !isPlaywrightDocsPath(url.pathname)) continue;

      const normalized = normalizePageUrl(url.toString());
      const existing = byUrl.get(normalized);
      if (!existing || (isCategoryToggle(existing.element) && !isCategoryToggle(element))) {
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
    return document.querySelector<HTMLElement>('main article')
      ?? document.querySelector<HTMLElement>('article');
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
