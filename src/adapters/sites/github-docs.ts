import { normalizePageUrl } from '../../shared/url';
import type { DocScope, DocSiteAdapter, ProgressInsertionTargets, SidebarLink } from '../types';
import { waitForArticleImages } from '../wait-for-article-images';

const GITHUB_DOCS_HOST = 'docs.github.com';

// Retrieved from the product links on https://docs.github.com/en.
// The homepage also contains shortcuts to nested pages; those are folded into
// the product scope identified by the first path segment after locale/version.
const GITHUB_DOC_SCOPE_TITLES: Record<string, string> = {
  'get-started': 'Get started',
  migrations: 'Migrations',
  'account-and-profile': 'Account and profile',
  'subscriptions-and-notifications': 'Subscriptions & notifications',
  authentication: 'Authentication',
  billing: 'Billing and payments',
  'site-policy': 'Site policy',
  codespaces: 'Codespaces',
  repositories: 'Repositories',
  'pull-requests': 'Pull requests',
  discussions: 'GitHub Discussions',
  integrations: 'Integrations',
  copilot: 'GitHub Copilot',
  actions: 'GitHub Actions',
  packages: 'GitHub Packages',
  pages: 'GitHub Pages',
  'code-security': 'Security and code quality',
  'github-cli': 'GitHub CLI',
  desktop: 'GitHub Desktop',
  issues: 'GitHub Issues',
  'search-github': 'Search on GitHub',
  organizations: 'Organizations',
  'enterprise-onboarding': 'Enterprise onboarding',
  admin: 'Enterprise administrators',
  apps: 'Apps',
  rest: 'REST API',
  graphql: 'GraphQL API',
  webhooks: 'Webhooks',
  communities: 'Building communities',
  sponsors: 'GitHub Sponsors',
  education: 'GitHub Education',
  nonprofit: 'GitHub for Nonprofits',
  support: 'GitHub Support',
  contributing: 'Contribute to GitHub Docs',
};

function pathSegments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean);
}

function isVersionSegment(segment: string | undefined): boolean {
  return Boolean(segment && (
    segment.startsWith('enterprise-cloud@')
    || segment.startsWith('enterprise-server@')
    || segment.startsWith('free-pro-team@')
  ));
}

function productKeyForUrl(url: URL): string | null {
  if (url.hostname !== GITHUB_DOCS_HOST) return null;
  const segments = pathSegments(url.pathname);
  if (segments[0] !== 'en') return null;

  const productIndex = isVersionSegment(segments[1]) ? 2 : 1;
  const productKey = segments[productIndex];
  return productKey && typeof GITHUB_DOC_SCOPE_TITLES[productKey] === 'string' ? productKey : null;
}

function githubDocsScopeForUrl(url: URL): DocScope | null {
  const productKey = productKeyForUrl(url);
  if (!productKey) return null;
  return {
    host: url.hostname,
    scopeKey: productKey,
    scopeTitle: `GitHub Docs: ${GITHUB_DOC_SCOPE_TITLES[productKey]}`,
  };
}

function navigationRoot(): Element | null {
  return document.querySelector('nav[aria-label="Documentation navigation"]')
    ?? document.querySelector('nav[aria-label="Product sidebar"]');
}

function sidebarRoot(): Element | null {
  return document.querySelector('nav[aria-label="Product sidebar"]');
}

function linkTitle(anchor: HTMLAnchorElement): string {
  return (anchor.textContent ?? '').replace(/\s+/g, ' ').trim() || anchor.href;
}

function linksWithinScope(root: Element, scopeKey: string): SidebarLink[] {
  const byUrl = new Map<string, SidebarLink>();

  for (const element of Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    const href = element.getAttribute('href');
    if (!href || href.startsWith('#')) continue;

    const url = new URL(element.href, location.href);
    if (productKeyForUrl(url) !== scopeKey) continue;

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
}

export const GitHubDocsAdapter: DocSiteAdapter = {
  id: 'github-docs',

  matches(url) {
    return githubDocsScopeForUrl(url) !== null;
  },

  matchesIndexedScopeForUrl(url, scope) {
    return githubDocsScopeForUrl(url)?.scopeKey === scope.scopeKey;
  },

  getDocScopeForUrl(url) {
    return githubDocsScopeForUrl(url);
  },

  getDocScope() {
    return this.getDocScopeForUrl(new URL(location.href));
  },

  async expandLazyNavigation() {
    // GitHub Docs renders the complete product navigation in the DOM, including
    // links inside collapsed groups, so no interaction is needed before indexing.
  },

  getSidebarLinks() {
    const root = navigationRoot();
    const scope = this.getDocScope();
    return root && scope ? linksWithinScope(root, scope.scopeKey) : [];
  },

  getArticleRoot() {
    return document.querySelector<HTMLElement>('[data-container="article"][data-search="article-body"]')
      ?? document.querySelector<HTMLElement>('main#main-content');
  },

  async waitForIndexMeasurement() {
    await waitForArticleImages(this.getArticleRoot());
  },

  isPageIndexable() {
    return Boolean(this.getDocScope() && this.getArticleRoot());
  },

  getProgressInsertionTargets(): ProgressInsertionTargets | null {
    const root = sidebarRoot();
    const scope = this.getDocScope();
    if (!root || !scope) return null;

    return {
      sidebarRoot: root,
      totalProgressBefore: root.firstElementChild,
      pageLinkTargets: linksWithinScope(root, scope.scopeKey).map((link) => ({
        url: link.url,
        title: link.title,
        anchor: link.element,
      })),
    };
  },
};
