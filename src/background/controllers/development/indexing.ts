import type { BackgroundHandler } from '../../types';
import { runIndex } from '../popup/indexing';

export const handleDevelopmentIndexMessage: BackgroundHandler = (message, sender, context) => {
  if (message.type !== 'DEV_START_INDEX_FROM_PAGE') return undefined;
  if (!import.meta.env.DEV) return { ok: false, error: 'Development indexing is unavailable in production builds.' };
  if (sender.tab?.id == null) return { ok: false, error: 'No source tab found for development indexing.' };
  return runIndex(context, sender.tab.id);
};
