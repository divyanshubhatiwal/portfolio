// The 1-minute guided tour of the home page: each stop scrolls to a section, outlines it and shows a
// caption. Keyboard: arrow keys move, Esc ends. Text comes from the page (data-tour on #home).
import { $, esc, goTo, reducedMotion } from './dom';
import type { Dict } from '@/i18n/types';

type TourText = Dict['tour'];

export function initGuidedTour(): void {
  const hero = $('#home');
  const startBtn = $('#tour-start');
  if (!hero?.dataset.tour || !startBtn) return;
  const T = JSON.parse(hero.dataset.tour) as TourText;
  const stops = T.stops.filter(([sel]) => document.querySelector(sel));

  let i = -1;
  let box: HTMLDivElement | null = null;
  let ring: HTMLDivElement | null = null;
  let target: HTMLElement | null = null;

  const place = () => {
    if (!ring || !target) return;
    const r = target.getBoundingClientRect();
    Object.assign(ring.style, { top: `${r.top - 8}px`, left: `${r.left - 8}px`, width: `${r.width + 16}px`, height: `${Math.min(r.height, innerHeight - 40) + 16}px` });
  };

  const end = () => {
    box?.remove(); ring?.remove(); box = ring = null; target = null; i = -1;
    removeEventListener('keydown', onKey, true);
    removeEventListener('scroll', place);
    removeEventListener('resize', place);
    startBtn.focus({ preventScroll: true });
  };

  const show = (n: number) => {
    if (!box || !ring) return;
    i = n;
    if (i >= stops.length) { // closing card: where to go next
      ring.hidden = true;
      box.innerHTML = `<p class="gt-step">${stops.length} ${esc(T.of)} ${stops.length}</p><h3>${esc(T.endTitle)}</h3>
        <ul class="gt-links">${T.endLinks.map(([label, href]) => `<li><a href="${esc(href)}">${esc(label)} →</a></li>`).join('')}</ul>
        <div class="gt-btns"><button type="button" class="btn ghost" data-gt="back">${esc(T.back)}</button><button type="button" class="btn solid" data-gt="end">${esc(T.done)}</button></div>`;
      box.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
      return;
    }
    const [sel, title, text] = stops[i]!;
    target = document.querySelector<HTMLElement>(sel);
    if (!target) return;
    ring.hidden = false;
    goTo(sel); // through Lenis when smooth scrolling is on
    setTimeout(place, reducedMotion() ? 50 : 1200);
    place();
    box.innerHTML = `<p class="gt-step">${i + 1} ${esc(T.of)} ${stops.length}</p><h3>${esc(title)}</h3><p>${esc(text)}</p>
      <div class="gt-btns">
        <button type="button" class="gt-skip" data-gt="end">${esc(T.skip)}</button>
        ${i > 0 ? `<button type="button" class="btn ghost" data-gt="back">${esc(T.back)}</button>` : ''}
        <button type="button" class="btn solid" data-gt="next">${esc(T.next)}</button>
      </div>`;
    box.querySelector<HTMLElement>('[data-gt="next"]')?.focus({ preventScroll: true });
  };

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); end(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); show(Math.min(i + 1, stops.length)); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(Math.max(i - 1, 0)); }
  }

  startBtn.addEventListener('click', () => {
    if (box) return;
    ring = document.createElement('div');
    ring.className = 'gt-ring';
    ring.setAttribute('aria-hidden', 'true');
    box = document.createElement('div');
    box.className = 'gt-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', T.start);
    box.addEventListener('click', (e) => {
      const act = (e.target as Element).closest<HTMLElement>('[data-gt]')?.dataset.gt;
      if (act === 'next') show(i + 1);
      else if (act === 'back') show(Math.max(0, i - 1));
      else if (act === 'end') end();
    });
    document.body.append(ring, box);
    addEventListener('keydown', onKey, true);
    addEventListener('scroll', place, { passive: true });
    addEventListener('resize', place);
    show(0);
  });

  // a tour link can be shared: /#tour starts it
  if (location.hash === '#tour') { history.replaceState(history.state, '', location.pathname + location.search); goTo('#home'); startBtn.click(); }
}
