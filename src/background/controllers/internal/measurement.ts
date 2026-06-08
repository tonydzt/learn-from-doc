import { lfdDebug } from '../../../shared/logger';
import type { BackgroundHandler } from '../../types';
import { isDebugIndexingLogsEnabled } from '../../services/settings';

export const handleMeasurementMessage: BackgroundHandler = (message, sender, context) => {
  if (message.type !== 'INDEX_PAGE_MEASURED') return undefined;

  const tabId = sender.tab?.id;
  const pending = tabId == null ? undefined : context.pendingMeasurements.get(tabId);
  void isDebugIndexingLogsEnabled().then((enabled) => {
    if (!enabled) return;
    lfdDebug('measurement message received', {
      tabId,
      matched: Boolean(pending),
      payload: message.payload,
    });
  });
  if (!pending || tabId == null) return { ok: false, matched: false };
  context.pendingMeasurements.delete(tabId);
  globalThis.clearTimeout(pending.timeout);
  pending.resolve(message.payload);
  return { ok: true, matched: true };
};
