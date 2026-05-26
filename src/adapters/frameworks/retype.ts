import { createFrameworkAdapter } from './common';

// Typical test site: SillyTavern Docs, https://docs.sillytavern.app/
export const RetypeAdapter = createFrameworkAdapter({
  id: 'framework-retype',
  frameworkName: 'Retype',
  requiresIndexingLoadWait: true,
  sidebarSelectors: [
    '#retype-sidebar-left',
  ],
  articleSelectors: [
    '#retype-content',
  ],
  signatureSelectors: [
    'meta[name="generator"][content*="Retype"]',
  ],
  progressRootSelectors: [
    ':scope > .flex-1 .simplebar-content',
    ':scope > .flex-1',
  ],
});
