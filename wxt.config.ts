import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  outDir: 'output',
  manifest: {
    name: 'Learn From Doc',
    description: 'Track reading progress across documentation sites.',
    version: '0.1.0',
    permissions: ['tabs', 'storage'],
    host_permissions: ['https://react.dev/*'],
  },
});
