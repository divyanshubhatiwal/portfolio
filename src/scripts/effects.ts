// Visual effects: cursor, spotlight, tilt, magnetic buttons, photo colour lens, parallax,
// scroll progress and confetti.
import { $, $$, coarsePointer, finePointer, reducedMotion, scrollTop } from './dom';

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

/** 3D tilt with light glare on cards, plus buttons that lean toward the cursor. Mouse only. */
function tiltAndMagnet(): void {
  if (!finePointer() || reducedMotion()) return;
  const MAX = 7;
  for (const el of $$('.project, .cert, .skill-cat, .highlight, .photo, .exp-panel')) {
    el.classList.add('tilt');
    const glare = document.createElement('span');
    glare.className = 'glare';
    el.appendChild(glare);
    el.addEventListener('pointermove', (e) => {
      if (el.classList.contains('reveal') && !el.classList.contains('in')) return;
      const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.classList.add('tilting');
      el.style.transform = `perspective(900px) rotateX(${((0.5 - py) * MAX).toFixed(2)}deg) rotateY(${((px - 0.5) * MAX).toFixed(2)}deg) translateY(-4px)`;
      el.style.setProperty('--gx', `${px * 100}%`);
      el.style.setProperty('--gy', `${py * 100}%`);
    });
    el.addEventListener('pointerleave', () => { el.classList.remove('tilting'); el.style.transform = ''; });
  }
  for (const el of $$('.btn, .socials a, .icon-btn, #magic-btn, #top-btn')) {
    el.classList.add('magnet');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.3, y = (e.clientY - r.top - r.height / 2) * 0.3;
      el.classList.add('pulling');
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    });
    el.addEventListener('pointerleave', () => { el.classList.remove('pulling'); el.style.transform = ''; });
  }
}

/** Black-and-white photo that shows colour only inside a circle around the cursor (or finger). */
function photoLens(): void {
  const frame = $('.photo .frame'), pimg = $('.photo .pimg');
  if (!frame || !pimg) return;
  const R = coarsePointer() ? '90px' : '120px';
  const move = (e: PointerEvent) => {
    const r = pimg.getBoundingClientRect(); // includes the parallax/zoom transform, so the circle lines up with the cursor
    pimg.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(2)}%`);
    pimg.style.setProperty('--my', `${(((e.clientY - r.top) / r.height) * 100).toFixed(2)}%`);
  };
  frame.addEventListener('pointerenter', (e) => { move(e); pimg.style.setProperty('--lens', R); });
  frame.addEventListener('pointermove', move);
  frame.addEventListener('pointerleave', () => pimg.style.setProperty('--lens', '0px'));
  frame.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { move(e); pimg.style.setProperty('--lens', R); } });
  frame.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') pimg.style.setProperty('--lens', '0px'); });
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
  tiltAndMagnet();
  photoLens();
  parallax();
  progressAndTop();
  confetti();
}
