import { normalizePageUrl } from '../shared/url';
import type { DocSiteAdapter, ProgressInsertionTargets, SidebarLink } from './types';

function sidebarRoot(): Element | null {
  return document.querySelector('nav[data-left-nav][data-left-nav-id="/codex"]');
}

function linkTitle(anchor: HTMLAnchorElement): string {
  return (anchor.textContent ?? '').replace(/\s+/g, ' ').trim() || anchor.href;
}

export const OpenAICodexAdapter: DocSiteAdapter = {
  id: 'openai-codex',

  matches(url) {
    return url.hostname === 'developers.openai.com';
  },

  getDocScopeForUrl(url) {
    if (!this.matches(url)) return null;
    return {
      host: url.hostname,
      scopeKey: 'codex',
      scopeTitle: 'OpenAI Codex Docs',
    };
  },

  getDocScope() {
    return this.getDocScopeForUrl(new URL(location.href));
  },

  async expandLazyNavigation() {
    const root = sidebarRoot();
    if (!root) return;

    const details = Array.from(root.querySelectorAll<HTMLDetailsElement>('details:not([open])'));
    details.forEach((element) => {
      element.open = true;
    });
    if (details.length > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    }
  },

  getSidebarLinks() {
    const root = sidebarRoot();
    if (!root) return [];

    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'));
    const byUrl = new Map<string, SidebarLink>();

    for (const element of links) {
      const url = new URL(element.href, location.href);
      if (url.hostname !== 'developers.openai.com') continue;

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
    return document.querySelector<HTMLElement>('article#mainContent')
      ?? document.querySelector<HTMLElement>('#codex-changelog');
  },

  isPageIndexable() {
    return Boolean(sidebarRoot());
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
