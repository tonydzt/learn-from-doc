import { createFrameworkAdapter } from './common';

// Manual test sites:
// 这个组件里的网站，点击还是有闪烁现象
// - FastAPI, https://fastapi.tiangolo.com/ ✅
// - Typer, https://typer.tiangolo.com/ ✅
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
  siteOverrides: [
    {
      host: 'typer.tiangolo.com',
      // Typer 开启了 Material for MkDocs 的 instant navigation。
      // 路由切换时 URL 可能已经变成新页面，但旧正文 DOM 还没被替换；
      // 这时如果立即做首次采样，会把上一页的滚动位置保存到新页面。
      // 只对 Typer 等待首个正文节点稳定，避免影响其他 Material MkDocs 站点。
      requiresStableInitialArticle: true,
    },
  ],
});
