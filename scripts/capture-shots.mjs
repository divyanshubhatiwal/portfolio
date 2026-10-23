// Captures project screenshots (JPEG + WebP) and short silent demo clips (WebM) from real pages.
// Needs the dev server on :4322 (npm run dev -- --port 4322). Run: node scripts/capture-shots.mjs [name ...]
// Every image shows the real thing: a live deployment, or a demo running on this site.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const IMG = path.join(root, 'public/img'), CLIPS = path.join(root, 'public/clips');
const W = 960, H = 600, OUT_W = 900; // cards show 900x562; a narrow window lets the content fill the frame
const LOCAL = 'http://localhost:4322';
const only = new Set(process.argv.slice(2));

const quiet = async (page) => {
  // hide floating site controls, so the picture is the product only
  await page.addStyleTag({ content: 'nav, #chat-btn, #magic-btn, #top-btn, #progress, .cursor, .cursor-dot, astro-dev-toolbar { display: none !important; }' });
};

/** name -> how to get the page into the state worth showing */
const SHOTS = {
  t20: { url: `${LOCAL}/demo/t20`, scrollTo: '#t20-form', offset: -24 },
  autosci: { url: `${LOCAL}/demo/autosci`, scrollTo: '#as', offset: -24, act: async (p) => { await p.selectOption('#as-task', 'vehicle'); await p.click('#as-all'); } },
  forensic: { url: `${LOCAL}/demo/forensic`, scrollTo: '#fx', offset: -24, act: async (p) => { await p.click('#fx-reveal'); } },
};

/** clips: a few seconds of someone using the demo */
const CLIP_SCRIPTS = {
  'risk-gate': { url: `${LOCAL}/demo/risk-gate`, scrollTo: '#rg', offset: -24, run: async (p) => {
    await p.click('#rg-submit'); await p.waitForTimeout(1200);
    await p.click('#rg-submit'); await p.waitForTimeout(1200);
    await p.fill('#rg-stop', ''); await p.click('#rg-submit'); await p.waitForTimeout(1300);
    await p.fill('#rg-stop', '2450'); await p.check('#rg-venue'); await p.click('#rg-submit'); await p.waitForTimeout(1200);
    await p.click('#rg-retry'); await p.waitForTimeout(1600);
  } },
  forensic: { url: `${LOCAL}/demo/forensic`, scrollTo: '#fx', offset: -24, run: async (p) => {
    for (const id of ['AUTH-00039', 'AUTH-00040', 'NETWORK-00113', 'FILE_EVENTS-00140']) {
      await p.hover(`tr[data-id="${id}"]`); await p.waitForTimeout(500);
      await p.click(`tr[data-id="${id}"]`); await p.waitForTimeout(1100);
    }
    await p.waitForTimeout(1200);
  } },
  autosci: { url: `${LOCAL}/demo/autosci`, scrollTo: '#as', offset: -24, run: async (p) => {
    await p.selectOption('#as-task', 'vehicle'); await p.click('#as-play'); await p.waitForTimeout(9500);
  } },
};

const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'msedge' });

async function prepare(page, s) {
  await page.addInitScript(() => { try { localStorage.setItem('theme', 'dark'); } catch { /* ignore */ } });
  await page.goto(s.url, { waitUntil: 'networkidle' });
  if (s.url.startsWith(LOCAL)) await quiet(page);
  if (s.scrollTo) await page.evaluate(([sel, off]) => { const el = document.querySelector(sel); if (el) scrollTo(0, el.getBoundingClientRect().top + scrollY + off); }, [s.scrollTo, s.offset ?? 0]);
  await page.waitForTimeout(s.wait ?? 800);
}

for (const [name, s] of Object.entries(SHOTS)) {
  if (only.size && !only.has(name)) continue;
  const page = await browser.newPage({ viewport: { width: W, height: H }, reducedMotion: 'reduce' });
  await prepare(page, s);
  if (s.act) { await s.act(page); await page.waitForTimeout(600); }
  const png = await page.screenshot();
  const img = sharp(png).resize(OUT_W);
  await img.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(IMG, `${name}.jpg`));
  await img.clone().webp({ quality: 80 }).toFile(path.join(IMG, `${name}.webp`));
  console.log(`img/${name}.jpg + .webp`);
  await page.close();
}

fs.mkdirSync(CLIPS, { recursive: true });
// where the action starts in each clip (seconds), so players can skip the page loading at the start
const startsPath = path.join(root, 'src/data/clips.json');
let starts = {};
try { starts = JSON.parse(fs.readFileSync(startsPath, 'utf8')); } catch { /* first run: no start times yet */ }
for (const [name, c] of Object.entries(CLIP_SCRIPTS)) {
  if (only.size && !only.has(`clip:${name}`) && !only.has('clips')) continue;
  const dir = fs.mkdtempSync(path.join(root, 'test-results/clip-'));
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 750 }, recordVideo: { dir, size: { width: 960, height: 600 } } });
  const t0 = Date.now();
  const page = await ctx.newPage();
  await prepare(page, c);
  starts[name] = Math.round((Date.now() - t0) / 100) / 10;
  await c.run(page);
  const video = page.video();
  await ctx.close();
  fs.copyFileSync(await video.path(), path.join(CLIPS, `${name}.webm`));
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`clips/${name}.webm (${Math.round(fs.statSync(path.join(CLIPS, `${name}.webm`)).size / 1024)} KB), action from ${starts[name]}s`);
}
fs.writeFileSync(startsPath, `${JSON.stringify(starts, null, 1)}\n`);

// WebP copies of the screenshots that were already there
for (const f of fs.readdirSync(IMG).filter((x) => x.endsWith('.jpg'))) {
  const webp = path.join(IMG, f.replace(/\.jpg$/, '.webp'));
  if (!fs.existsSync(webp)) { await sharp(path.join(IMG, f)).webp({ quality: 80 }).toFile(webp); console.log(`img/${path.basename(webp)} (from existing jpg)`); }
}
await browser.close();
