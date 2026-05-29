import { INDEXING_HASH } from './constants';

export function normalizePageUrl(input: string): string {
  const url = new URL(input);
  url.hash = '';
  url.searchParams.sort();
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

export function withIndexingHash(input: string): string {
  const url = new URL(input);
  url.hash = INDEXING_HASH;
  return url.toString();
}

export function isIndexingUrl(input: string): boolean {
  return new URL(input).hash.includes(INDEXING_HASH);
}

export function siteIdFor(host: string, scopeKey: string): string {
  return `${host}::${scopeKey}`;
}
