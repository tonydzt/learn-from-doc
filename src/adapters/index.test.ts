import { getAdapterForPage, getAdapterForUrl, getScopeForPage, getScopeForUrl } from '.';

describe('adapter index', () => {
  it('returns the adapter for each supported docs site', () => {
    expect(getAdapterForUrl('https://react.dev/learn')?.id).toBe('react-dev');
    expect(getAdapterForUrl('https://playwright.dev/docs/intro')?.id).toBe('playwright-dev');
    expect(getAdapterForUrl('https://developers.openai.com/codex')?.id).toBe('openai-codex');
    expect(getAdapterForUrl('https://developers.openai.com/api/docs')?.id).toBe('openai-codex');
    expect(getAdapterForUrl('https://developer.mozilla.org/en-US/docs/Web/CSS')?.id).toBe('mdn');
  });

  it('prefers site adapters before framework adapters on matching urls', () => {
    document.body.innerHTML = `
      <nav aria-label="Docs sidebar">
        <a class="menu__link" href="https://playwright.dev/docs/intro">Intro</a>
      </nav>
      <main><article>Body</article></main>
      <script id="__docusaurus"></script>
    `;

    expect(getAdapterForPage('https://playwright.dev/docs/intro')?.id).toBe('playwright-dev');
  });

  it('falls back to a framework adapter when no site adapter matches', () => {
    document.body.innerHTML = `
      <nav aria-label="Docs sidebar">
        <a class="menu__link" href="https://example.com/docs/intro">Intro</a>
      </nav>
      <main><article>Body</article></main>
      <script id="__docusaurus"></script>
    `;

    expect(getAdapterForUrl('https://example.com/docs/intro')).toBeNull();
    expect(getAdapterForPage('https://example.com/docs/intro')?.id).toBe('framework-docusaurus');
    expect(getScopeForPage('https://example.com/docs/intro')).toEqual({
      host: 'example.com',
      scopeKey: 'docs',
      scopeTitle: 'Docusaurus Docs',
      frameworkName: 'Docusaurus',
    });
  });

  it('does not match weak framework-like pages without a sidebar and article', () => {
    document.body.innerHTML = '<main><p>Marketing page</p></main>';

    expect(getAdapterForPage('https://example.com/')).toBeNull();
  });

  it('returns popup-compatible scopes for supported urls', () => {
    expect(getScopeForUrl('https://react.dev/reference/react/useState')).toEqual({
      host: 'react.dev',
      scopeKey: 'reference-react',
      scopeTitle: 'React Reference',
    });
    expect(getScopeForUrl('https://react.dev/reference/react-dom/client/createRoot')).toEqual({
      host: 'react.dev',
      scopeKey: 'reference-react',
      scopeTitle: 'React Reference',
    });
    expect(getScopeForUrl('https://react.dev/community/team')).toEqual({
      host: 'react.dev',
      scopeKey: 'community',
      scopeTitle: 'React Community',
    });
    expect(getScopeForUrl('https://react.dev/blog/2026/02/24/the-react-foundation')).toEqual({
      host: 'react.dev',
      scopeKey: 'blog',
      scopeTitle: 'React Blog',
    });
    expect(getScopeForUrl('https://playwright.dev/docs/intro')).toEqual({
      host: 'playwright.dev',
      scopeKey: 'playwright-docs',
      scopeTitle: 'Playwright Docs',
    });
    expect(getScopeForUrl('https://playwright.dev/docs/api/class-playwright')).toEqual({
      host: 'playwright.dev',
      scopeKey: 'playwright-docs-api',
      scopeTitle: 'Playwright API',
    });
    expect(getScopeForUrl('https://playwright.dev/python/docs/intro')).toEqual({
      host: 'playwright.dev',
      scopeKey: 'playwright-python-docs',
      scopeTitle: 'Playwright Python Docs',
    });
    expect(getScopeForUrl('https://playwright.dev/mcp/introduction')).toEqual({
      host: 'playwright.dev',
      scopeKey: 'playwright-mcp',
      scopeTitle: 'Playwright MCP Docs',
    });
    expect(getScopeForUrl('https://developers.openai.com/codex/quickstart')).toEqual({
      host: 'developers.openai.com',
      scopeKey: 'codex',
      scopeTitle: 'OpenAI Codex Docs',
    });
    expect(getScopeForUrl('https://developers.openai.com/community')).toEqual({
      host: 'developers.openai.com',
      scopeKey: 'codex',
      scopeTitle: 'OpenAI Codex Docs',
    });
    expect(getScopeForUrl('https://developers.openai.com/api/docs')).toEqual({
      host: 'developers.openai.com',
      scopeKey: 'codex',
      scopeTitle: 'OpenAI Codex Docs',
    });
    expect(getScopeForUrl('https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Animations')).toEqual({
      host: 'developer.mozilla.org',
      scopeKey: 'mdn-web-css',
      scopeTitle: 'MDN Web: CSS',
    });
    expect(getScopeForUrl('https://playwright.dev/python')).toBeNull();
  });
});
