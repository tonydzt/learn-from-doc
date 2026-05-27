import { createFrameworkAdapter } from './common';

// Manual test sites:
// - Vite Docs, https://vite.dev/guide/
// - VitePress, https://vitepress.dev/guide/getting-started
// - Vitest, https://vitest.dev/guide/
export const VitePressAdapter = createFrameworkAdapter({
  id: 'framework-vitepress',
  frameworkName: 'VitePress',
  sidebarSelectors: [
    '.VPSidebar',
    'aside.VPSidebar',
    '.VPDocAside',
  ],
  articleSelectors: [
    '.VPDoc main',
    'main.VPDoc article',
    '.VPDoc article',
    '.vp-doc',
  ],
  signatureSelectors: [
    '.VPSidebar',
    '.VPDoc',
    '.VPNav',
  ],
  expandableSelectors: [
    'button[aria-expanded="false"]',
    '.VPSidebarItem.collapsed button',
  ],
});
