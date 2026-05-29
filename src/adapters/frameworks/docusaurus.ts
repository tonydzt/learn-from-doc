import { createFrameworkAdapter } from './common';

// Manual test sites:
// - React Native Docs, https://reactnative.dev/docs/getting-started ✅
// - Jest, https://jestjs.io/docs/getting-started ✅
// - WebdriverIO, https://webdriver.io/docs/gettingstarted/ ✅
export const DocusaurusAdapter = createFrameworkAdapter({
  id: 'framework-docusaurus',
  frameworkName: 'Docusaurus',
  sidebarSelectors: [
    'nav[aria-label="Docs sidebar"]',
    'aside nav.menu',
    '.theme-doc-sidebar-menu',
  ],
  articleSelectors: [
    'main article',
    'article[itemprop="articleBody"]',
    'article',
  ],
  signatureSelectors: [
    'script#__docusaurus',
    '.theme-doc-sidebar-menu',
    '.menu__link',
  ],
  expandableSelectors: [
    'button[aria-expanded="false"]',
    'a[role="button"][aria-expanded="false"]',
    'a.menu__link--sublist[aria-expanded="false"]',
    '.menu__list-item--collapsed > .menu__list-item-collapsible .menu__caret',
    '.theme-doc-sidebar-item-category--collapsed > .menu__list-item-collapsible .menu__caret',
  ],
});
