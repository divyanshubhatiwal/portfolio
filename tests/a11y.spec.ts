// Automated accessibility checks (axe-core, WCAG 2.1 A and AA rules) on the main pages, both themes.
// Fails on "serious" and "critical" problems; minor ones are reported in the test output only.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = ['/', '/hi/', '/case/venture-dao', '/blog', '/evidence', '/tour/venture-dao-one-order', '/resume', '/demo/risk-gate', '/demo/forensic', '/demo/autosci'];

test.describe('accessibility', () => {
  test.skip(({ isMobile }) => isMobile, 'the same markup is checked once, on desktop');

  for (const theme of ['dark', 'light'] as const) {
    for (const path of PAGES) {
      test(`${path} (${theme})`, async ({ page }) => {
        await page.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch { /* ignore */ } }, theme);
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .exclude('astro-dev-toolbar') // Astro's dev-only toolbar
          .analyze();
        const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        for (const v of violations.filter((x) => !serious.includes(x))) console.log(`[${v.impact}] ${path} ${v.id}: ${v.help}`);
        expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}x, e.g. ${v.nodes[0]?.target.join(' ')})`)).toEqual([]);
      });
    }
  }
});
