import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  outDir: 'output',
  manifest: {
    name: 'Developer Docs Progress Tracker',
    description: 'Save and restore reading progress on developer documentation and long technical pages.',
    version: '0.1.0',
    permissions: ['activeTab', 'tabs', 'storage', 'scripting'],
    host_permissions: [
      'https://react.dev/*',
      'https://playwright.dev/docs*',
      'https://developers.openai.com/*',
    ],
    optional_host_permissions: [
      'https://*/*',
      'http://*/*',
    ],
  },
});
