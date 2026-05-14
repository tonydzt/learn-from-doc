import { createFrameworkAdapter } from './common';

// Typical test site: Netlify Docs, https://docs.netlify.com/
export const StarlightAdapter = createFrameworkAdapter({
  id: 'framework-starlight',
  frameworkName: 'Starlight',
  sidebarSelectors: [
    'starlight-sidebar',
    '.sidebar-pane',
    'nav[aria-label="Main"]',
  ],
  articleSelectors: [
    'main .sl-markdown-content',
    '.sl-markdown-content',
    'main article',
  ],
  signatureSelectors: [
    'starlight-sidebar',
    '.sl-markdown-content',
    'meta[name="generator"][content*="Astro"]',
  ],
  progressRootSelectors: [
    '.sidebar-content',
  ],
  expandableSelectors: [
    'button[aria-expanded="false"]',
    'summary',
  ],
});
