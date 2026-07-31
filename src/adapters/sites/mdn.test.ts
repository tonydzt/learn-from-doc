import { MdnAdapter } from './mdn';

describe('MdnAdapter', () => {
  afterEach(() => {
    jsdom.reconfigure({ url: 'https://react.dev/learn' });
  });

  it('matches the English MDN Web tree and assigns one scope per top-level section', () => {
    expect(MdnAdapter.matches(new URL('https://developer.mozilla.org/en-US/docs/Web?utm_source=chatgpt.com'))).toBe(true);
    expect(MdnAdapter.matches(new URL('https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Animations'))).toBe(true);
    expect(MdnAdapter.matches(new URL('https://developer.mozilla.org/en-US/docs/Learn'))).toBe(false);

    expect(MdnAdapter.getDocScopeForUrl(new URL('https://developer.mozilla.org/en-US/docs/Web'))).toEqual({
      host: 'developer.mozilla.org',
      scopeKey: 'mdn-web',
      scopeTitle: 'MDN Web Docs',
    });
    expect(MdnAdapter.getDocScopeForUrl(new URL('https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API'))).toEqual({
      host: 'developer.mozilla.org',
      scopeKey: 'mdn-web-api',
      scopeTitle: 'MDN Web: API',
    });
  });

  it('collects only the current MDN Web section from the sidebar', () => {
    jsdom.reconfigure({ url: 'https://developer.mozilla.org/en-US/docs/Web/CSS?utm_source=chatgpt.com' });
    document.body.innerHTML = `
      <nav class="left-sidebar">
        <a href="/en-US/docs/Web/CSS" aria-current="page">CSS</a>
        <a href="/en-US/docs/Web/CSS/Guides/Animations">Animations</a>
        <a href="/en-US/docs/Web/CSS/Guides/Animations">Animations duplicate</a>
        <a href="/en-US/docs/Web/HTML">HTML</a>
      </nav>
      <main id="content"><div class="layout__body">CSS article</div></main>
    `;
    expect(MdnAdapter.getDocScope()).toEqual({
      host: 'developer.mozilla.org',
      scopeKey: 'mdn-web-css',
      scopeTitle: 'MDN Web: CSS',
    });
    expect(MdnAdapter.getSidebarLinks().map((link) => [link.url, link.title])).toEqual([
      ['https://developer.mozilla.org/en-US/docs/Web/CSS', 'CSS'],
      ['https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Animations', 'Animations'],
    ]);
    expect(MdnAdapter.getArticleRoot()?.textContent).toBe('CSS article');
    expect(MdnAdapter.isPageIndexable?.()).toBe(true);
  });

  it('does not index the Web landing page because its sidebar only lists child scopes', () => {
    jsdom.reconfigure({ url: 'https://developer.mozilla.org/en-US/docs/Web' });
    document.body.innerHTML = `
      <nav class="left-sidebar"><a href="/en-US/docs/Web/CSS">CSS</a></nav>
      <main id="content"><div class="layout__body">Web landing page</div></main>
    `;
    expect(MdnAdapter.isPageIndexable?.()).toBe(false);
    expect(MdnAdapter.getSidebarLinks()).toEqual([]);
  });

  it('uses the MDN API landing page content when that page has no left sidebar', () => {
    jsdom.reconfigure({ url: 'https://developer.mozilla.org/en-US/docs/Web/API' });
    document.body.innerHTML = `
      <main id="content">
        <a href="/en-US/docs/Web/API">Web APIs</a>
        <a href="/en-US/docs/Web/API/Fetch_API">Fetch API</a>
        <a href="/en-US/docs/Web/CSS">CSS</a>
      </main>
    `;

    expect(MdnAdapter.getSidebarLinks().map((link) => link.url)).toEqual([
      'https://developer.mozilla.org/en-US/docs/Web/API',
      'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API',
    ]);
    expect(MdnAdapter.isPageIndexable?.()).toBe(true);
  });
});
