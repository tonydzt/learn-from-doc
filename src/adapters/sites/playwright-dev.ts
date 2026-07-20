import { normalizePageUrl } from '../../shared/url';
import type { DocScope, DocSiteAdapter, ProgressInsertionTargets, SidebarLink } from '../types';

type PlaywrightScope = {
  pathPrefix: string;
  scopeKey: string;
  scopeTitle: string;
};

const PLAYWRIGHT_SCOPES: PlaywrightScope[] = [
  { pathPrefix: '/docs/api', scopeKey: 'playwright-docs-api', scopeTitle: 'Playwright API' },
  { pathPrefix: '/docs', scopeKey: 'playwright-docs', scopeTitle: 'Playwright Docs' },
  { pathPrefix: '/python/docs/api', scopeKey: 'playwright-python-api', scopeTitle: 'Playwright Python API' },
  { pathPrefix: '/python/docs', scopeKey: 'playwright-python-docs', scopeTitle: 'Playwright Python Docs' },
  { pathPrefix: '/java/docs/api', scopeKey: 'playwright-java-api', scopeTitle: 'Playwright Java API' },
  { pathPrefix: '/java/docs', scopeKey: 'playwright-java-docs', scopeTitle: 'Playwright Java Docs' },
  { pathPrefix: '/dotnet/docs/api', scopeKey: 'playwright-dotnet-api', scopeTitle: 'Playwright .NET API' },
  { pathPrefix: '/dotnet/docs', scopeKey: 'playwright-dotnet-docs', scopeTitle: 'Playwright .NET Docs' },
  { pathPrefix: '/mcp', scopeKey: 'playwright-mcp', scopeTitle: 'Playwright MCP Docs' },
];

function sidebarRoot(): Element | null {
  return document.querySelector('nav[aria-label="Docs sidebar"]');
}

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function playwrightScopeForUrl(url: URL): DocScope | null {
  if (url.hostname !== 'playwright.dev') return null;
  const scope = PLAYWRIGHT_SCOPES.find((candidate) => pathMatchesPrefix(url.pathname, candidate.pathPrefix));
  if (!scope) return null;
  return {
    host: url.hostname,
    scopeKey: scope.scopeKey,
    scopeTitle: scope.scopeTitle,
  };
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
    return playwrightScopeForUrl(url) !== null;
  },

  getDocScopeForUrl(url) {
    return playwrightScopeForUrl(url);
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
    let activeScopeKey = this.getDocScope()?.scopeKey;

    for (const element of links) {
      const url = new URL(element.href, location.href);
      const scope = playwrightScopeForUrl(url);
      if (!scope) continue;
      activeScopeKey ??= scope.scopeKey;
      if (scope.scopeKey !== activeScopeKey) continue;

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
