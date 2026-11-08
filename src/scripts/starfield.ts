// Live starfield behind the whole site: twinkling stars at several depths (parallax on scroll),
// constellations that draw themselves between nearby stars and fade, an occasional shooting star,
// and, with a mouse, faint lines from the cursor to the stars around it.
// One 2D canvas; pauses while the tab is hidden; a still sky for reduced motion.
import { finePointer, reducedMotion } from './dom';

interface Star { x: number; y: number; r: number; a: number; tw: number; ph: number; depth: number }
interface Constellation { pts: number[]; born: number }
interface Meteor { x: number; y: number; vx: number; vy: number; born: number }

const DRAW = 2600, HOLD = 2200, FADE = 1600; // constellation phases, ms
const LIFE = DRAW + HOLD + FADE;

export function initStarfield(): void {
  const canvas = document.getElementById('stars') as HTMLCanvasElement | null;
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;
  document.documentElement.classList.add('has-stars');

  const still = reducedMotion();
  let w = 0, h = 0, dpr = 1;
  let stars: Star[] = [];
  const shapes: Constellation[] = [];
  const meteors: Meteor[] = [];
  const mouse = { x: -1e4, y: -1e4 };
  let star = '255,255,255', line = '94,234,212';

  const colours = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    star = dark ? '230,232,234' : '40,48,56';
    line = dark ? '94,234,212' : '15,118,110';
  };

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(340, Math.round((w * h) / 4800));
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() < 0.9 ? 0.3 + Math.random() * 0.8 : 1.1 + Math.random() * 0.7,
      a: 0.25 + Math.random() * 0.65, tw: 0.4 + Math.random() * 1.6, ph: Math.random() * Math.PI * 2,
      depth: 0.02 + Math.random() * 0.12,
    }));
    shapes.length = 0;
  };

  // where a star is on screen right now (stars at different depths drift at different speeds as the page scrolls)
  const pos = (s: Star) => {
    const y = (((s.y - scrollY * s.depth) % h) + h) % h;
    return { x: s.x, y };
  };

  // a constellation: a short chain of nearby stars, each step to the closest unused neighbour
  const newConstellation = (t: number) => {
    const start = Math.floor(Math.random() * stars.length);
    const pts = [start];
    const len = 3 + Math.floor(Math.random() * 3);
    while (pts.length < len) {
      const p = pos(stars[pts.at(-1)!]!);
      let best = -1, bestD = 170;
      stars.forEach((s, i) => {
        if (pts.includes(i)) return;
        const q = pos(s), d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d > 40 && d < bestD) { bestD = d; best = i; }
      });
      if (best < 0) break;
      pts.push(best);
    }
    if (pts.length >= 3) shapes.push({ pts, born: t });
  };

  const draw = (t: number) => {
    ctx.clearRect(0, 0, w, h);

    for (const s of stars) {
      const { x, y } = pos(s);
      const a = still ? s.a : s.a * (0.55 + 0.45 * Math.sin(t / 1000 * s.tw + s.ph));
      ctx.fillStyle = `rgba(${star},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    if (still) return;

    // constellations: lines grow one segment at a time, then hold and fade
    for (let k = shapes.length - 1; k >= 0; k--) {
      const c = shapes[k]!, age = t - c.born;
      if (age > LIFE) { shapes.splice(k, 1); continue; }
      // kept faint: constellations sometimes form behind text, and must never compete with it
      const alpha = age < DRAW + HOLD ? 0.36 : 0.36 * (1 - (age - DRAW - HOLD) / FADE);
      const segs = c.pts.length - 1, progress = Math.min(1, age / DRAW) * segs;
      ctx.strokeStyle = `rgba(${line},${alpha.toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < segs && i < progress; i++) {
        const a = pos(stars[c.pts[i]!]!), b = pos(stars[c.pts[i + 1]!]!);
        const f = Math.min(1, progress - i);
        if (Math.hypot(b.x - a.x, b.y - a.y) > 260) continue; // a star wrapped around the screen edge
        ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
      }
      ctx.stroke();
      for (const i of c.pts.slice(0, Math.ceil(progress) + 1)) { // the stars it joins glow a little
        const p = pos(stars[i]!);
        ctx.fillStyle = `rgba(${line},${(alpha * 0.9).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill();
      }
    }

    // shooting stars
    for (let k = meteors.length - 1; k >= 0; k--) {
      const m = meteors[k]!, age = (t - m.born) / 1000;
      if (age > 1.1) { meteors.splice(k, 1); continue; }
      const x = m.x + m.vx * age, y = m.y + m.vy * age, fade = 1 - age / 1.1;
      const g = ctx.createLinearGradient(x, y, x - m.vx * 0.12, y - m.vy * 0.12);
      g.addColorStop(0, `rgba(${star},${(0.9 * fade).toFixed(3)})`);
      g.addColorStop(1, `rgba(${star},0)`);
      ctx.strokeStyle = g; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - m.vx * 0.12, y - m.vy * 0.12); ctx.stroke();
    }

    // the cursor reaches out to nearby stars
    if (mouse.x > -1e3) {
      for (const s of stars) {
        const p = pos(s), d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (d > 130) continue;
        ctx.strokeStyle = `rgba(${line},${(0.35 * (1 - d / 130)).toFixed(3)})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
    }
  };

  colours();
  resize();
  new MutationObserver(() => { colours(); if (still) draw(0); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  addEventListener('resize', () => { resize(); if (still) draw(0); });

  if (still) { draw(0); addEventListener('scroll', () => draw(0), { passive: true }); return; }

  if (finePointer()) {
    addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
  }

  let nextShape = performance.now() + 1200, nextMeteor = performance.now() + 5000;
  const frame = (t: number) => {
    if (!document.hidden) {
      if (t > nextShape && shapes.length < 2) { newConstellation(t); nextShape = t + 3500 + Math.random() * 3500; }
      if (t > nextMeteor) {
        const fromLeft = Math.random() < 0.5, speed = 520 + Math.random() * 380;
        meteors.push({ x: fromLeft ? Math.random() * w * 0.5 : w * (0.5 + Math.random() * 0.5), y: Math.random() * h * 0.4,
          vx: (fromLeft ? 1 : -1) * speed, vy: speed * 0.45, born: t });
        nextMeteor = t + 7000 + Math.random() * 8000;
      }
      draw(t);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
