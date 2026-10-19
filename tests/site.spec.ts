import { expect, test, type Page } from '@playwright/test';

/** Fail on uncaught script errors. Network errors from outside services (GitHub's API limits, LeetCode) are not bugs in the site. */
function trackScriptErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test.describe('home page', () => {
  test('loads with every section and no script errors', async ({ page }) => {
    const errors = trackScriptErrors(page);
    await page.goto('/');
    for (const id of ['home', 'about', 'skills', 'experience', 'projects', 'github', 'certifications', 'achievements', 'contact']) {
      await expect(page.locator(`section#${id}`)).toBeAttached();
    }
    // scoped to the hero: in dev, Astro's toolbar adds its own <h1> elements to the page
    await expect(page.locator('#home h1')).toContainText('Divyanshu');
    await expect(page.locator('main h1')).toHaveCount(1); // one page heading, for accessibility and SEO
    await expect(page.locator('.project')).toHaveCount(10);
    await expect(page.locator('.cert')).toHaveCount(7);
    expect(errors).toEqual([]);
  });

  test('has the SEO and link-preview tags', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Divyanshu Bhatiwal/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{50,}/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https:\/\/.+\/og\.png$/);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  });

  test('project filters show only the chosen category', async ({ page }) => {
    await page.goto('/#projects');
    await page.locator('.filter[data-f="Backend"]').click();
    await expect(page.locator('.project:not(.hide) h3')).toHaveText(['RideCompare', 'SafeSignal AI']);
    await expect(page.locator('.filter[data-f="Backend"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.filter[data-f="All"]').click();
    await expect(page.locator('.project:not(.hide)')).toHaveCount(10);
  });

  test('experience tabs switch panels, including with arrow keys', async ({ page }) => {
    await page.goto('/#experience');
    const tabs = page.getByRole('tab');
    await tabs.nth(2).click();
    await expect(page.locator('#exp-panel-2')).toBeVisible();
    await expect(page.locator('#exp-panel-0')).toBeHidden();
    await tabs.nth(2).press('ArrowRight');
    await expect(page.locator('#exp-panel-0')).toBeVisible();
    await expect(tabs.nth(0)).toBeFocused();
  });
});

test.describe('keyboard features', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard shortcuts are a desktop feature');

  test('command palette finds a project', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    await expect(page.locator('#palette')).toHaveClass(/open/);
    await page.keyboard.type('safe');
    await expect(page.locator('.pal-item.active')).toContainText('SafeSignal AI');
    await page.keyboard.press('Escape');
    await expect(page.locator('#palette')).not.toHaveClass(/open/);
  });

  test('terminal opens with the backtick key and runs commands', async ({ page }) => {
    await page.goto('/');
    await page.locator('body').click();
    await page.keyboard.press('Backquote');
    await expect(page.locator('#term')).toHaveClass(/open/);
    await page.keyboard.type('project ride');
    await page.keyboard.press('Enter');
    await expect(page.locator('#term-out')).toContainText('Multi-provider fare aggregation');
    await page.keyboard.type('nope');
    await page.keyboard.press('Enter');
    await expect(page.locator('#term-out')).toContainText('command not found: nope');
  });
});

test('chat answers from the site content without an API key', async ({ page }) => {
  await page.goto('/');
  await page.locator('#chat-btn').click();
  await page.locator('#chat-input').fill('What have you built with FastAPI?');
  await page.locator('#chat-input').press('Enter');
  await expect(page.locator('#chat-log .msg.bot').last()).toContainText('RideCompare', { timeout: 15_000 });
});

test('case study diagram explains each stage', async ({ page }) => {
  await page.goto('/case/forensic-agent');
  const panel = page.locator('.dg-panel');
  await expect(panel.locator('[data-detail="ingest"]')).toBeVisible();
  await page.getByRole('button', { name: /Rank anomalies/ }).click();
  await expect(panel.locator('[data-detail="rank"]')).toBeVisible();
  await expect(panel.locator('[data-detail="ingest"]')).toBeHidden();
});

test('blog lists posts and the RSS feed is valid', async ({ page, request }) => {
  await page.goto('/blog');
  await expect(page.locator('.card')).toHaveCount(3);
  const rss = await request.get('/rss.xml');
  expect(rss.ok()).toBeTruthy();
  const xml = await rss.text();
  expect(xml).toContain('<rss');
  expect(xml.match(/<item>/g)?.length).toBe(3);
});

test('job matcher explains itself when AI is not configured', async ({ page }) => {
  await page.goto('/match');
  await page.locator('#jd-sample').click();
  await page.locator('#jd-go').click();
  // without a key the page explains that AI matching is off; repeated runs may instead hit the
  // per-IP rate limit, which is also a correct, friendly response
  await expect(page.locator('#match-out')).toContainText(/isn't switched on|try again in/, { timeout: 15_000 });
});

test('AI endpoints reject bad input before doing anything', async ({ request }) => {
  expect((await request.post('/api/chat', { data: { question: '' } })).status()).toBe(400);
  expect((await request.post('/api/match', { data: { jd: 'too short' } })).status()).toBe(400);
  expect((await request.get('/api/chat')).status()).toBe(405);
});

test('T20 demo predicts from the trained model', async ({ page }) => {
  await page.goto('/demo/t20');
  // the notebook's sample situation: Mumbai Indians 87/2 after 10 overs at Wankhede
  await expect(page.locator('#t20-pred')).toHaveText('174');
  await expect(page.locator('#t20-naive')).toHaveText('174');
  await page.locator('#t20-over').fill('4');
  await page.locator('#t20-score').fill('38');
  await expect(page.locator('#t20-last5')).toBeDisabled();
});

test('unknown pages return 404', async ({ request }) => {
  expect((await request.get('/this-page-does-not-exist')).status()).toBe(404);
});
