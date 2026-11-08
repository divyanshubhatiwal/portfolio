// Home page nav: a pill slides under the link for the section being read, and that link gets
// aria-current="location". Sections count as "being read" when they cross the upper middle of the screen.
import { $, $$, reducedMotion } from './dom';

export function initScrollSpy(): void {
  const pill = $('.nav-pill');
  const nav = pill?.parentElement;
  if (!pill || !nav) return;
  const links = $$<HTMLAnchorElement>('a[href^="#"]', nav);
  const byId = new Map(links.map((a) => [a.getAttribute('href')!.slice(1), a]));
  const sections = [...byId.keys()].map((id) => document.getElementById(id)).filter((s): s is HTMLElement => !!s);
  if (!sections.length) return;
  if (reducedMotion()) pill.style.transition = 'none';

  let current: HTMLAnchorElement | null = null;
  const show = (a: HTMLAnchorElement | null) => {
    if (a === current) return;
    current?.removeAttribute('aria-current');
    current = a;
    if (!a) { pill.style.opacity = '0'; return; }
    a.setAttribute('aria-current', 'location');
    pill.style.opacity = '1';
    pill.style.width = `${a.offsetWidth}px`;
    pill.style.transform = `translateX(${a.offsetLeft}px)`;
  };
  const visible = new Set<string>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id);
    // the first section in page order that's in the band wins
    const id = sections.find((s) => visible.has(s.id))?.id;
    show(id ? byId.get(id) ?? null : null);
  }, { rootMargin: '-35% 0px -55% 0px' });
  for (const s of sections) io.observe(s);
  addEventListener('resize', () => { const a = current; current = null; show(a); });
}