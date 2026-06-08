import type { PageAdapterContext } from '../shared/messages';

type ProbeConfig = {
  frameworkName: string;
  sidebarSelectors: string[];
  articleSelectors: string[];
  signatureSelectors: string[];
};

export function probePageAdapterContext(): PageAdapterContext {
  const pathSegments = (pathname: string): string[] => pathname.split('/').filter(Boolean);
  const commonPathPrefix = (paths: string[]): string => {
    if (paths.length === 0) return '';
    const split = paths.map(pathSegments);
    const prefix: string[] = [];
    for (let index = 0; ; index += 1) {
      const segment = split[0]?.[index];
      if (!segment || split.some((item) => item[index] !== segment)) break;
      prefix.push(segment);
    }
    return prefix.length > 0 ? `/${prefix.join('/')}` : '';
  };
  const firstElement = (selectors: string[]): Element | null => {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  };
  const scopeKeyFromSidebar = (root: Element, host: string): string => {
    const paths = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .map((anchor) => new URL(anchor.href, location.href))
      .filter((url) => url.hostname === host)
      .map((url) => url.pathname);
    if (paths.includes('/')) return 'root';
    const prefix = commonPathPrefix(paths);
    return pathSegments(prefix)[0] ?? pathSegments(location.pathname)[0] ?? 'root';
  };
  const configs: ProbeConfig[] = [
    {
      frameworkName: 'Docusaurus',
      sidebarSelectors: ['nav[aria-label="Docs sidebar"]', 'aside nav.menu', '.theme-doc-sidebar-menu'],
      articleSelectors: ['main article', 'article[itemprop="articleBody"]', 'article'],
      signatureSelectors: ['script#__docusaurus', '.theme-doc-sidebar-menu', '.menu__link'],
    },
    {
      frameworkName: 'VitePress',
      sidebarSelectors: ['.VPSidebar', 'aside.VPSidebar', '.VPDocAside'],
      articleSelectors: ['.VPDoc main', 'main.VPDoc article', '.VPDoc article', '.vp-doc'],
      signatureSelectors: ['.VPSidebar', '.VPDoc', '.VPNav'],
    },
    {
      frameworkName: 'Nextra',
      sidebarSelectors: ['.nextra-sidebar', 'aside.nextra-sidebar', 'aside[class*="nextra-sidebar"]'],
      articleSelectors: ['main.nextra-content article', '.nextra-content article', 'article.nextra-content', 'main article', 'article'],
      signatureSelectors: ['.nextra-sidebar', '.nextra-nav-container', 'script#__NEXT_DATA__'],
    },
    {
      frameworkName: 'Fumadocs',
      sidebarSelectors: ['[data-fumadocs-sidebar]', 'aside[data-fumadocs-sidebar]', 'aside[data-fd-sidebar]', '[data-sidebar="content"]', '[data-sidebar="sidebar"]', '[class*="grid-area:sidebar"]'],
      articleSelectors: ['[data-fumadocs-page] article', '[data-fd-page] article', 'main[data-fumadocs-page]', '[data-slot="docs"]', 'main article', 'article[class*="grid-area:main"]'],
      signatureSelectors: ['[data-fumadocs-sidebar]', '[data-fumadocs-page]', '[data-fd-sidebar]', '[data-fd-page]', '[data-slot="docs"] [data-sidebar="content"], main [data-sidebar="content"]', '[data-sidebar="menu"]', '[class*="--fd-docs-height"] [class*="grid-area:sidebar"]'],
    },
    {
      frameworkName: 'Starlight',
      sidebarSelectors: ['starlight-sidebar', '.sidebar-pane', 'nav[aria-label="Main"]'],
      articleSelectors: ['main .sl-markdown-content', '.sl-markdown-content', 'main article'],
      signatureSelectors: ['starlight-sidebar', '.sl-markdown-content', 'meta[name="generator"][content*="Astro"]'],
    },
    {
      frameworkName: 'Material for MkDocs',
      sidebarSelectors: ['.md-sidebar--primary .md-nav', '.md-sidebar--primary', 'nav.md-nav'],
      articleSelectors: ['.md-content__inner', '.md-content article', '.md-main__inner .md-content'],
      signatureSelectors: ['.md-sidebar--primary', '.md-nav', '.md-content', '.md-main__inner'],
    },
    {
      frameworkName: 'Retype',
      sidebarSelectors: ['#retype-sidebar-left'],
      articleSelectors: ['#retype-content'],
      signatureSelectors: ['meta[name="generator"][content*="Retype"]'],
    },
  ];

  for (const config of configs) {
    const sidebar = firstElement(config.sidebarSelectors);
    const article = firstElement(config.articleSelectors);
    const hasSignature = config.signatureSelectors.some((selector) => Boolean(document.querySelector(selector)));
    if (!sidebar || !article || !hasSignature) continue;
    return {
      supported: true,
      host: location.hostname,
      scopeKey: scopeKeyFromSidebar(sidebar, location.hostname),
      scopeTitle: `${config.frameworkName} Docs`,
      adapterKind: 'framework',
      frameworkName: config.frameworkName,
      indexable: true,
    };
  }

  return { supported: false };
}
