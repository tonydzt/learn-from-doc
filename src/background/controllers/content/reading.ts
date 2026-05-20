import { browser } from 'wxt/browser';
import type { BackgroundHandler } from '../../types';
import {
  getPage,
  getPages,
  getProgressForSite,
  saveProgress,
} from '../../services/sites';

export const handleContentMessages: BackgroundHandler = (message) => {
  if (message.type === 'HAS_ORIGIN_PERMISSION') {
    return browser.permissions.contains({ origins: [message.origin] });
  }

  if (message.type === 'GET_SITE_PAGES') return getPages(message.siteId);

  if (message.type === 'GET_PAGE_RECORD') return getPage(message.siteId, message.url);

  if (message.type === 'GET_SITE_PROGRESS') return getProgressForSite(message.siteId);

  if (message.type === 'SAVE_PROGRESS_RECORD') {
    return saveProgress(message.siteId, message.url, message.ranges, message.contentHeight);
  }

  return undefined;
};
