import { FrameworkAdapters } from './frameworks';
import { SiteAdapters } from './sites';
import type { DocScope, DocSiteAdapter } from './types';

export const siteAdapters: DocSiteAdapter[] = SiteAdapters;
export const frameworkAdapters: DocSiteAdapter[] = FrameworkAdapters;
export const adapters: DocSiteAdapter[] = [...siteAdapters, ...frameworkAdapters];

export function getAdapterForUrl(input: string): DocSiteAdapter | null {
  const url = new URL(input);
  return siteAdapters.find((adapter) => adapter.matches(url)) ?? null;
}

export function getAdapterForPage(input: string): DocSiteAdapter | null {
  const url = new URL(input);
  return siteAdapters.find((adapter) => adapter.matches(url))
    ?? frameworkAdapters.find((adapter) => adapter.matches(url))
    ?? null;
}

export function getScopeForUrl(input: string): DocScope | null {
  const url = new URL(input);
  return siteAdapters.find((adapter) => adapter.matches(url))?.getDocScopeForUrl(url) ?? null;
}

export function getScopeForPage(input: string): DocScope | null {
  const url = new URL(input);
  return getAdapterForPage(input)?.getDocScopeForUrl(url) ?? null;
}
