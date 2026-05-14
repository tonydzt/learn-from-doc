import { indexedScopeForUrl } from '../indexing/indexed-scope';
import type { SiteRecord } from '../storage/db';

export function originPermissionPatternForUrl(input: string | URL | undefined): string | null {
  if (!input) return null;
  try {
    const url = typeof input === 'string' ? new URL(input) : input;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return `${url.origin}/*`;
  } catch {
    return null;
  }
}

export function shouldRequestPersistentOriginPermission(input: {
  url: string | URL | undefined;
  adapterKind?: 'site' | 'framework';
}): boolean {
  return input.adapterKind === 'framework' && originPermissionPatternForUrl(input.url) != null;
}

export function indexedAutoInjectTargetForUrl(input: string | URL | undefined, sites: SiteRecord[]): {
  site: SiteRecord;
  originPattern: string;
} | null {
  const originPattern = originPermissionPatternForUrl(input);
  if (!originPattern || !input) return null;
  const site = indexedScopeForUrl(String(input), sites);
  return site ? { site, originPattern } : null;
}
