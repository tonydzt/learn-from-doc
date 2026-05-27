import { createFrameworkAdapter } from './common';

// Manual test sites:
// - SillyTavern Docs, https://docs.sillytavern.app/
// - Camoufox, https://camoufox.com/
// - TurboStack Docs, https://docs.turbostack.app/
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
