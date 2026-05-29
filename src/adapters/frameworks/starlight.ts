import { createFrameworkAdapter } from './common';

// Manual test sites:
// 这个架构下很多网站都是子目录树，做子目录树的可以用这个框架下的网站做测试
// - Netlify Docs, https://docs.netlify.com/ ❌ https://docs.netlify.com/deploy/deploy-notifications/页面才划了一半，但是当前页进度已经到100%了
// - Cloudflare Developer Docs, https://developers.cloudflare.com/ ❌ 没有对嵌套链接做索引，感觉链接展开的有问题
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
  expandableSelectors: [
    'button[aria-expanded="false"]',
    'summary',
  ],
});
