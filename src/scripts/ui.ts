// Theme toggle, mobile menu, "Let's connect" overlay, experience tabs and project filters.
import { $, $$ } from './dom';

export function toggleTheme(): string {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch { /* storage blocked */ }
  return root.dataset.theme;
}

function themeButton(): void {
  $('#theme-btn')?.addEventListener('click', toggleTheme);
}

function mobileMenu(): void {
  const btn = $('#menu-btn'), menu = $('#mobile-menu');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
  for (const a of $$('a', menu)) a.addEventListener('click', () => { menu.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); });
}

export function openConnect(e?: MouseEvent): void {
  const overlay = $('#connect');
  if (!overlay) return;
  overlay.style.setProperty('--cx', `${e?.clientX ?? innerWidth / 2}px`);
  overlay.style.setProperty('--cy', `${e?.clientY ?? innerHeight / 2}px`);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function connectOverlay(): void {
  const overlay = $('#connect');
  if (!overlay) return;
  const close = () => { overlay.classList.remove('open'); document.body.style.overflow = ''; };
  for (const b of $$('[data-connect]')) b.addEventListener('click', (e) => openConnect(e as MouseEvent));
  $('#connect-close')?.addEventListener('click', close);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });
}

/** Experience tabs: panels are rendered at build time; this only switches between them (with arrow-key support). */
function experienceTabs(): void {
  const tabs = $$<HTMLButtonElement>('.exp-tab');
  if (!tabs.length) return;
  const select = (i: number, focus = false) => {
    tabs.forEach((t, j) => {
      const on = i === j;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls') ?? '');
      if (panel) panel.hidden = !on;
    });
    if (focus) tabs[i]?.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      select((i + d + tabs.length) % tabs.length, true);
    });
  });
}

/** Category filters with a staggered pop-in, plus "+N / Show less" on long tag lists. */
function projectFilters(): void {
  const bar = $('#filters'), grid = $('#project-grid');
  if (!bar || !grid) return;
  bar.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('.filter');
    if (!b) return;
    for (const x of $$('.filter', bar)) {
      x.classList.toggle('active', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    }
    let n = 0;
    for (const p of $$('.project', grid)) {
      const hide = b.dataset.f !== 'All' && p.dataset.cat !== b.dataset.f;
      p.classList.toggle('hide', hide);
      p.classList.remove('pop');
      if (hide) continue;
      void p.offsetWidth; // restart the animation
      p.style.setProperty('--pd', `${n++ * 0.05}s`);
      p.classList.add('pop');
    }
  });
  grid.addEventListener('click', (e) => {
    const m = (e.target as Element).closest<HTMLElement>('.more');
    if (!m) return;
    const collapsed = m.parentElement?.classList.toggle('collapsed') ?? true;
    m.textContent = collapsed ? (m.dataset.more ?? '') : 'Show less';
    m.setAttribute('aria-expanded', String(!collapsed));
  });
}

export function initUI(): void {
  themeButton();
  mobileMenu();
  connectOverlay();
  experienceTabs();
  projectFilters();
}
