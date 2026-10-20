import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;
// Astro 7 allows one dev server per project, so tests use the usual dev port: locally they reuse a running
// `npm run dev`, in CI they start their own. Tests assume no ANTHROPIC_API_KEY on that server.
const PORT = 4322;
// the built site, with the production security headers (scripts/serve-static.mjs); needs `npm run build` first
const BUILT = 'http://localhost:4323';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 8_000, toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' } },
  // screenshots are per platform, and only Linux baselines (made in CI) are committed
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{arg}{ext}',
  fullyParallel: true,
  // one browser at a time locally: several Edge instances plus the dev server exhausted memory on this machine
  workers: CI ? 2 : 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // reduced motion skips the intro loader and long animations, so tests are fast and deterministic
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    // locally: the Microsoft Edge that's already installed (no browser download); in CI: Playwright's Chromium
    { name: 'desktop', testIgnore: /visual\.spec/, use: { ...devices['Desktop Chrome'], ...(CI ? {} : { channel: 'msedge' }) } },
    { name: 'mobile', testIgnore: /visual\.spec/, use: { ...devices['Pixel 7'], ...(CI ? {} : { channel: 'msedge' }) } },
    // visual regression: run with `npm run test:visual` (see .github/workflows/visual.yml)
    { name: 'visual', testMatch: /visual\.spec/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, ...(CI ? {} : { channel: 'msedge' }) } },
  ],
  webServer: [
    {
      command: `npx astro dev --port ${PORT}`,
      url: `http://localhost:${PORT}`,
      timeout: 180_000, // Astro's first start re-bundles dependencies and can be slow
      reuseExistingServer: !CI,
      // no API key in tests: the AI endpoints must fall back gracefully
      env: { ANTHROPIC_API_KEY: '' },
    },
    { command: 'node scripts/serve-static.mjs 4323', url: BUILT, reuseExistingServer: !CI, timeout: 20_000 },
  ],
});
