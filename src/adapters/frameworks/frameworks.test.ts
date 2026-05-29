import { FrameworkAdapters } from '.';
import { createFrameworkAdapter } from './common';

const cases = [
  {
    id: 'framework-docusaurus',
    frameworkName: 'Docusaurus',
    url: 'https://react.dev/docs/getting-started',
    html: `
      <nav aria-label="Docs sidebar">
        <a class="menu__link" href="/docs/getting-started">Getting Started</a>
        <a class="menu__link" href="/docs/components-and-apis">Components</a>
      </nav>
      <main><article>Docusaurus article</article></main>
      <script id="__docusaurus"></script>
    `,
  },
  {
    id: 'framework-vitepress',
    frameworkName: 'VitePress',
    url: 'https://react.dev/guide/',
    html: `
      <aside class="VPSidebar">
        <nav>
          <a class="VPLink" href="/guide/">Guide</a>
          <a class="VPLink" href="/config/">Config</a>
        </nav>
      </aside>
      <main class="VPDoc"><article>VitePress article</article></main>
      <div id="app" data-v-app></div>
    `,
  },
  {
    id: 'framework-nextra',
    frameworkName: 'Nextra',
    url: 'https://react.dev/docs/getting-started',
    html: `
      <aside class="nextra-sidebar">
        <a href="/docs/getting-started">Getting Started</a>
        <a href="/docs/options">Options</a>
      </aside>
      <main class="nextra-content"><article>Nextra article</article></main>
      <script id="__NEXT_DATA__" type="application/json">{}</script>
    `,
  },
  {
    id: 'framework-fumadocs',
    frameworkName: 'Fumadocs',
    url: 'https://react.dev/docs',
    html: `
      <aside data-fumadocs-sidebar>
        <a href="/docs">Introduction</a>
        <a href="/docs/components/button">Button</a>
      </aside>
      <main data-fumadocs-page><article>Fumadocs article</article></main>
      <script id="__NEXT_DATA__" type="application/json">{}</script>
    `,
  },
  {
    id: 'framework-starlight',
    frameworkName: 'Starlight',
    url: 'https://react.dev/',
    html: `
      <starlight-sidebar>
        <a href="/getting-started/">Getting Started</a>
        <a href="/build/">Build</a>
      </starlight-sidebar>
      <main><div class="sl-markdown-content">Starlight article</div></main>
      <meta name="generator" content="Astro v5">
    `,
  },
  {
    id: 'framework-material-mkdocs',
    frameworkName: 'Material for MkDocs',
    url: 'https://react.dev/latest/',
    html: `
      <div class="md-sidebar md-sidebar--primary">
        <nav class="md-nav">
          <a class="md-nav__link" href="/latest/">Welcome</a>
          <a class="md-nav__link" href="/latest/concepts/models/">Models</a>
        </nav>
      </div>
      <main class="md-main"><article class="md-content__inner">Material article</article></main>
    `,
  },
  {
    id: 'framework-retype',
    frameworkName: 'Retype',
    url: 'https://react.dev/usage/',
    html: `
      <aside id="retype-sidebar-left">
        <a href="/">What is SillyTavern?</a>
        <a href="/installation/">Installation</a>
      </aside>
      <main id="retype-content">Retype article</main>
      <meta name="generator" content="Retype 4.5.3">
    `,
  },
];

describe('framework adapters', () => {
  afterEach(() => {
    jsdom.reconfigure({ url: 'https://react.dev/learn' });
  });

  for (const item of cases) {
    it(`detects ${item.frameworkName} and exposes index targets`, () => {
      history.replaceState(null, '', item.url);
      document.body.innerHTML = item.html;
      const adapter = FrameworkAdapters.find((candidate) => candidate.id === item.id);

      expect(adapter?.detect?.()?.frameworkName).toBe(item.frameworkName);
      expect(adapter?.isPageIndexable?.()).toBe(true);
      expect(adapter?.getArticleRoot()?.textContent).toContain('article');
      expect(adapter?.getSidebarLinks().map((link) => link.url).length).toBe(2);
      expect(adapter?.getProgressInsertionTargets()?.pageLinkTargets.length).toBe(2);
    });
  }

  it('does not enable Nextra from Next.js markers alone', () => {
    history.replaceState(null, '', 'https://react.dev/docs');
    document.body.innerHTML = `
      <main><article>Next.js page</article></main>
      <script id="__NEXT_DATA__" type="application/json">{}</script>
    `;
    const adapter = FrameworkAdapters.find((candidate) => candidate.id === 'framework-nextra');

    expect(adapter?.detect?.()).toBeNull();
  });

  it('enables stable initial article only for Typer Material MkDocs pages', () => {
    document.body.innerHTML = `
      <div class="md-sidebar md-sidebar--primary">
        <nav class="md-nav">
          <a class="md-nav__link" href="/tutorial/">Tutorial</a>
        </nav>
      </div>
      <main class="md-main"><article class="md-content__inner">Material article</article></main>
    `;
    const adapter = FrameworkAdapters.find((candidate) => candidate.id === 'framework-material-mkdocs');

    jsdom.reconfigure({ url: 'https://typer.tiangolo.com/tutorial/' });
    expect(adapter?.requiresStableInitialArticle).toBe(true);

    jsdom.reconfigure({ url: 'https://fastapi.tiangolo.com/tutorial/' });
    expect(adapter?.requiresStableInitialArticle).toBeUndefined();
  });

  it('detects the current Nextra docs DOM', () => {
    history.replaceState(null, '', 'https://react.dev/docs');
    document.body.innerHTML = `
      <aside class="nextra-sidebar">
        <a href="/docs">Introduction</a>
        <a href="/docs/guide/markdown">Markdown</a>
      </aside>
      <main></main>
      <article class="x:w-full x:min-w-0">Nextra article</article>
    `;
    const adapter = FrameworkAdapters.find((candidate) => candidate.id === 'framework-nextra');

    expect(adapter?.detect?.()?.frameworkName).toBe('Nextra');
    expect(adapter?.getArticleRoot()?.textContent).toContain('Nextra article');
    expect(adapter?.getSidebarLinks().map((link) => link.url)).toEqual([
      'https://react.dev/docs',
      'https://react.dev/docs/guide/markdown',
    ]);
  });

  it('detects the current shadcn/ui docs DOM as Fumadocs-compatible', () => {
    history.replaceState(null, '', 'https://react.dev/docs');
    document.body.innerHTML = `
      <main class="flex min-h-0 flex-1 flex-col">
        <div data-sidebar="content">
          <ul data-sidebar="menu">
            <li><a data-sidebar="menu-button" href="/docs">Introduction</a></li>
            <li><a data-sidebar="menu-button" href="/docs/components/button">Button</a></li>
          </ul>
        </div>
        <div data-slot="docs">
          <div>
            <h1>Introduction</h1>
            <p>shadcn/ui is a set of beautifully-designed components.</p>
          </div>
        </div>
      </main>
    `;
    const adapter = FrameworkAdapters.find((candidate) => candidate.id === 'framework-fumadocs');

    expect(adapter?.detect?.()?.frameworkName).toBe('Fumadocs');
    expect(adapter?.getArticleRoot()?.textContent).toContain('shadcn/ui');
    expect(adapter?.getSidebarLinks().map((link) => link.url)).toEqual([
      'https://react.dev/docs',
      'https://react.dev/docs/components/button',
    ]);
  });

  it('detects the current SWR docs DOM as Fumadocs-compatible', () => {
    history.replaceState(null, '', 'https://react.dev/docs/getting-started');
    document.body.innerHTML = `
      <div class="grid transition-[grid-template-columns] overflow-x-clip min-h-(--fd-docs-height) [--fd-sidebar-width:0px]">
        <div class="pointer-events-none sticky [grid-area:sidebar] md:layout:[--fd-sidebar-width:268px]">
          <div class="h-full overflow-y-auto px-4 pt-12 pb-4">
            <a href="/docs/getting-started">Getting Started</a>
            <a href="/docs/api">API</a>
          </div>
        </div>
        <article class="flex flex-col w-full max-w-[900px] [grid-area:main]">
          <h1>Getting Started</h1>
          <p>SWR article</p>
        </article>
      </div>
    `;
    const adapter = FrameworkAdapters.find((candidate) => candidate.id === 'framework-fumadocs');

    expect(adapter?.detect?.()?.frameworkName).toBe('Fumadocs');
    expect(adapter?.getArticleRoot()?.textContent).toContain('SWR article');
    expect(adapter?.getSidebarLinks().map((link) => link.url)).toEqual([
      'https://react.dev/docs/getting-started',
      'https://react.dev/docs/api',
    ]);
  });

  it('collects Fumadocs child pages from Next flight data only for configured sites', () => {
    history.replaceState(null, '', 'https://react.dev/docs/ui');
    document.body.innerHTML = `
      <aside id="nd-sidebar" data-fumadocs-sidebar class="[grid-area:sidebar]">
        <a href="/">Fumadocs</a>
        <a href="/docs/ui">Overview</a>
        <a href="/docs/ui/component-library">Component Library</a>
        <div data-state="closed">
          <a href="/docs/ui/components">Components</a>
          <div data-state="closed" hidden></div>
        </div>
        <div data-state="closed">
          <a href="/docs/ui/layouts">Layouts</a>
          <div data-state="closed" hidden></div>
        </div>
      </aside>
      <main><article>Fumadocs article</article></main>
      <script>
        self.__next_f.push([1, "{\\"type\\":\\"page\\",\\"name\\":\\"Auto Type Table\\",\\"description\\":\\"Auto-generated type table\\",\\"url\\":\\"/docs/ui/components/auto-type-table\\"},{\\"type\\":\\"page\\",\\"name\\":\\"Root Guide\\",\\"url\\":\\"/docs/what-is-fumadocs\\"}"]);
      </script>
    `;
    const adapter = createFrameworkAdapter({
      id: 'framework-test-fumadocs',
      frameworkName: 'Fumadocs',
      sidebarSelectors: ['[data-fumadocs-sidebar]'],
      articleSelectors: ['main article'],
      signatureSelectors: ['[data-fumadocs-sidebar]'],
      siteOverrides: [
        {
          host: 'react.dev',
          pathPrefix: '/docs/ui',
          includeNextFlightPageLinks: true,
        },
      ],
    });

    expect(adapter?.getSidebarLinks().map((link) => [link.url, link.title])).toContainEqual([
      'https://react.dev/docs/ui/components/auto-type-table',
      'Auto Type Table',
    ]);
    expect(adapter?.getSidebarLinks().map((link) => link.url)).not.toContain('https://react.dev/docs/what-is-fumadocs');
  });

  it('does not collect Fumadocs Next flight links for other Fumadocs-compatible sites', () => {
    history.replaceState(null, '', 'https://react.dev/docs/other');
    document.body.innerHTML = `
      <aside id="nd-sidebar" data-fumadocs-sidebar class="[grid-area:sidebar]">
        <a href="/docs/other">Overview</a>
      </aside>
      <main><article>Fumadocs article</article></main>
      <script>
        self.__next_f.push([1, "{\\"type\\":\\"page\\",\\"name\\":\\"Nested Page\\",\\"url\\":\\"/docs/other/nested\\"}"]);
      </script>
    `;
    const adapter = FrameworkAdapters.find((candidate) => candidate.id === 'framework-fumadocs');

    expect(adapter?.getSidebarLinks().map((link) => link.url)).toEqual([
      'https://react.dev/docs/other',
    ]);
  });

  it('allows configured sites to override framework indexing load wait', () => {
    const adapter = createFrameworkAdapter({
      id: 'framework-test',
      frameworkName: 'Test Docs',
      requiresIndexingLoadWait: true,
      sidebarSelectors: ['nav'],
      articleSelectors: ['article'],
      signatureSelectors: ['nav'],
      siteOverrides: [
        {
          host: 'react.dev',
          pathPrefix: '/fast',
          requiresIndexingLoadWait: false,
        },
      ],
    });
    document.body.innerHTML = `
      <nav><a href="/docs">Docs</a></nav>
      <article>Test article</article>
    `;

    history.replaceState(null, '', 'https://react.dev/slow');
    expect(adapter.requiresIndexingLoadWait).toBe(true);

    history.replaceState(null, '', 'https://react.dev/fast');
    expect(adapter.requiresIndexingLoadWait).toBe(false);
  });

  it('treats Retype navigation containing the home page as one root scope', () => {
    history.replaceState(null, '', 'https://react.dev/usage/');
    document.body.innerHTML = `
      <aside id="retype-sidebar-left">
        <a href="/">What is SillyTavern?</a>
        <a href="/usage/">Usage</a>
        <a href="/installation/">Installation</a>
      </aside>
      <main id="retype-content">Usage article</main>
      <meta name="generator" content="Retype 4.5.3">
    `;
    const adapter = FrameworkAdapters.find((candidate) => candidate.id === 'framework-retype');

    expect(adapter?.getDocScope()).toEqual({
      host: 'react.dev',
      scopeKey: 'root',
      scopeTitle: 'Retype Docs',
      frameworkName: 'Retype',
    });
    expect(adapter?.requiresIndexingLoadWait).toBe(true);
  });

  it('inserts Retype total progress within the SimpleBar scroll content below its filter', () => {
    history.replaceState(null, '', 'https://react.dev/usage/');
    document.body.innerHTML = `
      <aside id="retype-sidebar-left">
        <div class="absolute top-0 left-0 right-0 h-16"><input type="text"></div>
        <ul class="overflow-y-auto flex-1 pl-3 md:mt-16 simplebar-scrollable-y">
          <div class="simplebar-wrapper">
            <div class="simplebar-content-wrapper">
              <div class="simplebar-content">
                <li><a href="/">What is SillyTavern?</a></li>
                <li><a href="/usage/">Usage</a></li>
              </div>
            </div>
          </div>
        </ul>
      </aside>
      <main id="retype-content">Usage article</main>
      <meta name="generator" content="Retype 4.5.3">
    `;
    const adapter = FrameworkAdapters.find((candidate) => candidate.id === 'framework-retype');
    const targets = adapter?.getProgressInsertionTargets();

    expect(targets?.sidebarRoot).toBe(document.querySelector('#retype-sidebar-left .simplebar-content'));
    expect(targets?.totalProgressBefore).toBe(document.querySelector('#retype-sidebar-left .simplebar-content li'));
  });

  it('inserts Starlight total progress inside the sidebar content container', () => {
    history.replaceState(null, '', 'https://react.dev/docs/getting-started');
    document.body.innerHTML = `
      <nav class="sidebar" aria-label="Main">
        <div class="sidebar-pane sl-flex">
          <div class="sidebar-content sl-flex">
            <h2>Install & use</h2>
            <a href="/docs/getting-started">Getting Started</a>
            <a href="/docs/build">Build</a>
          </div>
        </div>
      </nav>
      <main><div class="sl-markdown-content">Starlight article</div></main>
      <meta name="generator" content="Astro v5">
    `;
    const adapter = FrameworkAdapters.find((candidate) => candidate.id === 'framework-starlight');
    const targets = adapter?.getProgressInsertionTargets();

    expect(targets?.sidebarRoot).toBe(document.querySelector('.sidebar-content'));
    expect(targets?.totalProgressBefore).toBe(document.querySelector('.sidebar-content h2'));
  });

  it('waits for Netlify Starlight pages to load before measuring indexing height', () => {
    jsdom.reconfigure({ url: 'https://docs.netlify.com/deploy/deploy-overview/' });
    document.body.innerHTML = `
      <nav class="sidebar" aria-label="Main">
        <a href="/deploy/deploy-overview/">Deploy overview</a>
      </nav>
      <main><div class="sl-markdown-content">Starlight article</div></main>
      <meta name="generator" content="Astro v5">
    `;
    const adapter = FrameworkAdapters.find((candidate) => candidate.id === 'framework-starlight');

    expect(adapter?.requiresIndexingLoadWait).toBe(true);

    jsdom.reconfigure({ url: 'https://example.com/deploy/deploy-overview/' });
    expect(adapter?.requiresIndexingLoadWait).toBeUndefined();
  });

  it('uses a visible duplicate sidebar link as the progress insertion target', () => {
    history.replaceState(null, '', 'https://react.dev/docs/view');
    document.body.innerHTML = `
      <nav aria-label="Docs sidebar">
        <a class="menu__link" href="/docs/getting-started">Getting Started</a>
        <a class="menu__link" href="/docs/view" hidden>View</a>
        <a class="menu__link menu__link--active" aria-current="page" href="/docs/view">View</a>
      </nav>
      <main><article>Docusaurus article</article></main>
      <script id="__docusaurus"></script>
    `;
    const adapter = FrameworkAdapters.find((candidate) => candidate.id === 'framework-docusaurus');
    const target = adapter?.getProgressInsertionTargets()?.pageLinkTargets.find((item) => item.url === 'https://react.dev/docs/view');

    expect(target?.anchor.hasAttribute('hidden')).toBe(false);
    expect(target?.anchor.getAttribute('aria-current')).toBe('page');
  });

  it('expands Docusaurus menu caret controls without aria-expanded before collecting links', async () => {
    history.replaceState(null, '', 'https://react.dev/docs/getting-started');
    document.body.innerHTML = `
      <nav aria-label="Docs sidebar">
        <a class="menu__link" href="/docs/getting-started">Getting Started</a>
        <li class="theme-doc-sidebar-item-category menu__list-item menu__list-item--collapsed">
          <div class="menu__list-item-collapsible">
            <a class="menu__link menu__link--sublist" href="/docs/environment-setup">Environment setup</a>
            <button type="button" class="clean-btn menu__caret"></button>
          </div>
        </li>
      </nav>
      <main><article>Docusaurus article</article></main>
      <script id="__docusaurus"></script>
    `;
    const adapter = FrameworkAdapters.find((candidate) => candidate.id === 'framework-docusaurus');
    const caret = document.querySelector<HTMLButtonElement>('.menu__caret');
    const category = document.querySelector<HTMLElement>('.theme-doc-sidebar-item-category');
    caret?.addEventListener('click', () => {
      category?.classList.remove('menu__list-item--collapsed');
      category?.insertAdjacentHTML('beforeend', `
        <ul class="menu__list">
          <li><a class="menu__link" href="/docs/set-up-your-environment">Set up your environment</a></li>
        </ul>
      `);
    });

    await adapter?.expandLazyNavigation();

    expect(adapter?.getSidebarLinks().map((link) => link.url)).toContain('https://react.dev/docs/set-up-your-environment');
  });
});
