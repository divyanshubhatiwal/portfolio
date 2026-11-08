// Home page: a small chapter indicator (bottom left) that follows the section being read,
// e.g. "IV / VIII · The Work", with a progress bar. Chapter names come from each section's eyebrow.
import { $, $$ } from './dom';

export function initChapters(): void {
  const hero = $('#home');
  if (!hero) return;
  const sections = [hero, ...$$<HTMLElement>('section.block')].filter((s) => s === hero || s.querySelector('.eyebrow'));
  const names = sections.map((s) => (s === hero ? s.dataset.chapter ?? '' : s.querySelector('.eyebrow')!.textContent ?? '').trim());
  if (sections.length < 2) return;

  const box = document.createElement('div');
  box.className = 'chapter-ind';
  box.setAttribute('aria-hidden', 'true'); // the headings themselves carry this for assistive tech
  box.innerHTML = '<span class="ci-name"></span><span class="ci-bar"><i></i></span>';
  document.body.append(box);
  const name = box.querySelector('.ci-name')!, bar = box.querySelector<HTMLElement>('.ci-bar i')!;

  let current = -1;
  const show = (i: number) => {
    if (i === current || i < 0) return;
    current = i;
    box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap'); // restart the text transition
    name.textContent = names[i] ?? '';
    bar.style.transform = `scaleX(${(i + 1) / sections.length})`;
  };
  const visible = new Set<Element>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
    show(sections.findIndex((s) => visible.has(s)));
  }, { rootMargin: '-40% 0px -55% 0px' });
  for (const s of sections) io.observe(s);
  show(0);
}