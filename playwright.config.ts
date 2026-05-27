import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './packages/client/tests/e2e',
  globalSetup: './packages/client/tests/e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter=@code-quests/server dev',
      url: 'http://localhost:4001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 15000,
    },
    {
      command: 'pnpm --filter=@code-quests/client dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 15000,
    },
  ],
});
