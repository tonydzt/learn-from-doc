import { INDEXING_HASH } from './constants';

export function normalizePageUrl(input: string): string {
  const url = new URL(input);
  url.hash = '';
  url.searchParams.sort();
  return url.toString();
}

export function withIndexingHash(input: string, debug = false): string {
  const url = new URL(input);
  url.hash = debug ? `${INDEXING_HASH}&lfd_debug=1` : INDEXING_HASH;
  return url.toString();
}

export function isIndexingUrl(input: string): boolean {
  return new URL(input).hash.includes(INDEXING_HASH);
}

export function isIndexingDebugUrl(input: string): boolean {
  return new URL(input).hash.includes('lfd_debug=1');
}

export function siteIdFor(host: string, scopeKey: string): string {
  return `${host}::${scopeKey}`;
}
