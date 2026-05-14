import { OpenAICodexAdapter } from './openai-codex';

describe('OpenAICodexAdapter', () => {
  it('matches OpenAI developer paths for Codex index placeholders', () => {
    expect(OpenAICodexAdapter.matches(new URL('https://developers.openai.com/codex'))).toBe(true);
    expect(OpenAICodexAdapter.matches(new URL('https://developers.openai.com/codex/quickstart'))).toBe(true);
    expect(OpenAICodexAdapter.matches(new URL('https://developers.openai.com/community'))).toBe(true);
    expect(OpenAICodexAdapter.matches(new URL('https://developers.openai.com/community/meetups'))).toBe(true);
    expect(OpenAICodexAdapter.matches(new URL('https://developers.openai.com/api/docs'))).toBe(true);
    expect(OpenAICodexAdapter.matches(new URL('https://developers.openai.com/cookbook'))).toBe(true);
    expect(OpenAICodexAdapter.matches(new URL('https://example.com/codex'))).toBe(false);
  });

  it('deduplicates sidebar links within Codex scope', () => {
    document.body.innerHTML = `
      <nav data-left-nav data-left-nav-id="/codex">
        <a href="https://developers.openai.com/codex">Codex</a>
        <a href="https://developers.openai.com/codex">Duplicate</a>
        <a href="https://developers.openai.com/codex/quickstart">Quickstart</a>
        <a href="https://developers.openai.com/api/docs">API docs</a>
        <a href="https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide">Cookbook</a>
        <a href="https://openai.com">Company</a>
      </nav>
      <main><article id="mainContent">Body</article></main>
    `;

    expect(OpenAICodexAdapter.getDocScopeForUrl(new URL('https://developers.openai.com/codex'))).toEqual({
      host: 'developers.openai.com',
      scopeKey: 'codex',
      scopeTitle: 'OpenAI Codex Docs',
    });
    expect(OpenAICodexAdapter.getSidebarLinks().map((link) => link.url)).toEqual([
      'https://developers.openai.com/codex',
      'https://developers.openai.com/codex/quickstart',
      'https://developers.openai.com/api/docs',
      'https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide',
    ]);
  });

  it('includes Codex sidebar links that jump to child navigation directories', () => {
    document.body.innerHTML = `
      <nav data-left-nav data-left-nav-id="/codex">
        <a href="https://developers.openai.com/codex">Overview</a>
        <a href="https://developers.openai.com/codex/use-cases">Explore use cases</a>
        <a href="https://developers.openai.com/community">Community</a>
        <a href="https://developers.openai.com/community/meetups">Meetups</a>
      </nav>
    `;

    expect(OpenAICodexAdapter.getSidebarLinks().map((link) => link.url)).toEqual([
      'https://developers.openai.com/codex',
      'https://developers.openai.com/codex/use-cases',
      'https://developers.openai.com/community',
      'https://developers.openai.com/community/meetups',
    ]);
  });

  it('finds the main content article root', () => {
    document.body.innerHTML = '<main><article id="mainContent">Codex article</article></main>';

    expect(OpenAICodexAdapter.getArticleRoot()?.textContent).toBe('Codex article');
  });

  it('uses the changelog container as the article root on the Codex changelog page', () => {
    document.body.innerHTML = `
      <main>
        <div id="codex-changelog">
          <article>First release</article>
          <article>Second release</article>
        </div>
      </main>
    `;

    expect(OpenAICodexAdapter.getArticleRoot()?.id).toBe('codex-changelog');
    expect(OpenAICodexAdapter.getArticleRoot()?.textContent).toContain('Second release');
  });

  it('marks pages with a different left nav tree as not indexable', () => {
    document.body.innerHTML = `
      <nav data-left-nav data-left-nav-id="/codex/use-cases">
        <a href="https://developers.openai.com/codex/use-cases/customer-support">Customer support</a>
      </nav>
      <main><article id="mainContent">Use cases</article></main>
    `;

    expect(OpenAICodexAdapter.isPageIndexable?.()).toBe(false);
    expect(OpenAICodexAdapter.getSidebarLinks()).toEqual([]);
    expect(OpenAICodexAdapter.getProgressInsertionTargets()).toBeNull();
  });
});
