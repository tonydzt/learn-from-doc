import { ReactDevAdapter } from './react-dev';

describe('ReactDevAdapter', () => {
  it('matches supported React docs paths only', () => {
    expect(ReactDevAdapter.matches(new URL('https://react.dev/learn'))).toBe(true);
    expect(ReactDevAdapter.matches(new URL('https://react.dev/reference/react/useState'))).toBe(true);
    expect(ReactDevAdapter.matches(new URL('https://react.dev/blog'))).toBe(false);
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
});
