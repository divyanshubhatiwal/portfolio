// 3D hero: a slowly turning "neural sphere" of linked points that leans toward the cursor.
// Loaded lazily (dynamic import) and only on capable devices; everyone else keeps the 2D network.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, LineBasicMaterial, LineSegments,
  NormalBlending, PerspectiveCamera, Points, PointsMaterial, Scene, WebGLRenderer,
} from 'three';

const N = 420, RADIUS = 2.2, NEIGHBOURS = 3;

/** Evenly spread points on a sphere (Fibonacci lattice). */
function spherePoints(): Float32Array {
  const pos = new Float32Array(N * 3), golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), t = golden * i;
    // small jitter so the lattice doesn't look machine-perfect
    const j = 1 + (Math.random() - 0.5) * 0.06;
    pos.set([Math.cos(t) * r * RADIUS * j, y * RADIUS * j, Math.sin(t) * r * RADIUS * j], i * 3);
  }
  return pos;
}

/** Link every point to its nearest neighbours (computed once). */
function edges(pos: Float32Array): Float32Array {
  const seen = new Set<string>(), out: number[] = [];
  for (let i = 0; i < N; i++) {
    const d: [number, number][] = [];
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const dx = pos[i * 3]! - pos[j * 3]!, dy = pos[i * 3 + 1]! - pos[j * 3 + 1]!, dz = pos[i * 3 + 2]! - pos[j * 3 + 2]!;
      d.push([dx * dx + dy * dy + dz * dz, j]);
    }
    d.sort((a, b) => a[0] - b[0]);
    for (const [, j] of d.slice(0, NEIGHBOURS)) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!, pos[j * 3]!, pos[j * 3 + 1]!, pos[j * 3 + 2]!);
    }
  }
  return new Float32Array(out);
}

/** Colour each vertex by height, blending between the two accent colours. */
function paint(geo: BufferGeometry, a: Color, b: Color): void {
  const p = geo.getAttribute('position') as BufferAttribute, col = new Float32Array(p.count * 3), c = new Color();
  for (let i = 0; i < p.count; i++) {
    c.copy(a).lerp(b, (p.getY(i) / RADIUS + 1) / 2);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new BufferAttribute(col, 3));
}

/** Mounts the scene into the hero. Returns false if it couldn't start, so the caller can use the 2D fallback. */
export function mountHero3D(): boolean {
  const hero = document.getElementById('home'), host = document.getElementById('particles');
  if (!hero || !host) return false;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return false;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.domElement.className = 'hero3d';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.querySelector('#net')?.remove(); // the 2D network isn't needed when 3D runs
  host.appendChild(renderer.domElement);

  const scene = new Scene(), camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 7;
  const group = new Group();
  scene.add(group);

  const pos = spherePoints();
  const pGeo = new BufferGeometry(); pGeo.setAttribute('position', new BufferAttribute(pos, 3));
  const lGeo = new BufferGeometry(); lGeo.setAttribute('position', new BufferAttribute(edges(pos), 3));
  const pMat = new PointsMaterial({ size: 0.055, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
  const lMat = new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false });
  group.add(new Points(pGeo, pMat), new LineSegments(lGeo, lMat));

  const applyTheme = () => {
    const css = getComputedStyle(document.documentElement);
    const a = new Color(css.getPropertyValue('--accent').trim() || '#14b8a6');
    const b = new Color(css.getPropertyValue('--accent-2').trim() || '#0d9488');
    paint(pGeo, a, b); paint(lGeo, a, b);
    const dark = document.documentElement.dataset.theme === 'dark';
    // additive glow looks great on dark backgrounds but washes out on light ones
    for (const m of [pMat, lMat]) { m.blending = dark ? AdditiveBlending : NormalBlending; m.needsUpdate = true; }
    lMat.opacity = dark ? 0.22 : 0.35;
  };
  applyTheme();
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const resize = () => {
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // wide screens: sit to the right of the name; narrower: centred and fainter behind the text
    const wide = camera.aspect > 1.25;
    group.position.x = wide ? 2.9 : 0;
    host.style.opacity = wide ? '1' : '0.45';
  };
  new ResizeObserver(resize).observe(hero);
  resize();

  // lean toward the cursor, eased so it feels weighty rather than twitchy
  const target = { x: 0, y: 0 };
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    target.x = ((e.clientY - r.top) / r.height - 0.5) * 0.5;
    target.y = ((e.clientX - r.left) / r.width - 0.5) * 0.7;
  });
  hero.addEventListener('pointerleave', () => { target.x = 0; target.y = 0; });

  let visible = true, raf = 0, last = performance.now(), spin = 0;
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    spin += dt * 0.12;
    group.rotation.y += (spin + target.y - group.rotation.y) * Math.min(dt * 3, 1);
    group.rotation.x += (target.x - group.rotation.x) * Math.min(dt * 3, 1);
    group.scale.setScalar(1 + Math.sin(now / 1400) * 0.018);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  const play = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const pause = () => { cancelAnimationFrame(raf); raf = 0; };
  new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; visible ? play() : pause(); }).observe(hero);
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));
  play();
  return true;
}
