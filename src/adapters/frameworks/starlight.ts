import { createFrameworkAdapter } from './common';

// Manual test sites:
// 这个架构下很多网站都是子目录树，做子目录树的可以用这个框架下的网站做测试
// - Netlify Docs, https://docs.netlify.com/ ✅
// - Pydantic Docs, https://docs.pydantic.dev/latest/ ✅
// - Cloudflare Developer Docs, https://developers.cloudflare.com/ ❌ 这个网站子目录跳来跳去太复杂了，后面再支持这个网站吧，现在先不处理
// - sharp, https://sharp.pixelplumbing.com/ ✅
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
  siteOverrides: [
    // Netlify 页面图片较多；加载完成前测量会低估正文高度，导致进度过早到 100%。
    {
      host: 'docs.netlify.com',
      requiresIndexingLoadWait: true,
    },
  ],
  expandableSelectors: [
    'button[aria-expanded="false"]',
    'summary',
  ],
});
