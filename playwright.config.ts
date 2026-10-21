import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173', launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: {
    command: 'npm run build && npm run preview --workspace @hva/web -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', testIgnore: /recording/, use: { viewport: { width: 1280, height: 760 } } },
    { name: 'mobile', testIgnore: /recording/, use: { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
    // Recording projects only run with `npm run recordings`; they capture full-size video.
    {
      name: 'rec-desktop',
      testMatch: /recording/,
      use: { viewport: { width: 1280, height: 760 }, video: { mode: 'on', size: { width: 1280, height: 760 } } },
    },
    {
      name: 'rec-mobile',
      testMatch: /recording/,
      use: { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, video: { mode: 'on', size: { width: 390, height: 780 } } },
    },
  ],
});
