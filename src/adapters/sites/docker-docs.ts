import { normalizePageUrl } from '../../shared/url';
import type { DocScope, DocSiteAdapter, ProgressInsertionTargets, SidebarLink } from '../types';

type DockerScope = {
  pathPrefixes: string[];
  scopeKey: string;
  scopeTitle: string;
};

const DOCKER_HOST = 'docs.docker.com';
const DOCKER_SCOPES: DockerScope[] = [
  { pathPrefixes: ['/get-started'], scopeKey: 'docker-get-started', scopeTitle: 'Docker: Get started' },
  {
    // Manuals is one logical navigation tree whose product sections use different URL roots.
    pathPrefixes: [
      '/manuals', '/accounts', '/admin', '/ai', '/ai-overview', '/billing', '/build', '/build-cloud', '/compose',
      '/desktop', '/dhi', '/docker-hub', '/engine', '/enterprise', '/extensions', '/offload', '/platform-release-notes',
      '/release-lifecycle', '/retired', '/scout', '/security', '/subscription', '/support', '/tcc', '/testcontainers',
    ],
    scopeKey: 'docker-manuals',
    scopeTitle: 'Docker: Manuals',
  },
  { pathPrefixes: ['/guides'], scopeKey: 'docker-guides', scopeTitle: 'Docker: Guides' },
  { pathPrefixes: ['/reference'], scopeKey: 'docker-reference', scopeTitle: 'Docker: Reference' },
];

function sidebarRoot(): Element | null {
  return document.querySelector('main nav.navbar-font') ?? document.querySelector('main > nav');
}

function guidesRoot(): Element | null {
  return document.querySelector('main > div:nth-child(2)');
}

function isGuidesIndexPage(): boolean {
  return new URL(location.href).pathname.replace(/\/$/, '') === '/guides';
}

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function scopeForUrl(url: URL): DocScope | null {
  if (url.hostname !== DOCKER_HOST) return null;
  const scope = DOCKER_SCOPES.find((candidate) => candidate.pathPrefixes.some((prefix) => pathMatchesPrefix(url.pathname, prefix)));
  return scope ? { host: url.hostname, scopeKey: scope.scopeKey, scopeTitle: scope.scopeTitle } : null;
}

function linkTitle(anchor: HTMLAnchorElement): string {
  return (anchor.textContent ?? '').replace(/\s+/g, ' ').trim() || anchor.href;
}

function guidesOverviewLink(): HTMLAnchorElement | null {
  const currentUrl = normalizePageUrl(location.href);
  return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .find((anchor) => normalizePageUrl(new URL(anchor.href, location.href).toString()) === currentUrl) ?? null;
}

function waitForImage(image: HTMLImageElement): Promise<void> {
  if (image.complete) return Promise.resolve();
  return new Promise((resolve) => {
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener('error', () => resolve(), { once: true });
  });
}

export const DockerDocsAdapter: DocSiteAdapter = {
  id: 'docker-docs',

  matches(url) {
    return scopeForUrl(url) !== null;
  },

  matchesIndexedScopeForUrl(url, scope) {
    return scopeForUrl(url)?.scopeKey === scope.scopeKey;
  },

  getDocScopeForUrl(url) {
    return scopeForUrl(url);
  },

  getDocScope() {
    return this.getDocScopeForUrl(new URL(location.href));
  },

  async expandLazyNavigation() {
    const root = sidebarRoot();
    if (!root) return;

    for (let index = 0; index < 8; index += 1) {
      const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]'));
      if (buttons.length === 0) break;
      buttons.forEach((button) => button.click());
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    }
  },

  getSidebarLinks() {
    const scope = this.getDocScope();
    const root = scope?.scopeKey === 'docker-guides' ? guidesRoot() : sidebarRoot();
    if (!root || !scope) return [];

    const byUrl = new Map<string, SidebarLink>();
    if (scope.scopeKey === 'docker-guides' && isGuidesIndexPage()) {
      const overview = guidesOverviewLink();
      if (overview) {
        const url = normalizePageUrl(overview.href);
        byUrl.set(url, { url, title: linkTitle(overview), element: overview });
      }
    }
    for (const element of Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
      const url = new URL(element.href, location.href);
      if (scopeForUrl(url)?.scopeKey !== scope.scopeKey) continue;

      const normalized = normalizePageUrl(url.toString());
      if (!byUrl.has(normalized)) {
        byUrl.set(normalized, { url: normalized, title: linkTitle(element), element });
      }
    }

    return [...byUrl.values()];
  },

  getArticleRoot() {
    return document.querySelector<HTMLElement>('main article.prose')
      ?? document.querySelector<HTMLElement>('main > article')
      ?? (this.getDocScope()?.scopeKey === 'docker-guides' && isGuidesIndexPage()
        ? guidesRoot() as HTMLElement | null
        : null);
  },

  async waitForIndexMeasurement() {
    const article = this.getArticleRoot();
    if (!article) return;

    const images = Array.from(article.querySelectorAll<HTMLImageElement>('img'));
    images.forEach((image) => {
      if (image.loading === 'lazy') image.loading = 'eager';
    });
    const pendingImages = images.filter((image) => !image.complete);
    if (pendingImages.length === 0) return;

    await Promise.race([
      Promise.all(pendingImages.map(waitForImage)),
      new Promise((resolve) => window.setTimeout(resolve, 5000)),
    ]);
  },

  isPageIndexable() {
    if (this.getDocScope()?.scopeKey === 'docker-guides') return Boolean(this.getArticleRoot());
    return Boolean(sidebarRoot() && this.getArticleRoot());
  },

  getProgressInsertionTargets(): ProgressInsertionTargets | null {
    const scope = this.getDocScope();
    const root = scope?.scopeKey === 'docker-guides' ? guidesRoot() : sidebarRoot();
    if (!root) return null;
    const pageLinks = scope?.scopeKey === 'docker-guides'
      ? isGuidesIndexPage()
        ? this.getSidebarLinks().filter((link) => link.url !== normalizePageUrl(location.href))
        : []
      : this.getSidebarLinks();

    return {
      sidebarRoot: root,
      totalProgressBefore: root.firstElementChild,
      pageLinkTargets: pageLinks.map((link) => ({
        url: link.url,
        title: link.title,
        anchor: link.element,
      })),
    };
  },
};
