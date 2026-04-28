import { defineConfig, devices } from '@playwright/test';

// Frontend E2E config.
//
// We mock the backend at the network level via `page.route` inside each
// spec, so these specs do not require a running backend / swarm. They run
// against the real Vite dev server which exercises the full
// React + Router + TanStack Query + SSE stack.
//
// To run locally:
//   pnpm --filter @cosmic/frontend e2e:install   # one-time browser binary install
//   pnpm --filter @cosmic/frontend e2e

const PORT = 5173;

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
