import { createFrameworkAdapter } from './common';

// Manual test sites:
// - shadcn/ui Docs, https://ui.shadcn.com/docs ✅
// - Fumadocs, https://www.fumadocs.dev/docs/ui ✅
// - Flags SDK, https://flags-sdk.dev/docs/frameworks/next ✅
export const FumadocsAdapter = createFrameworkAdapter({
  id: 'framework-fumadocs',
  frameworkName: 'Fumadocs',
  sidebarSelectors: [
    '[data-fumadocs-sidebar]',
    'aside[data-fumadocs-sidebar]',
    'aside[data-fd-sidebar]',
    '[data-sidebar="content"]',
    '[data-sidebar="sidebar"]',
    '[class*="grid-area:sidebar"]',
  ],
  articleSelectors: [
    '[data-fumadocs-page] article',
    '[data-fd-page] article',
    'main[data-fumadocs-page]',
    '[data-slot="docs"]',
    'main article',
    'article[class*="grid-area:main"]',
  ],
  signatureSelectors: [
    '[data-fumadocs-sidebar]',
    '[data-fumadocs-page]',
    '[data-fd-sidebar]',
    '[data-fd-page]',
    '[data-slot="docs"] [data-sidebar="content"], main [data-sidebar="content"]',
    '[data-sidebar="menu"]',
    '[class*="--fd-docs-height"] [class*="grid-area:sidebar"]',
  ],
  expandableSelectors: [
    'button[aria-expanded="false"]',
    '[data-state="closed"] button',
  ],
  // TODO: 这个参数其实更应该是网站级别的，而不是框架级别的，目前先放在这，后面再优化
  includeNextFlightPageLinks: true,
});
