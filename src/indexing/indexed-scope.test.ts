import { indexedScopeForUrl } from './indexed-scope';
import type { SiteRecord } from '../storage/db';

function site(host: string, scopeKey: string): SiteRecord {
  return {
    siteId: `${host}::${scopeKey}`,
    host,
    scopeKey,
    scopeTitle: `${scopeKey} Docs`,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('indexedScopeForUrl', () => {
  it('matches framework-style indexed scopes by host and first path segment', () => {
    expect(indexedScopeForUrl('https://ui.shadcn.com/docs/components/button', [
      site('ui.shadcn.com', 'docs'),
    ])?.siteId).toBe('ui.shadcn.com::docs');
  });

  it('does not match a different host or path segment', () => {
    expect(indexedScopeForUrl('https://ui.shadcn.com/blocks', [
      site('ui.shadcn.com', 'docs'),
    ])).toBeNull();
    expect(indexedScopeForUrl('https://example.com/docs', [
      site('ui.shadcn.com', 'docs'),
    ])).toBeNull();
  });
});
