import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  dev: {
    server: {
      port: 3010,
      strictPort: true,
    },
  },
  outDir: 'output',
  targetBrowsers: ['chrome', 'firefox'],
  manifest: ({ browser }) => ({
    name: 'Developer Docs Progress Tracker',
    description: 'Save and restore reading progress on developer documentation and long technical pages.',
    version: '0.2.0',
    permissions: ['activeTab', 'tabs', 'storage', 'scripting'],
    commands: {
      _execute_action: {
        suggested_key: {
          default: 'Ctrl+Shift+L',
          mac: 'Command+Shift+L',
        },
      },
    },
    host_permissions: [
      'https://react.dev/*',
      'https://playwright.dev/*',
      'https://developers.openai.com/*',
      'https://developer.mozilla.org/*',
      'https://docs.docker.com/*',
      'https://learn-from-doc-web.vercel.app/*',
      'http://localhost:3000/*'
    ],
    optional_host_permissions: [
      'https://*/*',
      'http://*/*',
    ],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: '{4bf5ca62-3a2b-467d-b915-2087fbdf8a51}',
              data_collection_permissions: {
                required: ['none'],
              },
            },
          },
        }
      : {}),
  }),
});
