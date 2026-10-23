// Project card clips: on desktop, hovering a card that has a demo clip plays it over the screenshot.
// The clip is only downloaded on first hover, and never plays for visitors who prefer reduced motion.
import { $$, finePointer, reducedMotion } from './dom';

export function initClips(): void {
  if (!finePointer() || reducedMotion()) return;
  for (const video of $$<HTMLVideoElement>('.project video.clip')) {
    const card = video.closest<HTMLElement>('.project');
    if (!card) continue;
    card.addEventListener('mouseenter', () => {
      if (!video.src && video.dataset.src) video.src = video.dataset.src;
      card.classList.add('playing');
      void video.play().catch(() => card.classList.remove('playing'));
    });
    card.addEventListener('mouseleave', () => { card.classList.remove('playing'); video.pause(); });
  }
}