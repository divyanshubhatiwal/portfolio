// Loader, typewriter, scroll reveals, split-letter titles and count-up numbers.
import { ROLES } from '@/data/site';
import { $, $$, esc, reducedMotion, storageGet, storageSet } from './dom';

/** Wrap each section title's letters in spans so they can rise out of a blur one by one. */
function splitTitles(): void {
  for (const t of $$('.sec-title')) {
    const text = t.textContent ?? '';
    t.setAttribute('aria-label', text);
    let i = 0;
    t.innerHTML = text
      .split(' ')
      .map((w) => `<span class="w" aria-hidden="true">${[...w].map((ch) => `<span class="c" style="--i:${i++}">${esc(ch)}</span>`).join('')}</span>`)
      .join(' ');
    t.classList.remove('reveal');
    t.classList.add('split');
  }
}

export function countUp(el: HTMLElement): void {
  const end = Number(el.dataset.count), suf = el.dataset.suffix ?? '', dec = Number(el.dataset.decimals ?? 0);
  if (reducedMotion()) { el.textContent = end.toFixed(dec) + suf; return; }
  const t0 = performance.now();
  const f = (now: number) => {
    const p = Math.min((now - t0) / 1200, 1);
    el.textContent = (end * (1 - Math.pow(1 - p, 3))).toFixed(dec) + suf;
    if (p < 1) requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}

function startReveal(): void {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const t = e.target as HTMLElement;
      t.classList.add('in');
      for (const m of $$('.meter i', t)) m.style.width = `${m.dataset.w}%`;
      for (const c of $$('[data-count]', t)) countUp(c);
      io.unobserve(t);
    }
  }, { threshold: 0.12 });
  for (const el of $$('.reveal, .split')) io.observe(el);
}

function typewriter(): void {
  const el = $('#typed');
  if (!el) return;
  // the page can supply translated roles (the Hindi home page does)
  let roles: readonly string[] = ROLES;
  try { const own = JSON.parse(el.dataset.roles ?? 'null') as string[] | null; if (own?.length) roles = own; } catch { /* keep English */ }
  if (reducedMotion()) { el.textContent = roles[0] ?? ''; return; }
  // type whole characters (grapheme clusters), so Devanagari vowel signs never appear on their own
  const chars = (s: string): string[] =>
    typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter().segment(s)].map((g) => g.segment) : Array.from(s);
  const words = roles.map(chars);
  let r = 0, c = 0, del = false;
  const tick = (): void => {
    const word = words[r] ?? [];
    el.textContent = word.slice(0, c).join('');
    if (!del && c === word.length) { del = true; setTimeout(tick, 1600); return; }
    if (del && c === 0) { del = false; r = (r + 1) % words.length; }
    c += del ? -1 : 1;
    setTimeout(tick, del ? 35 : 70);
  };
  tick();
}

/** Plays the intro once per visit, then reveals the page. Sub-pages have no loader and start revealed. */
function loader(onDone: () => void): void {
  const box = $('#loader');
  const finish = () => { box?.classList.add('done'); document.body.classList.add('loaded'); onDone(); };
  if (!box) { finish(); return; }
  const seen = storageGet('intro-seen') === '1';
  storageSet('intro-seen', '1');
  if (seen || reducedMotion()) { box.style.transition = 'none'; finish(); return; }
  const msgs = ['Initializing Systems...', 'Loading Neural Weights...', 'Ready.'];
  const msg = $('#loader-msg'), bar = $('#loader-bar');
  let i = 0;
  const step = () => {
    if (msg) msg.textContent = msgs[i] ?? '';
    if (bar) bar.style.width = `${((i + 1) / msgs.length) * 100}%`;
    if (++i < msgs.length) setTimeout(step, 200);
    else setTimeout(finish, 180);
  };
  step();
}

export function initIntro(): void {
  splitTitles();
  typewriter();
  loader(startReveal);
}
