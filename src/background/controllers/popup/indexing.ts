import type { BackgroundHandler } from '../../types';
import { startIndex } from '../../services/indexing';
import { logIndexFailureToSourceTab } from '../../services/tabs';

export const handlePopupMessages: BackgroundHandler = (message, _sender, context) => {
  if (message.type === 'GET_INDEX_RUN_PROGRESS') return context.indexRunProgress.get();

  if (message.type !== 'START_INDEX') return undefined;

  return startIndex(context, message.tabId).catch(async (error: unknown) => {
    context.indexRunProgress.clearSoon();
    await logIndexFailureToSourceTab(message.tabId, error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Indexing failed.',
    };
  });
};
