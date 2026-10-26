import { defineConfig, devices } from '@playwright/test';

const PORT = 4300;
const BASE_URL = `http://localhost:${PORT}`;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/msr_e2e';
const MOBILE_SPECS = /\.mobile\.spec\.ts/;
const MOBILE_DEVICES = [
  { name: 'small-phone', device: devices['iPhone SE'] },
  { name: 'iphone-se', device: { ...devices['iPhone SE'], viewport: { width: 375, height: 667 } } },
  { name: 'iphone', device: devices['iPhone 15'] },
  { name: 'pro-max', device: devices['iPhone 15 Pro Max'] },
  { name: 'ipad-mini', device: { ...devices['iPad Mini'], viewport: { width: 744, height: 1133 } } },
];

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: { baseURL: BASE_URL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    {
      name: 'desktop',
      testIgnore: MOBILE_SPECS,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    ...MOBILE_DEVICES.map(({ name, device }) => ({
      name,
      testMatch: MOBILE_SPECS,
      use: { ...device, browserName: 'chromium' as const },
    })),
  ],
  webServer: {
    command: 'node e2e/prepare-db.mjs && pnpm build && node server/dist/index.js',
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      NODE_ENV: 'development',
      PORT: String(PORT),
      APP_URL: BASE_URL,
      DATABASE_URL,
      CLIENT_DIST: 'client/dist',
      UPLOAD_DIR: 'storage/e2e',
      ENABLE_DEMO_DATA: 'true',
      DISABLE_RATE_LIMIT: 'true',
    },
  },
});
