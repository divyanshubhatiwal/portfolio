// Scroll reveals and count-up numbers.
import { $$, reducedMotion } from './dom';

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
  for (const el of $$('.reveal')) io.observe(el);
}

export function initIntro(): void {
  startReveal();
}