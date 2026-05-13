import { getAdapterForUrl, getScopeForUrl } from '.';

describe('adapter index', () => {
  it('returns the adapter for each supported docs site', () => {
    expect(getAdapterForUrl('https://react.dev/learn')?.id).toBe('react-dev');
    expect(getAdapterForUrl('https://playwright.dev/docs/intro')?.id).toBe('playwright-dev');
    expect(getAdapterForUrl('https://developers.openai.com/codex')?.id).toBe('openai-codex');
    expect(getAdapterForUrl('https://developers.openai.com/api/docs')?.id).toBe('openai-codex');
  });

  it('returns popup-compatible scopes for supported urls', () => {
    expect(getScopeForUrl('https://react.dev/reference/react/useState')).toEqual({
      host: 'react.dev',
      scopeKey: 'reference-react',
      scopeTitle: 'React Reference',
    });
    expect(getScopeForUrl('https://playwright.dev/docs/intro')).toEqual({
      host: 'playwright.dev',
      scopeKey: 'playwright-docs',
      scopeTitle: 'Playwright Docs',
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
    expect(getScopeForUrl('https://playwright.dev/python/docs/intro')).toBeNull();
  });
});
