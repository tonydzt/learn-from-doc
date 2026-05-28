import { browser } from 'wxt/browser';
import { backgroundContext } from '../src/background/context';
import { errorDetails } from '../src/background/errors';
import { resumePendingIndexAfterPermission } from '../src/background/controllers/popup/indexing';
import { handleRuntimeMessage } from '../src/background/router';
import { maybeInjectIndexedTab } from '../src/background/services/tabs';
import type { RuntimeMessage } from '../src/shared/messages';
import { lfdDebug } from '../src/shared/logger';

export default defineBackground(() => {
  // WXT registers this callback as the MV3 background service worker entry.
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    void maybeInjectIndexedTab(tabId, tab.url).catch((error) => {
      lfdDebug('failed to auto-inject indexed tab after update', {
        tabId,
        url: tab.url,
        error: errorDetails(error),
      });
    });
  });

  browser.tabs.onActivated.addListener((activeInfo) => {
    void browser.tabs.get(activeInfo.tabId).then((tab) => {
      return maybeInjectIndexedTab(tab.id, tab.url);
    }).catch((error) => {
      lfdDebug('failed to auto-inject indexed tab after activation', {
        tabId: activeInfo.tabId,
        error: errorDetails(error),
      });
    });
  });

  browser.permissions.onAdded.addListener((permissions) => {
    const origins = permissions.origins ?? [];
    if (origins.length === 0) return;
    void resumePendingIndexAfterPermission(backgroundContext, origins).catch((error) => {
      lfdDebug('failed to resume pending index after permission grant', {
        origins,
        error: errorDetails(error),
      });
    });
  });

  browser.runtime.onMessage.addListener((message: RuntimeMessage, sender) => {
    return handleRuntimeMessage(message, sender, backgroundContext);
  });
});
