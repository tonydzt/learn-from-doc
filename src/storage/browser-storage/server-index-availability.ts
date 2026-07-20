import { browser } from 'wxt/browser';
import type { ServerIndexAvailabilityMessage } from '../../shared/messages';

export const SERVER_INDEX_AVAILABILITY_CACHE_KEY = 'serverIndexAvailabilityBySite';

type ServerIndexAvailabilityCache = Record<string, ServerIndexAvailabilityMessage>;

function normalizeAvailability(value: unknown): ServerIndexAvailabilityMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ServerIndexAvailabilityMessage>;
  if (typeof candidate.available !== 'boolean') return null;
  return {
    ...candidate,
    available: candidate.available,
    kinds: Array.isArray(candidate.kinds) ? candidate.kinds.filter((kind): kind is string => typeof kind === 'string') : [],
  };
}

function normalizeCache(value: unknown): ServerIndexAvailabilityCache {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const next: ServerIndexAvailabilityCache = {};
  for (const [siteId, availability] of Object.entries(value)) {
    const normalized = normalizeAvailability(availability);
    if (normalized) next[siteId] = normalized;
  }
  return next;
}

async function getCache(): Promise<ServerIndexAvailabilityCache> {
  const values = await browser.storage.local.get(SERVER_INDEX_AVAILABILITY_CACHE_KEY);
  return normalizeCache(values[SERVER_INDEX_AVAILABILITY_CACHE_KEY]);
}

export async function getCachedServerIndexAvailability(siteId: string): Promise<ServerIndexAvailabilityMessage | null> {
  const cache = await getCache();
  return cache[siteId] ?? null;
}

export async function saveCachedServerIndexAvailability(
  siteId: string,
  availability: ServerIndexAvailabilityMessage,
): Promise<void> {
  const cache = await getCache();
  await browser.storage.local.set({
    [SERVER_INDEX_AVAILABILITY_CACHE_KEY]: {
      ...cache,
      [siteId]: availability,
    },
  });
}
