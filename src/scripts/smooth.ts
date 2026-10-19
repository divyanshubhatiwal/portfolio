// Smooth (inertial) scrolling with Lenis. Skipped when the visitor prefers reduced motion.
import Lenis from 'lenis';
import { $$, reducedMotion, setScroller } from './dom';

export function initSmoothScroll(): void {
  if (reducedMotion()) return;
  const lenis = new Lenis({ duration: 1.15, smoothWheel: true, autoRaf: true });
  setScroller(lenis);
  document.documentElement.classList.add('lenis');

  // in-page links glide to their section instead of jumping
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    const href = a?.getAttribute('href');
    if (!a || !href || href === '#') return;
    const target = document.querySelector<HTMLElement>(href);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -64 });
    history.replaceState(null, '', href);
  });

  // pause while a full-screen overlay is open so the page behind it doesn't scroll
  const overlays = $$('#connect, #term, #palette');
  const sync = () => (overlays.some((o) => o.classList.contains('open')) ? lenis.stop() : lenis.start());
  for (const o of overlays) new MutationObserver(sync).observe(o, { attributes: true, attributeFilter: ['class'] });
}
