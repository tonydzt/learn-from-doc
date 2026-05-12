import { OpenAICodexAdapter } from './openai-codex';
import { PlaywrightDevAdapter } from './playwright-dev';
import { ReactDevAdapter } from './react-dev';
import type { DocScope, DocSiteAdapter } from './types';

export const adapters: DocSiteAdapter[] = [ReactDevAdapter, PlaywrightDevAdapter, OpenAICodexAdapter];

export function getAdapterForUrl(input: string): DocSiteAdapter | null {
  const url = new URL(input);
  return adapters.find((adapter) => adapter.matches(url)) ?? null;
}

export function getScopeForUrl(input: string): DocScope | null {
  const url = new URL(input);
  return adapters.find((adapter) => adapter.matches(url))?.getDocScopeForUrl(url) ?? null;
}
