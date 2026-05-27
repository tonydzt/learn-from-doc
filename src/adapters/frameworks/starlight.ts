import { createFrameworkAdapter } from './common';

// Manual test sites:
// - Netlify Docs, https://docs.netlify.com/
// - Cloudflare Developer Docs, https://developers.cloudflare.com/
// - sharp, https://sharp.pixelplumbing.com/
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
