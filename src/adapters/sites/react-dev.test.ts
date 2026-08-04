import { ReactDevAdapter } from './react-dev';

describe('ReactDevAdapter', () => {
  it('matches supported React docs paths only', () => {
    expect(ReactDevAdapter.matches(new URL('https://react.dev/learn'))).toBe(true);
    expect(ReactDevAdapter.matches(new URL('https://react.dev/reference/react/useState'))).toBe(true);
    expect(ReactDevAdapter.matches(new URL('https://react.dev/reference/react-dom/client/createRoot'))).toBe(true);
    expect(ReactDevAdapter.matches(new URL('https://react.dev/community/team'))).toBe(true);
    expect(ReactDevAdapter.matches(new URL('https://react.dev/blog/2026/02/24/the-react-foundation'))).toBe(true);
    expect(ReactDevAdapter.matches(new URL('https://react.dev/blog'))).toBe(true);
    expect(ReactDevAdapter.matches(new URL('https://example.com/learn'))).toBe(false);
  });

  it('deduplicates sidebar links within the current scope', () => {
    document.body.innerHTML = `
      <aside>
        <nav>
          <a href="/learn">Learn</a>
          <a href="/learn">Learn duplicate</a>
          <a href="/learn/describing-the-ui">Describing UI</a>
          <a href="/reference/react/useState">useState</a>
        </nav>
      </aside>
      <main><article>Body</article></main>
    `;
    history.replaceState(null, '', 'https://react.dev/learn');

    expect(ReactDevAdapter.getDocScope()).toEqual({
      host: 'react.dev',
      scopeKey: 'learn',
      scopeTitle: 'Learn React',
    });
    expect(ReactDevAdapter.getSidebarLinks().map((link) => link.url)).toEqual([
      'https://react.dev/learn',
      'https://react.dev/learn/describing-the-ui',
    ]);
  });

  it('collects every React reference branch in one backwards-compatible scope', () => {
    document.body.innerHTML = `
      <aside>
        <nav>
          <a href="/reference/react/useState">useState</a>
          <a href="/reference/react-dom/client/createRoot">createRoot</a>
          <a href="/reference/react-compiler/configuration">Compiler configuration</a>
          <a href="/reference/rules/rules-of-hooks">Rules of Hooks</a>
          <a href="/learn">Learn</a>
        </nav>
      </aside>
      <main><article>Body</article></main>
    `;
    history.replaceState(null, '', 'https://react.dev/reference/react');

    expect(ReactDevAdapter.getDocScope()).toEqual({
      host: 'react.dev',
      scopeKey: 'reference-react',
      scopeTitle: 'React Reference',
    });
    expect(ReactDevAdapter.getSidebarLinks().map((link) => link.url)).toEqual([
      'https://react.dev/reference/react/useState',
      'https://react.dev/reference/react-dom/client/createRoot',
      'https://react.dev/reference/react-compiler/configuration',
      'https://react.dev/reference/rules/rules-of-hooks',
    ]);
  });

  it('uses the article listing as the Blog scope navigation', () => {
    document.body.innerHTML = `
      <aside><nav><a href="/learn">Learn</a></nav></aside>
      <main>
        <article>
          <a href="/blog">Blog</a>
          <a href="/blog/2026/02/24/the-react-foundation">
            <h2>The React Foundation</h2>
            <p>Post summary</p>
          </a>
          <a href="/community">Community</a>
        </article>
      </main>
    `;
    history.replaceState(null, '', 'https://react.dev/blog');

    expect(ReactDevAdapter.getDocScope()).toEqual({
      host: 'react.dev',
      scopeKey: 'blog',
      scopeTitle: 'React Blog',
    });
    expect(ReactDevAdapter.getSidebarLinks().map(({ url, title }) => ({ url, title }))).toEqual([
      { url: 'https://react.dev/blog', title: 'Blog' },
      {
        url: 'https://react.dev/blog/2026/02/24/the-react-foundation',
        title: 'The React Foundation',
      },
    ]);
  });

  it('assigns Community pages to their own scope', () => {
    expect(ReactDevAdapter.getDocScopeForUrl(new URL('https://react.dev/community/team'))).toEqual({
      host: 'react.dev',
      scopeKey: 'community',
      scopeTitle: 'React Community',
    });
  });
});
