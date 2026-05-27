import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Tests run in jsdom which doesn't support WebGL — disable Phaser in unit tests
    'import.meta.env.VITE_PHASER_TOWN': JSON.stringify('false'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**'],
  },
});
