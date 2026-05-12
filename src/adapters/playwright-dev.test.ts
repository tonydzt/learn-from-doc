import { PlaywrightDevAdapter } from './playwright-dev';

describe('PlaywrightDevAdapter', () => {
  it('matches Playwright Node docs paths only', () => {
    expect(PlaywrightDevAdapter.matches(new URL('https://playwright.dev/docs/intro'))).toBe(true);
    expect(PlaywrightDevAdapter.matches(new URL('https://playwright.dev/docs'))).toBe(true);
    expect(PlaywrightDevAdapter.matches(new URL('https://playwright.dev/docs/writing-tests'))).toBe(true);
    expect(PlaywrightDevAdapter.matches(new URL('https://playwright.dev/python/docs/intro'))).toBe(false);
    expect(PlaywrightDevAdapter.matches(new URL('https://playwright.dev/mcp/introduction'))).toBe(false);
    expect(PlaywrightDevAdapter.matches(new URL('https://example.com/docs/intro'))).toBe(false);
  });

  it('deduplicates sidebar links within Playwright docs scope', () => {
    document.body.innerHTML = `
      <aside>
        <nav aria-label="Docs sidebar">
          <a class="menu__link menu__link--sublist" role="button" href="https://playwright.dev/docs/intro">Getting Started</a>
          <a href="https://playwright.dev/docs/intro">Installation</a>
          <a href="https://playwright.dev/docs/intro">Duplicate</a>
          <a href="https://playwright.dev/docs/writing-tests">Writing tests</a>
          <a href="https://playwright.dev/python/docs/intro">Python</a>
          <a href="https://playwright.dev/mcp/introduction">MCP</a>
        </nav>
      </aside>
      <main><article>Body</article></main>
    `;

    expect(PlaywrightDevAdapter.getDocScopeForUrl(new URL('https://playwright.dev/docs/intro'))).toEqual({
      host: 'playwright.dev',
      scopeKey: 'playwright-docs',
      scopeTitle: 'Playwright Docs',
    });
    expect(PlaywrightDevAdapter.getSidebarLinks().map((link) => link.url)).toEqual([
      'https://playwright.dev/docs/intro',
      'https://playwright.dev/docs/writing-tests',
    ]);
    expect(PlaywrightDevAdapter.getSidebarLinks()[0].title).toBe('Installation');
  });

  it('finds the article root', () => {
    document.body.innerHTML = '<main><article>Playwright article</article></main>';

    expect(PlaywrightDevAdapter.getArticleRoot()?.textContent).toBe('Playwright article');
  });
});
