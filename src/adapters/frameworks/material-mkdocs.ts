import { createFrameworkAdapter } from './common';

// Manual test sites:
// - Pydantic Docs, https://docs.pydantic.dev/latest/ ❌ 跳到某些目录时，有概率发生阅读进度没渲染出来的问题，猜测有可能还是渲染时序的问题
// - FastAPI, https://fastapi.tiangolo.com/
// - Typer, https://typer.tiangolo.com/
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
