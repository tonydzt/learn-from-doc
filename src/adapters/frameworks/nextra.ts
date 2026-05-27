import { createFrameworkAdapter } from './common';

// Manual test sites:
// - Nextra Docs, https://nextra.site/docs
// - Docs Demo App, https://docs-demo-app.vercel.app/
// - React Flow, https://reactflow.dev/learn
export const NextraAdapter = createFrameworkAdapter({
  id: 'framework-nextra',
  frameworkName: 'Nextra',
  sidebarSelectors: [
    '.nextra-sidebar',
    'aside.nextra-sidebar',
    'aside[class*="nextra-sidebar"]',
  ],
  articleSelectors: [
    'main.nextra-content article',
    '.nextra-content article',
    'article.nextra-content',
    'main article',
    'article',
  ],
  signatureSelectors: [
    '.nextra-sidebar',
    '.nextra-nav-container',
    'script#__NEXT_DATA__',
  ],
  expandableSelectors: [
    'button[aria-expanded="false"]',
    'summary',
  ],
});
