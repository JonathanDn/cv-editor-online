import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
  },
  webServer: {
    command: 'npm run build && env STATIC_ROOT=dist PORT=4173 node dev-server.js',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
