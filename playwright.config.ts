import { defineConfig, devices } from '@playwright/test';

// Firefox and WebKit are not installed in the coding sandbox; CI installs them and runs a gameplay-focused subset (CROSS_BROWSER=1).
const cross = process.env.CROSS_BROWSER === '1';
const CROSS_TESTS = /(smoke|progress|campaign|a11y|finale|telemetry|audio)\.spec/;

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
    ...(cross
      ? [
          { name: 'firefox', testMatch: CROSS_TESTS, use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 760 }, launchOptions: {} } },
          { name: 'webkit', testMatch: CROSS_TESTS, use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 760 }, launchOptions: {} } },
          { name: 'webkit-phone', testMatch: CROSS_TESTS, use: { ...devices['iPhone 13'], launchOptions: {} } },
        ]
      : []),
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
