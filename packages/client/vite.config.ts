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
  server: {
    proxy: {
      '/adventurers': 'http://localhost:4001',
      '/epics': 'http://localhost:4001',
      '/quests': 'http://localhost:4001',
      '/health': 'http://localhost:4001',
    },
  },
});
