// Scroll reveals, split-letter titles and count-up numbers.
import { $$, esc, reducedMotion } from './dom';

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

export function initIntro(): void {
  splitTitles();
  startReveal();
}