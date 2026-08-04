import { getAdapterForUrl } from '..';
import { GitHubDocsAdapter } from './github-docs';

describe('GitHubDocsAdapter', () => {
  afterEach(() => {
    jsdom.reconfigure({ url: 'https://react.dev/learn' });
  });

  it('uses product scopes retrieved from the English GitHub Docs homepage', () => {
    expect(GitHubDocsAdapter.getDocScopeForUrl(new URL(
      'https://docs.github.com/en/get-started/start-your-journey/what-is-github?utm_source=chatgpt.com',
    ))).toEqual({
      host: 'docs.github.com',
      scopeKey: 'get-started',
      scopeTitle: 'GitHub Docs: Get started',
    });
    expect(GitHubDocsAdapter.getDocScopeForUrl(new URL(
      'https://docs.github.com/en/copilot/how-tos/copilot-cli',
    ))).toEqual({
      host: 'docs.github.com',
      scopeKey: 'copilot',
      scopeTitle: 'GitHub Docs: GitHub Copilot',
    });
    expect(GitHubDocsAdapter.getDocScopeForUrl(new URL(
      'https://docs.github.com/en/enterprise-cloud@latest/admin/overview',
    ))).toEqual({
      host: 'docs.github.com',
      scopeKey: 'admin',
      scopeTitle: 'GitHub Docs: Enterprise administrators',
    });
  });

  it('rejects the homepage, unknown products, other languages, and other hosts', () => {
    expect(GitHubDocsAdapter.matches(new URL('https://docs.github.com/en?utm_source=chatgpt.com'))).toBe(false);
    expect(GitHubDocsAdapter.matches(new URL('https://docs.github.com/en/unknown-product'))).toBe(false);
    expect(GitHubDocsAdapter.matches(new URL('https://docs.github.com/en/toString'))).toBe(false);
    expect(GitHubDocsAdapter.matches(new URL('https://docs.github.com/ja/get-started'))).toBe(false);
    expect(GitHubDocsAdapter.matches(new URL('https://example.com/en/get-started'))).toBe(false);
  });

  it('is registered as the built-in adapter for supported GitHub Docs urls', () => {
    expect(getAdapterForUrl('https://docs.github.com/en/get-started')?.id).toBe('github-docs');
  });

  it('collects and deduplicates only links in the current product scope', () => {
    jsdom.reconfigure({ url: 'https://docs.github.com/en/get-started' });
    document.body.innerHTML = `
      <nav aria-label="Documentation navigation">
        <a href="/en/get-started">Get started</a>
        <a href="#">Start your journey</a>
        <a href="/en/get-started/start-your-journey/what-is-github">What is GitHub?</a>
        <a href="/en/get-started/start-your-journey/what-is-github">Duplicate</a>
        <a href="/en/copilot">GitHub Copilot</a>
      </nav>
      <nav aria-label="Product sidebar">
        <a href="#">Start your journey</a>
        <a href="/en/get-started/start-your-journey/what-is-github">What is GitHub?</a>
      </nav>
      <main id="main-content">Product landing</main>
    `;

    expect(GitHubDocsAdapter.getSidebarLinks().map((link) => [link.url, link.title])).toEqual([
      ['https://docs.github.com/en/get-started', 'Get started'],
      [
        'https://docs.github.com/en/get-started/start-your-journey/what-is-github',
        'What is GitHub?',
      ],
    ]);
    expect(GitHubDocsAdapter.getArticleRoot()?.textContent).toBe('Product landing');
    expect(GitHubDocsAdapter.isPageIndexable?.()).toBe(true);
  });

  it('uses GitHub Docs semantic attributes for article content and progress targets', () => {
    jsdom.reconfigure({
      url: 'https://docs.github.com/en/get-started/start-your-journey/what-is-github',
    });
    document.body.innerHTML = `
      <nav aria-label="Documentation navigation">
        <a href="/en/get-started">Get started</a>
        <a href="/en/get-started/start-your-journey/what-is-github">What is GitHub?</a>
      </nav>
      <nav aria-label="Product sidebar">
        <div>Navigation title</div>
        <a href="/en/get-started/start-your-journey/what-is-github">What is GitHub?</a>
        <a href="/en/copilot">GitHub Copilot</a>
      </nav>
      <main id="main-content">
        <div data-container="article" data-search="article-body">Article body</div>
      </main>
    `;

    expect(GitHubDocsAdapter.getArticleRoot()?.textContent).toBe('Article body');
    expect(GitHubDocsAdapter.getProgressInsertionTargets()?.sidebarRoot)
      .toBe(document.querySelector('nav[aria-label="Product sidebar"]'));
    expect(GitHubDocsAdapter.getProgressInsertionTargets()?.pageLinkTargets.map((item) => item.url))
      .toEqual(['https://docs.github.com/en/get-started/start-your-journey/what-is-github']);
  });

  it('waits for GitHub Docs article images before indexing', async () => {
    jsdom.reconfigure({ url: 'https://docs.github.com/en/get-started' });
    document.body.innerHTML = `
      <main id="main-content">
        <div data-container="article" data-search="article-body">
          <img loading="lazy">
        </div>
      </main>
    `;
    const image = document.querySelector('img')!;
    Object.defineProperty(image, 'loading', { configurable: true, value: 'lazy', writable: true });

    const waiting = GitHubDocsAdapter.waitForIndexMeasurement?.();
    image.dispatchEvent(new Event('load'));

    await expect(waiting).resolves.toBeUndefined();
    expect(image.loading).toBe('eager');
  });

  it('matches explicit GitHub Docs versions to the same indexed product scope', () => {
    const scope = {
      host: 'docs.github.com',
      scopeKey: 'get-started',
    };

    expect(GitHubDocsAdapter.matchesIndexedScopeForUrl?.(
      new URL('https://docs.github.com/en/enterprise-server@3.17/get-started/overview'),
      scope,
    )).toBe(true);
    expect(GitHubDocsAdapter.matchesIndexedScopeForUrl?.(
      new URL('https://docs.github.com/en/enterprise-cloud@latest/copilot/overview'),
      scope,
    )).toBe(false);
  });
});
