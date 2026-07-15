import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/e2e',
  use: { baseURL: 'http://127.0.0.1:3100' },
  webServer: {
    command: 'npm run dev -- --port 3100',
    cwd: './apps/web',
    url: 'http://127.0.0.1:3100/api/health',
    reuseExistingServer: !process.env.CI,
  },
});
