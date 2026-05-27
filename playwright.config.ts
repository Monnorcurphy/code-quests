import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { toHaveScreenshot: { threshold: 0.2, maxDiffPixelRatio: 0.05 } },
  use: { baseURL: 'http://localhost:5173' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: { command: 'pnpm dev', port: 5173, reuseExistingServer: true },
});
