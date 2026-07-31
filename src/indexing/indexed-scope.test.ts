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

  it('matches every path on the host for a root-wide framework scope', () => {
    const sites = [site('docs.sillytavern.app', 'root')];

    expect(indexedScopeForUrl('https://docs.sillytavern.app/usage/', sites)?.siteId).toBe('docs.sillytavern.app::root');
    expect(indexedScopeForUrl('https://docs.sillytavern.app/installation/windows/', sites)?.siteId).toBe('docs.sillytavern.app::root');
    expect(indexedScopeForUrl('https://example.com/usage/', sites)).toBeNull();
  });

  it('uses an adapter-specific indexed scope matcher when available', () => {
    const sites = [site('docs.docker.com', 'docker-manuals')];

    expect(indexedScopeForUrl('https://docs.docker.com/desktop/install/mac-install/', sites)?.siteId)
      .toBe('docs.docker.com::docker-manuals');
    expect(indexedScopeForUrl('https://docs.docker.com/engine/storage/', sites)?.siteId)
      .toBe('docs.docker.com::docker-manuals');
    expect(indexedScopeForUrl('https://docs.docker.com/support/', sites)?.siteId)
      .toBe('docs.docker.com::docker-manuals');
    expect(indexedScopeForUrl('https://docs.docker.com/guides/nodejs/', sites)).toBeNull();
  });
});
