// Visual regression: screenshots of key pages in both themes, compared with committed baselines.
// Runs against the built site with every outside request blocked, and live widgets masked, so a
// screenshot only changes when the site's own code or styles change.
//   npm run test:visual                         compare
//   npm run test:visual -- --update-snapshots   accept the current look as the new baseline
// Baselines are Linux-only (fonts render differently per OS); .github/workflows/visual.yml makes and checks them.
import { expect, test, type Page } from '@playwright/test';

const BUILT = 'http://localhost:4323';
const PAGES: [name: string, path: string][] = [
  ['home', '/'],
  ['home-hindi', '/hi/'],
  ['case-study', '/case/venture-dao/'],
  ['blog', '/blog/'],
  ['risk-gate', '/demo/risk-gate/'],
  ['forensic', '/demo/forensic/'],
  ['autosci', '/demo/autosci/'],
  ['stats', '/stats/'],
];

async function open(page: Page, path: string, theme: 'dark' | 'light') {
  await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort()); // GitHub, LeetCode, fonts: never in screenshots
  await page.route('**/api/**', (r) => r.fulfill({ status: 503, body: '{}' }));
  await page.addInitScript((t) => {
    try { localStorage.setItem('theme', t); sessionStorage.setItem('intro-seen', '1'); } catch { /* ignore */ }
  }, theme);
  await page.goto(`${BUILT}${path}`);
  await page.waitForLoadState('networkidle');
  // animated full-page backgrounds are hidden (masking them would cover the whole page)
  await page.addStyleTag({ content: '.aurora, .aurora-lite, canvas, .grid-bg { visibility: hidden !important; }' });
  // fonts that did load must finish before the screenshot
  await page.evaluate(() => document.fonts.ready);
}

test.beforeEach(async ({ request }) => {
  const r = await request.get(`${BUILT}/`);
  test.skip(r.headers()['x-not-built'] === '1', 'site not built; run npm run build');
});

for (const theme of ['dark', 'light'] as const) {
  for (const [name, path] of PAGES) {
    test(`${name} (${theme})`, async ({ page }) => {
      await open(page, path, theme);
      await expect(page).toHaveScreenshot(`${name}-${theme}.png`, {
        // small things that legitimately change between runs
        mask: [page.locator('#typed, footer .pill, #st-visits, #st-repos, #st-lc')],
      });
    });
  }
}
