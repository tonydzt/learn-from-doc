import { defineConfig } from '@playwright/test';

export default defineConfig({
  // E2E 只放在 tests/e2e，避免和 Vitest 单元测试混在一起。
  testDir: 'tests/e2e',
  // Chrome extension 测试会共享真实浏览器 profile/IndexedDB 状态。
  // 串行执行能避免多个站点同时改扩展存储造成互相污染。
  fullyParallel: false,
  workers: 1,
  // 通用用例会真实创建索引，background 会逐页打开测量 tab，耗时明显高于普通页面测试。
  timeout: 300_000,
  expect: {
    timeout: 30_000,
  },
  // 本地只打印终端列表；CI 里额外生成 HTML 报告用于排查失败，但不自动打开浏览器。
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    actionTimeout: 30_000,
    // 真实文档站点依赖外网，导航超时给得比普通 UI 测试宽一些。
    navigationTimeout: 60_000,
    // 失败时保留 trace，便于回放 extension/page/background 之间的交互。
    trace: 'retain-on-failure',
  },
});
