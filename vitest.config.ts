import { defineConfig } from 'vitest/config';

// Vitest 的配置文件，作用类似后端项目里的 test runner 配置。
// 这里决定测试运行在哪种环境、加载哪些测试文件，以及是否提供全局测试函数。
export default defineConfig({
  test: {
    // 使用 jsdom 模拟浏览器 DOM 环境。
    // 本项目有 adapter、logger、settings 等代码会接触 window/document/localStorage，
    // 在 Node.js 默认环境里这些浏览器 API 不存在，所以测试需要 jsdom。
    environment: 'jsdom',

    environmentOptions: {
      jsdom: {
        // 给 jsdom 一个固定页面 URL。
        // 这样测试中如果代码读取 location.href、new URL(location.href)
        // 或依赖 react.dev 的路径判断，就会得到稳定结果。
        url: 'https://react.dev/learn',
      },
    },

    // 开启后，测试文件可以直接使用 describe/it/expect 等全局函数。
    // 如果关闭，就需要在每个测试文件里从 vitest 显式 import。
    globals: true,

    // 只收集 src 目录下以 .test.ts 结尾的测试文件。
    // entrypoints 里的 React 页面和 WXT 入口目前不在这个单元测试范围内。
    include: ['src/**/*.test.ts'],
  },
});
