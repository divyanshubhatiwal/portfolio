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

test('chat shows citations as links, and only to pages on this site', async ({ page }) => {
  // a stubbed AI reply, so this runs without an API key
  await page.route('**/api/chat', (r) => r.fulfill({ json: {
    answer: 'I built **RideCompare** with FastAPI [1]. More in my notes [2].',
    sources: [{ n: 1, title: 'RideCompare case study', url: '/case/ridecompare' }, { n: 2, title: 'Bad link', url: 'javascript:alert(1)' }],
  } }));
  await page.goto('/');
  await page.locator('#chat-btn').click();
  await page.locator('#chat-input').fill('What have you built with FastAPI?');
  await page.locator('#chat-input').press('Enter');
  const reply = page.locator('#chat-log .msg.bot').last();
  await expect(reply.locator('a.cite').first()).toHaveAttribute('href', '/case/ridecompare');
  await expect(reply.locator('.cites li')).toHaveText(['RideCompare case study', 'Bad link']);
  await expect(reply.locator('.cites li a').nth(1)).toHaveAttribute('href', '/'); // unsafe URL replaced
  await expect(reply.locator('b')).toHaveText('RideCompare');
});

test('risk gate blocks bad orders and suppresses a retried order', async ({ page }) => {
  await page.goto('/demo/risk-gate');
  const verdict = page.locator('#rg-verdict');
  await page.locator('#rg-submit').click();
  await expect(verdict).toHaveText('order placed');
  await page.locator('#rg-submit').click();
  await expect(verdict).toHaveText('blocked: SYMBOL_EXPOSURE');
  await page.locator('#rg-reset').click();
  await page.locator('#rg-stop').fill('');
  await page.locator('#rg-submit').click();
  await expect(verdict).toHaveText('blocked: NO_STOP');
  await page.locator('#rg-stop').fill('2450');
  await page.locator('#rg-venue').check();
  await page.locator('#rg-submit').click();
  await expect(verdict).toHaveText('exchange timed out');
  await page.locator('#rg-retry').click();
  await expect(verdict).toHaveText('duplicate suppressed');
});

test('forensic investigation reveals the agent analysis after three answers', async ({ page }) => {
  await page.goto('/demo/forensic');
  await expect(page.locator('#fx-result')).toBeHidden();
  for (const id of ['AUTH-00040', 'NETWORK-00113', 'FILE_EVENTS-00140']) await page.locator(`tr[data-id="${id}"]`).click();
  await expect(page.locator('#fx-q')).toContainText('3 of 3');
  await expect(page.locator('#fx-result')).toBeVisible();
  await expect(page.locator('#fx-result')).toContainText('INC-01');
});

test('AutoSci replay steps through a real study', async ({ page }) => {
  await page.goto('/demo/autosci');
  await page.locator('#as-step').click();
  await expect(page.locator('#as-n')).toHaveText('1');
  await expect(page.locator('#as-chart polyline')).toHaveCount(3);
  await page.locator('#as-all').click();
  await expect(page.locator('#as-n')).toHaveText('12');
  await expect(page.locator('.lane')).toHaveCount(3);
  await expect(page.locator('.lane-best').first()).toContainText('held-out test');
});

test('recruiter view puts backend work first', async ({ page }) => {
  await page.goto('/?for=backend');
  await expect(page.locator('.focus-banner')).toContainText('backend');
  await expect(page.locator('#project-grid .project').first()).toHaveAttribute('data-cat', 'Backend');
  await expect(page.locator('#skills .skill-cat').first()).toHaveAttribute('data-group', 'Backend & Data');
  await expect(page.locator('#project-grid .project')).toHaveCount(10); // reordered, nothing hidden
});

test('Hindi home page is translated and linked both ways', async ({ page }) => {
  const errors = trackScriptErrors(page);
  await page.goto('/hi/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await expect(page.locator('#about .sec-title')).toHaveText('पहले मापो, फिर दावा करो।');
  await expect(page.locator('.project')).toHaveCount(10);
  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', /\/$/);
  await page.goto('/');
  await expect(page.locator('link[hreflang="hi"]')).toHaveAttribute('href', /\/hi\/$/);
  expect(errors).toEqual([]);
});

test('now and stats pages load', async ({ page }) => {
  await page.goto('/now');
  await expect(page.locator('main h1')).toContainText('now');
  await expect(page.locator('.now-list').first().locator('li')).toHaveCount(3);
  await page.goto('/stats');
  await expect(page.locator('main h1')).toContainText('numbers');
  // no storage in tests, so the counter explains itself instead of showing a number
  await expect(page.locator('#st-visits-l')).toContainText('not switched on', { timeout: 10_000 });
});
test('refreshing the page starts at the top, even after jumping to a section', async ({ page }) => {
  await page.goto('/#projects');
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
  await page.reload();
  await page.waitForLoadState('load');
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  expect(new URL(page.url()).hash).toBe('');
});
test('chat offers follow-up questions and a share link, and shared links ask the question', async ({ page }) => {
  await page.route('**/api/chat', (r) => r.fulfill({ json: {
    answer: 'I built RideCompare with FastAPI [1].',
    sources: [{ n: 1, title: 'RideCompare case study', url: '/case/ridecompare' }],
    followups: ['How did you test it?', '<b>not shown</b>'],
  } }));
  await page.goto('/?ask=What%20have%20you%20built%20with%20FastAPI%3F');
  await expect(page.locator('#chat')).toHaveClass(/open/);
  expect(new URL(page.url()).search).toBe(''); // the question leaves the address bar
  const reply = page.locator('#chat-log .msg.bot').last();
  await expect(reply.locator('.followups button')).toHaveText(['How did you test it?']); // unsafe text dropped
  await expect(reply.locator('.chat-share')).toHaveAttribute('data-share', 'What have you built with FastAPI?');
  await reply.locator('.followups button').click();
  await expect(page.locator('#chat-log .msg.me').last()).toHaveText('How did you test it?');
});

test('skill evidence links each skill to code on GitHub at a pinned commit', async ({ page }) => {
  await page.goto('/evidence#skill=MongoDB');
  const panel = page.locator('#ev-panel');
  await expect(panel.locator('h3')).toHaveText('MongoDB');
  const link = panel.locator('li', { hasText: 'Venture DAO' }).locator('a');
  await expect(link).toHaveAttribute('href', /^https:\/\/github\.com\/divyanshubhatiwal\/venture-dao\/blob\/[0-9a-f]{40}\/backend\/package\.json#L\d+$/);
  await expect(panel.locator('li.weak', { hasText: 'Lumina' })).toBeVisible(); // described, not public code
});

test('code tours show real excerpts with their true line numbers', async ({ page }) => {
  await page.goto('/tour/venture-dao-one-order');
  await expect(page.locator('.tour-step')).toHaveCount(3);
  const first = page.locator('#stop-1');
  await expect(first.locator('.tour-file a')).toHaveAttribute('href', /\/blob\/[0-9a-f]{40}\/backend\/trading\/botEngine\.js#L\d+-L\d+$/);
  await expect(first.locator('pre')).toContainText('export function executionKey');
  await page.goto('/tour');
  await expect(page.locator('.card')).toHaveCount(4);
});

test('tailored résumé puts relevant projects first and prints on one page', async ({ page }) => {
  await page.goto('/resume?for=backend');
  await expect(page.locator('#cv-role')).toHaveValue('backend');
  await expect(page.locator('#cv-projects .cv-item').first().locator('h3')).toHaveText('SafeSignal AI');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#cv-projects .cv-item.cut').first()).toBeHidden();
  await expect(page.locator('#cv-projects .cv-item:not(.cut)')).toHaveCount(5);
});

test('live status badges appear on deployed projects', async ({ page }) => {
  await page.route('**/api/status', (r) => r.fulfill({ json: { checked: new Date().toISOString(), results: [
    { name: 'Friends Talk', url: 'https://friendstalk.fun/', ok: true, status: 200, ms: 120 },
    { name: 'FlowBoard', url: 'https://flowboard-teal.vercel.app/', ok: false, status: 503, ms: 80 },
  ] } }));
  await page.goto('/');
  await expect(page.locator('.project[data-name="Friends Talk"] .status-badge')).toHaveText('Live · 120 ms');
  await expect(page.locator('.project[data-name="FlowBoard"] .status-badge')).toHaveText('Not responding');
});

test('status endpoint only checks the site\'s own live projects', async ({ request }) => {
  const r = await request.get('/api/status?url=https://example.com');
  expect(r.ok()).toBeTruthy();
  const { results } = await r.json() as { results: { name: string; url: string; ok: boolean }[] };
  expect(results.map((x) => x.name).sort()).toEqual(['FlowBoard', 'Friends Talk', 'T20 Score Predictor']);
  expect(results.every((x) => typeof x.ok === 'boolean' && !x.url.includes('example.com'))).toBeTruthy();
});

test('case studies show the public repository history', async ({ page }) => {
  await page.goto('/case/venture-dao');
  await expect(page.locator('.repo-act')).toContainText(/\d+ commits/);
  await expect(page.locator('.repo-act a', { hasText: 'Code tour' })).toHaveCount(2);
});