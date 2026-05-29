import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@code-quests/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  define: {
    // Expose CODE_QUESTS_ENV to the client at dev-server startup time
    'import.meta.env.VITE_CODE_QUESTS_ENV': JSON.stringify(
      process.env['CODE_QUESTS_ENV'] ?? '',
    ),
  },
  server: {
    proxy: {
      '/adventurers': 'http://localhost:4001',
      '/epics': 'http://localhost:4001',
      '/quests': 'http://localhost:4001',
      '/health': 'http://localhost:4001',
      '/showcase': 'http://localhost:4001',
      '/test': 'http://localhost:4001',
    },
  },
});
