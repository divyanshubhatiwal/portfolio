// Checks the production build (served by scripts/serve-static.mjs with the real security headers).
// Skipped when the site hasn't been built (`npm run build`).
import { expect, test } from '@playwright/test';

const BUILT = 'http://localhost:4323';
const PAGES = ['/', '/case/venture-dao/', '/blog/', '/demo/t20/', '/demo/risk-gate/', '/demo/forensic/', '/demo/autosci/', '/now/', '/stats/', '/evidence/', '/tour/', '/tour/venture-dao-one-order/', '/resume/'];

test.beforeEach(async ({ request }) => {
  const r = await request.get(`${BUILT}/`);
  test.skip(r.headers()['x-not-built'] === '1', 'site not built; run npm run build');
});

test('security headers are sent', async ({ request }) => {
  const h = (await request.get(`${BUILT}/`)).headers();
  expect(h['content-security-policy']).toContain("script-src 'self'");
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['content-security-policy']).not.toContain("'unsafe-eval'");
  expect(h['strict-transport-security']).toContain('max-age=');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['referrer-policy']).toBeTruthy();
  expect(h['permissions-policy']).toContain('camera=()');
});

for (const path of PAGES) {
  test(`no content-security-policy violations on ${path}`, async ({ page }) => {
    const violations: string[] = [];
    // /_vercel/insights is Vercel's analytics script, which only exists once deployed
    page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text()) && !m.text().includes('/_vercel/')) violations.push(m.text()); });
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => console.error(`Refused to load: CSP ${e.violatedDirective} ${e.blockedURI}`));
    });
    const res = await page.goto(`${BUILT}${path}`);
    expect(res?.status()).toBe(200);
    await page.waitForLoadState('networkidle');
    expect(violations).toEqual([]);
  });
}
