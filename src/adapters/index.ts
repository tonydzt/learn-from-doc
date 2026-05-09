import { ReactDevAdapter } from './react-dev';
import type { DocSiteAdapter } from './types';

export const adapters: DocSiteAdapter[] = [ReactDevAdapter];

export function getAdapterForUrl(input: string): DocSiteAdapter | null {
  const url = new URL(input);
  return adapters.find((adapter) => adapter.matches(url)) ?? null;
}
