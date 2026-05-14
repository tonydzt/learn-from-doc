import { probePageAdapterContext } from './framework-probe';

describe('popup framework probe', () => {
  it('detects current Nextra docs without loading the full content script', () => {
    history.replaceState(null, '', 'https://react.dev/docs');
    document.body.innerHTML = `
      <aside class="nextra-sidebar">
        <a href="/docs">Introduction</a>
        <a href="/docs/guide/markdown">Markdown</a>
      </aside>
      <main></main>
      <article class="x:w-full x:min-w-0">Nextra article</article>
    `;

    expect(probePageAdapterContext()).toEqual({
      supported: true,
      host: 'react.dev',
      scopeKey: 'docs',
      scopeTitle: 'Nextra Docs',
      adapterKind: 'framework',
      frameworkName: 'Nextra',
      indexable: true,
    });
  });

  it('detects shadcn/ui docs without loading the full content script', () => {
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
          <h1>Introduction</h1>
          <p>shadcn/ui is a set of beautifully-designed components.</p>
        </div>
      </main>
    `;

    expect(probePageAdapterContext()).toEqual({
      supported: true,
      host: 'react.dev',
      scopeKey: 'docs',
      scopeTitle: 'Fumadocs Docs',
      adapterKind: 'framework',
      frameworkName: 'Fumadocs',
      indexable: true,
    });
  });

  it('detects current SWR docs as Fumadocs without loading the full content script', () => {
    history.replaceState(null, '', 'https://react.dev/docs/getting-started');
    document.body.innerHTML = `
      <div class="grid min-h-(--fd-docs-height) [--fd-sidebar-width:0px]">
        <div class="pointer-events-none sticky [grid-area:sidebar] md:layout:[--fd-sidebar-width:268px]">
          <div>
            <a href="/docs/getting-started">Getting Started</a>
            <a href="/docs/api">API</a>
          </div>
        </div>
        <article class="flex flex-col [grid-area:main]">SWR article</article>
      </div>
    `;

    expect(probePageAdapterContext()).toEqual({
      supported: true,
      host: 'react.dev',
      scopeKey: 'docs',
      scopeTitle: 'Fumadocs Docs',
      adapterKind: 'framework',
      frameworkName: 'Fumadocs',
      indexable: true,
    });
  });

  it('does not detect ordinary pages', () => {
    history.replaceState(null, '', 'https://react.dev/');
    document.body.innerHTML = '<main><h1>Example</h1><p>Not a docs framework.</p></main>';

    expect(probePageAdapterContext()).toEqual({ supported: false });
  });
});
