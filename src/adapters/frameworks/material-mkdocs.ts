import { createFrameworkAdapter } from './common';

// Typical test site: Pydantic Docs, https://docs.pydantic.dev/latest/
export const MaterialMkDocsAdapter = createFrameworkAdapter({
  id: 'framework-material-mkdocs',
  frameworkName: 'Material for MkDocs',
  sidebarSelectors: [
    '.md-sidebar--primary .md-nav',
    '.md-sidebar--primary',
    'nav.md-nav',
  ],
  articleSelectors: [
    '.md-content__inner',
    '.md-content article',
    '.md-main__inner .md-content',
  ],
  signatureSelectors: [
    '.md-sidebar--primary',
    '.md-nav',
    '.md-content',
    '.md-main__inner',
  ],
  expandableSelectors: [
    '.md-nav__toggle:not(:checked)',
    'label[for]',
    'button[aria-expanded="false"]',
  ],
});
