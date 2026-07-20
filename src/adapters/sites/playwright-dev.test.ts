import { PlaywrightDevAdapter } from './playwright-dev';

describe('PlaywrightDevAdapter', () => {
  it('matches Playwright documentation scopes', () => {
    expect(PlaywrightDevAdapter.matches(new URL('https://playwright.dev/docs/intro'))).toBe(true);
    expect(PlaywrightDevAdapter.matches(new URL('https://playwright.dev/docs'))).toBe(true);
    expect(PlaywrightDevAdapter.matches(new URL('https://playwright.dev/docs/writing-tests'))).toBe(true);
    expect(PlaywrightDevAdapter.matches(new URL('https://playwright.dev/docs/api/class-playwright'))).toBe(true);
    expect(PlaywrightDevAdapter.matches(new URL('https://playwright.dev/python/docs/intro'))).toBe(true);
    expect(PlaywrightDevAdapter.matches(new URL('https://playwright.dev/python/docs/api/class-playwright'))).toBe(true);
    expect(PlaywrightDevAdapter.matches(new URL('https://playwright.dev/java/docs/intro'))).toBe(true);
    expect(PlaywrightDevAdapter.matches(new URL('https://playwright.dev/java/docs/api/class-playwright'))).toBe(true);
    expect(PlaywrightDevAdapter.matches(new URL('https://playwright.dev/dotnet/docs/intro'))).toBe(true);
    expect(PlaywrightDevAdapter.matches(new URL('https://playwright.dev/dotnet/docs/api/class-playwright'))).toBe(true);
    expect(PlaywrightDevAdapter.matches(new URL('https://playwright.dev/mcp/introduction'))).toBe(true);
    expect(PlaywrightDevAdapter.matches(new URL('https://example.com/docs/intro'))).toBe(false);
  });

  it('returns stable scopes for Playwright documentation trees', () => {
    expect(PlaywrightDevAdapter.getDocScopeForUrl(new URL('https://playwright.dev/docs/intro'))).toEqual({
      host: 'playwright.dev',
      scopeKey: 'playwright-docs',
      scopeTitle: 'Playwright Docs',
    });
    expect(PlaywrightDevAdapter.getDocScopeForUrl(new URL('https://playwright.dev/docs/api/class-playwright'))).toEqual({
      host: 'playwright.dev',
      scopeKey: 'playwright-docs-api',
      scopeTitle: 'Playwright API',
    });
    expect(PlaywrightDevAdapter.getDocScopeForUrl(new URL('https://playwright.dev/python/docs/intro'))).toEqual({
      host: 'playwright.dev',
      scopeKey: 'playwright-python-docs',
      scopeTitle: 'Playwright Python Docs',
    });
    expect(PlaywrightDevAdapter.getDocScopeForUrl(new URL('https://playwright.dev/python/docs/api/class-playwright'))).toEqual({
      host: 'playwright.dev',
      scopeKey: 'playwright-python-api',
      scopeTitle: 'Playwright Python API',
    });
    expect(PlaywrightDevAdapter.getDocScopeForUrl(new URL('https://playwright.dev/java/docs/intro'))).toEqual({
      host: 'playwright.dev',
      scopeKey: 'playwright-java-docs',
      scopeTitle: 'Playwright Java Docs',
    });
    expect(PlaywrightDevAdapter.getDocScopeForUrl(new URL('https://playwright.dev/java/docs/api/class-playwright'))).toEqual({
      host: 'playwright.dev',
      scopeKey: 'playwright-java-api',
      scopeTitle: 'Playwright Java API',
    });
    expect(PlaywrightDevAdapter.getDocScopeForUrl(new URL('https://playwright.dev/dotnet/docs/intro'))).toEqual({
      host: 'playwright.dev',
      scopeKey: 'playwright-dotnet-docs',
      scopeTitle: 'Playwright .NET Docs',
    });
    expect(PlaywrightDevAdapter.getDocScopeForUrl(new URL('https://playwright.dev/dotnet/docs/api/class-playwright'))).toEqual({
      host: 'playwright.dev',
      scopeKey: 'playwright-dotnet-api',
      scopeTitle: 'Playwright .NET API',
    });
    expect(PlaywrightDevAdapter.getDocScopeForUrl(new URL('https://playwright.dev/mcp/introduction'))).toEqual({
      host: 'playwright.dev',
      scopeKey: 'playwright-mcp',
      scopeTitle: 'Playwright MCP Docs',
    });
  });

  it('deduplicates sidebar links within the current Playwright docs scope', () => {
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

    expect(PlaywrightDevAdapter.getSidebarLinks().map((link) => link.url)).toEqual([
      'https://playwright.dev/docs/intro',
      'https://playwright.dev/docs/writing-tests',
    ]);
    expect(PlaywrightDevAdapter.getSidebarLinks()[0].title).toBe('Installation');
  });

  it('filters sidebar links to the API reference scope', () => {
    document.body.innerHTML = `
      <aside>
        <nav aria-label="Docs sidebar">
          <a href="https://playwright.dev/docs/api/class-playwright">Playwright Library</a>
          <a href="https://playwright.dev/docs/api/class-browser">Browser</a>
          <a href="https://playwright.dev/docs/intro">Installation</a>
          <a href="https://playwright.dev/python/docs/api/class-playwright">Python API</a>
        </nav>
      </aside>
      <main><article>Body</article></main>
    `;

    expect(PlaywrightDevAdapter.getSidebarLinks().map((link) => link.url)).toEqual([
      'https://playwright.dev/docs/api/class-playwright',
      'https://playwright.dev/docs/api/class-browser',
    ]);
  });

  it('finds the article root', () => {
    document.body.innerHTML = '<main><article>Playwright article</article></main>';

    expect(PlaywrightDevAdapter.getArticleRoot()?.textContent).toBe('Playwright article');
  });

  it('expands anchor-based sidebar toggles before collecting links', async () => {
    document.body.innerHTML = `
      <aside>
        <nav aria-label="Docs sidebar">
          <a href="https://playwright.dev/docs/intro">Installation</a>
          <a class="menu__link menu__link--sublist menu__link--sublist-caret" role="button" aria-expanded="false" href="#">Integrations</a>
        </nav>
      </aside>
      <main><article>Body</article></main>
    `;
    const nav = document.querySelector('nav[aria-label="Docs sidebar"]');
    const integrations = nav?.querySelector<HTMLAnchorElement>('a[role="button"]');
    integrations?.addEventListener('click', (event) => {
      event.preventDefault();
      integrations.setAttribute('aria-expanded', 'true');
      integrations.insertAdjacentHTML('afterend', `
        <a href="https://playwright.dev/docs/docker">Docker</a>
        <a href="https://playwright.dev/docs/ci">Continuous Integration</a>
        <a href="https://playwright.dev/docs/selenium-grid">Selenium Grid (experimental)</a>
      `);
    });

    expect(PlaywrightDevAdapter.getSidebarLinks().map((link) => link.url)).not.toContain('https://playwright.dev/docs/docker');

    await PlaywrightDevAdapter.expandLazyNavigation();

    expect(PlaywrightDevAdapter.getSidebarLinks().map((link) => link.url)).toEqual([
      'https://playwright.dev/docs/intro',
      'https://playwright.dev/docs/docker',
      'https://playwright.dev/docs/ci',
      'https://playwright.dev/docs/selenium-grid',
    ]);
  });

  it('keeps expanding newly rendered collapsed sidebar toggles', async () => {
    document.body.innerHTML = `
      <aside>
        <nav aria-label="Docs sidebar">
          <a href="https://playwright.dev/docs/intro">Installation</a>
          <a class="menu__link menu__link--sublist menu__link--sublist-caret" role="button" aria-expanded="false" href="#">Integrations</a>
        </nav>
      </aside>
      <main><article>Body</article></main>
    `;
    const nav = document.querySelector('nav[aria-label="Docs sidebar"]');
    const integrations = nav?.querySelector<HTMLAnchorElement>('a[role="button"]');
    integrations?.addEventListener('click', (event) => {
      event.preventDefault();
      integrations.setAttribute('aria-expanded', 'true');
      integrations.insertAdjacentHTML('afterend', `
        <a class="menu__link menu__link--sublist" role="button" aria-expanded="false" href="#">Containers</a>
      `);
      nav?.querySelector<HTMLAnchorElement>('a[aria-expanded="false"]')?.addEventListener('click', (nestedEvent) => {
        nestedEvent.preventDefault();
        const containers = nestedEvent.currentTarget as HTMLAnchorElement;
        containers.setAttribute('aria-expanded', 'true');
        containers.insertAdjacentHTML('afterend', '<a href="https://playwright.dev/docs/docker">Docker</a>');
      });
    });

    await PlaywrightDevAdapter.expandLazyNavigation();

    expect(PlaywrightDevAdapter.getSidebarLinks().map((link) => link.url)).toContain('https://playwright.dev/docs/docker');
  });
});
