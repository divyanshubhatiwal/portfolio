// Visual effects: cursor, spotlight, parallax,
// scroll progress and confetti.
import { $, $$, finePointer, reducedMotion, scrollTop } from './dom';

function cursor(): void {
  const ring = $('#cursor'), dot = $('#cursor-dot');
  if (!ring || !dot || !finePointer()) return; // touch screens hide the custom cursor; skip its frame loop
  let x = -100, y = -100, rx = -100, ry = -100;
  document.addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; dot.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`; });
  document.addEventListener('mouseover', (e) => ring.classList.toggle('hover', !!(e.target as Element).closest?.('a, button, [data-hover]')));
  const loop = () => { rx += (x - rx) * 0.18; ry += (y - ry) * 0.18; ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`; requestAnimationFrame(loop); };
  loop();
}

function spotlight(): void {
  document.addEventListener('pointermove', (e) => {
    const card = (e.target as Element).closest?.<HTMLElement>('.spot');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--x', `${e.clientX - r.left}px`);
    card.style.setProperty('--y', `${e.clientY - r.top}px`);
  });
}

function parallax(): void {
  if (reducedMotion()) return;
  const els = $$('[data-parallax]');
  if (!els.length) return;
  const update = () => {
    const vh = innerHeight;
    for (const el of els) {
      const r = (el.parentElement ?? el).getBoundingClientRect();
      const p = Math.min(Math.max((vh - r.top) / (vh + r.height), 0), 1);
      el.style.setProperty('--py', `${((0.5 - p) * 200 * Number(el.dataset.parallax)).toFixed(1)}px`);
    }
  };
  addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
  update();
}

function progressAndTop(): void {
  const bar = $('#progress'), top = $('#top-btn');
  addEventListener('scroll', () => {
    const h = document.documentElement, p = h.scrollTop / (h.scrollHeight - h.clientHeight || 1);
    if (bar) bar.style.transform = `scaleX(${p})`;
    top?.classList.toggle('show', h.scrollTop > 600);
  }, { passive: true });
  top?.addEventListener('click', scrollTop);
}

interface Bit { x: number; y: number; vx: number; vy: number; r: number; vr: number; g: string; size: number; life: number; color: string }

function confetti(): void {
  const cv = $<HTMLCanvasElement>('#confetti'), btn = $('#magic-btn');
  const ctx = cv?.getContext('2d');
  if (!cv || !btn || !ctx) return;
  let parts: Bit[] = [], running = false;
  const size = () => { const d = devicePixelRatio || 1; cv.width = innerWidth * d; cv.height = innerHeight * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
  addEventListener('resize', size);
  size();
  const glyphs = ['✦', '◆', '●', '▲', '01', '{ }', 'AI'];
  const frame = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 0.008;
      ctx.save(); ctx.globalAlpha = Math.max(p.life, 0); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.color; ctx.font = `700 ${p.size}px "Space Mono", monospace`; ctx.fillText(p.g, 0, 0); ctx.restore();
    }
    if (parts.length) requestAnimationFrame(frame);
    else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  };
  btn.addEventListener('click', () => {
    const fg = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim();
    for (let i = 0; i < 140; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, s = 8 + Math.random() * 10;
      parts.push({ x: innerWidth / 2, y: innerHeight + 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 1.4,
        r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, g: glyphs[i % glyphs.length] ?? '✦', size: 10 + Math.random() * 12, life: 1, color: fg });
    }
    if (!running) { running = true; requestAnimationFrame(frame); }
  });
}

/** Hero background: a spotlight on the grid follows the cursor. Desktop pointers only; off for reduced motion. */
function heroLight(): void {
  const hero = $('#home');
  if (!hero || !finePointer() || reducedMotion()) return;
  let frame = 0, x = 0, y = 0;
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    x = e.clientX - r.left; y = e.clientY - r.top;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      hero.style.setProperty('--hx', `${x}px`);
      hero.style.setProperty('--hy', `${y}px`);
      hero.classList.add('lit');
    });
  });
  hero.addEventListener('pointerleave', () => hero.classList.remove('lit'));
}

export function initEffects(): void {
  heroLight();
  cursor();
  spotlight();
  parallax();
  progressAndTop();
  confetti();
}
