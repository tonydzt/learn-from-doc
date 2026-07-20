import type { BackgroundHandler } from '../../types';
import {
  applyPortableImport,
  exportPortableData,
  previewPortableImport,
} from '../../services/portable-data';
import {
  clearAllProgressForBackground,
  clearSiteProgressForBackground,
  deleteSiteIndexForBackground,
  getIndexOverviews,
} from '../../services/sites';
import {
  saveAppSettingsForBackground,
  saveSiteSettingsForBackground,
} from '../../services/settings';
import {
  getServerIndexAvailability,
  pullReviewServerIndex,
  pullServerIndex,
  uploadServerIndex,
} from '../../services/server-indexes';

export const handleOptionsMessages: BackgroundHandler = (message) => {
  if (message.type === 'GET_INDEX_OVERVIEWS') return getIndexOverviews();

  if (message.type === 'SAVE_SITE_SETTINGS') {
    return saveSiteSettingsForBackground(message.siteId, message.settings);
  }

  if (message.type === 'SAVE_APP_SETTINGS') return saveAppSettingsForBackground(message.settings);

  if (message.type === 'EXPORT_PORTABLE_DATA') {
    return exportPortableData(message.scope, message.siteId, message.includeProgress);
  }

  if (message.type === 'PREVIEW_PORTABLE_IMPORT') return previewPortableImport(message.payload);

  if (message.type === 'IMPORT_PORTABLE_DATA') return applyPortableImport(message.payload, message.overwriteSiteIds);

  if (message.type === 'GET_SERVER_INDEX_AVAILABILITY') {
    return getServerIndexAvailability(message.siteId);
  }

  if (message.type === 'PULL_SERVER_INDEX') {
    return pullServerIndex(message.siteId, message.overwrite);
  }

  if (message.type === 'PULL_REVIEW_SERVER_INDEX') {
    return pullReviewServerIndex(message.siteId, message.overwrite);
  }

  if (message.type === 'UPLOAD_SERVER_INDEX') {
    return uploadServerIndex(message.siteId);
  }

  if (message.type === 'CLEAR_SITE_PROGRESS') {
    return clearSiteProgressForBackground(message.siteId).then(() => ({ ok: true }));
  }

  if (message.type === 'CLEAR_ALL_PROGRESS') {
    return clearAllProgressForBackground().then(() => ({ ok: true }));
  }

  if (message.type === 'DELETE_SITE_INDEX') {
    return deleteSiteIndexForBackground(message.siteId).then(() => ({ ok: true }));
  }

  return undefined;
};
