import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173', launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: {
    command: 'npm run build && npm run preview --workspace @hva/web -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 760 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  ],
});
