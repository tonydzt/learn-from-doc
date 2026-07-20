import { browser } from 'wxt/browser';
import type { RuntimeMessage, StartIndexResult } from '../shared/messages';
import { lfdDebug } from '../shared/logger';

export const DEVELOPMENT_INDEX_SHORTCUT_READY_ATTR = 'data-developer-docs-progress-tracker-development-index-shortcut';

export function isDevelopmentIndexShortcut(event: KeyboardEvent): boolean {
  return event.code === 'KeyL'
    && event.ctrlKey
    && event.shiftKey
    && !event.altKey
    && !event.metaKey
    && !event.repeat;
}

async function requestDevelopmentIndex(): Promise<void> {
  const result = await browser.runtime.sendMessage({
    type: 'DEV_START_INDEX_FROM_PAGE',
  } satisfies RuntimeMessage) as StartIndexResult;

  if (result.ok) {
    lfdDebug('development index shortcut completed', {
      siteId: result.site.siteId,
      pageCount: result.pages.length,
    });
    return;
  }

  lfdDebug('development index shortcut failed', { error: result.error });
}

export function handleDevelopmentIndexShortcut(event: KeyboardEvent): void {
  if (!isDevelopmentIndexShortcut(event)) return;
  event.preventDefault();
  event.stopPropagation();
  lfdDebug('development index shortcut requested', { url: location.href });
  void requestDevelopmentIndex().catch((error: unknown) => {
    lfdDebug('development index shortcut request failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
