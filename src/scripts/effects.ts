// Visual effects: cursor, spotlight, tilt, magnetic buttons, photo colour lens, parallax,
// scroll progress, confetti and the 2D particle network (fallback when WebGL is unavailable).
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

interface Node2D { x: number; y: number; vx: number; vy: number; r: number; hue: 0 | 1 }

/** 2D particle network: drifting nodes that link up and lean toward the cursor. Used when WebGL isn't available. */
export function particleNetwork(): void {
  const cv = $<HTMLCanvasElement>('#net'), hero = $('#home');
  const ctx = cv?.getContext('2d');
  if (!cv || !hero || !ctx) return;
  const still = reducedMotion();
  let w = 0, h = 0, nodes: Node2D[] = [], visible = true;
  const mouse = { x: -9999, y: -9999 };
  const LINK = 130, MOUSE_R = 170;
  const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const hexA = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

  const resize = () => {
    const r = hero.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the link check is O(n²), so use far fewer nodes on phones
    const small = w < 760 || coarsePointer();
    const count = Math.min(small ? 28 : 80, Math.round((w * h) / (small ? 20000 : 14000)));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      r: 1 + Math.random() * 1.8, hue: Math.random() < 0.5 ? 0 : 1,
    }));
  };

  const draw = () => {
    const c1 = css('--accent'), c2 = css('--accent-2');
    ctx.clearRect(0, 0, w, h);
    for (const n of nodes) {
      const dx = mouse.x - n.x, dy = mouse.y - n.y, d = Math.hypot(dx, dy);
      if (d < MOUSE_R && d > 1) { n.vx += (dx / d) * 0.015; n.vy += (dy / d) * 0.015; }
      n.vx *= 0.985; n.vy *= 0.985;
      if (Math.hypot(n.vx, n.vy) < 0.12) { n.vx += (Math.random() - 0.5) * 0.04; n.vy += (Math.random() - 0.5) * 0.04; }
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
      n.x = Math.max(0, Math.min(w, n.x)); n.y = Math.max(0, Math.min(h, n.y));
    }
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]!;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]!, d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < LINK) {
          ctx.strokeStyle = hexA(a.hue ? c2 : c1, (1 - d / LINK) * 0.35);
          ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
      if (md < MOUSE_R) {
        ctx.strokeStyle = hexA(c2, (1 - md / MOUSE_R) * 0.6);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
      }
      ctx.fillStyle = hexA(a.hue ? c2 : c1, 0.9);
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
    }
  };
  const loop = () => { if (visible) draw(); requestAnimationFrame(loop); };

  hero.addEventListener('pointermove', (e) => { const r = hero.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
  new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; }).observe(hero);
  addEventListener('resize', resize);
  resize();
  if (still) draw(); else requestAnimationFrame(loop);
}

export function initEffects(): void {
  cursor();
  spotlight();
  tiltAndMagnet();
  photoLens();
  parallax();
  progressAndTop();
  confetti();
}
