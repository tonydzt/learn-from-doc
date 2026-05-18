export type E2ESite = {
  // 这里使用 adapter id，既方便单站点过滤，也避免测试层再发明一套站点命名。
  id: 'react-dev' | 'playwright-dev' | 'openai-codex';
  // 通用用例从这个入口页面开始：popup 识别 scope、创建索引、页面注入 UI 都基于它。
  entryUrl: string;
  expectedScopeTitle: string;
  // options 页面使用 siteId 定位到具体索引；格式来自站点 adapter 的 host + scopeKey。
  expectedSiteId: string;
  // 少数站点需要额外探测另一个 scope，例如 react.dev 的 Learn/Reference 隔离。
  scopeProbeUrl?: string;
};

export const e2eSites: E2ESite[] = [
  {
    id: 'react-dev',
    entryUrl: 'https://react.dev/learn',
    scopeProbeUrl: 'https://react.dev/reference/react',
    expectedScopeTitle: 'Learn React',
    expectedSiteId: 'react.dev::learn',
  },
  {
    id: 'playwright-dev',
    entryUrl: 'https://playwright.dev/docs/intro',
    expectedScopeTitle: 'Playwright Docs',
    expectedSiteId: 'playwright.dev::playwright-docs',
  },
  {
    id: 'openai-codex',
    entryUrl: 'https://developers.openai.com/codex',
    expectedScopeTitle: 'OpenAI Codex Docs',
    expectedSiteId: 'developers.openai.com::codex',
  },
];

export function selectedSites(): E2ESite[] {
  const requestedSiteId = process.env.E2E_SITE;
  if (!requestedSiteId) return e2eSites;

  // 让错误尽早发生在测试收集阶段，而不是等浏览器启动后才发现过滤条件写错。
  const site = e2eSites.find((item) => item.id === requestedSiteId);
  if (!site) {
    throw new Error(`Unknown E2E_SITE "${requestedSiteId}". Available sites: ${e2eSites.map((item) => item.id).join(', ')}`);
  }
  return [site];
}
