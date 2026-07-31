import { getAdapterForUrl } from '../adapters';
import type { SiteRecord } from '../storage/db';

function firstPathSegment(pathname: string): string | undefined {
  return pathname.split('/').filter(Boolean)[0];
}

export function indexedScopeForUrl(input: string, sites: SiteRecord[]): SiteRecord | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const adapter = getAdapterForUrl(input);

  return sites.find((site) => {
    if (site.host !== url.hostname) return false;
    if (adapter?.matchesIndexedScopeForUrl) {
      return adapter.matchesIndexedScopeForUrl(url, site);
    }
    if (site.scopeKey === 'root') return true;
    return firstPathSegment(url.pathname) === site.scopeKey;
  }) ?? null;
}
