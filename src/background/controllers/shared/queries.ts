import type { BackgroundHandler } from '../../types';
import {
  getIndexedScopeForUrl,
  getSiteSnapshot,
} from '../../services/sites';
import {
  getAppSettings,
  getSiteSettings,
} from '../../services/settings';

export const handleSharedQueryMessages: BackgroundHandler = (message) => {
  if (message.type === 'GET_INDEXED_SCOPE_FOR_URL') return getIndexedScopeForUrl(message.url);

  if (message.type === 'GET_SITE_SNAPSHOT') return getSiteSnapshot(message.siteId);

  if (message.type === 'GET_SITE_SETTINGS') return getSiteSettings(message.siteId);

  if (message.type === 'GET_APP_SETTINGS') return getAppSettings();

  return undefined;
};
