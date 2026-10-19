// Case-study enhancements, both written as plain HTML inside the Markdown files:
//  - [data-diagram]: an architecture diagram whose boxes explain themselves when clicked
//  - [data-story]:   a "scrollytelling" block where each step lights up its stage as you scroll past it
import { $$, reducedMotion } from './dom';

function diagrams(): void {
  for (const dg of $$('[data-diagram]')) {
    const nodes = $$<HTMLButtonElement>('.dg-node', dg);
    const details = $$('[data-detail]', dg);
    const select = (key: string) => {
      for (const n of nodes) {
        const on = n.dataset.k === key;
        n.classList.toggle('active', on);
        n.setAttribute('aria-pressed', String(on));
      }
      for (const d of details) d.hidden = d.dataset.detail !== key;
    };
    nodes.forEach((n, i) => {
      n.setAttribute('aria-controls', details.map((d) => d.id).filter(Boolean).join(' '));
      n.addEventListener('click', () => select(n.dataset.k ?? ''));
      n.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const next = nodes[(i + d + nodes.length) % nodes.length]!;
        next.focus();
        select(next.dataset.k ?? '');
      });
    });
    select(nodes[0]?.dataset.k ?? '');
  }
}

function stories(): void {
  for (const story of $$('[data-story]')) {
    const steps = $$('[data-step]', story);
    const nodes = $$('[data-node]', story);
    const show = (i: string) => {
      for (const s of steps) s.classList.toggle('active', s.dataset.step === i);
      // nodes up to the active step are "done", the active one glows
      for (const n of nodes) {
        const k = Number(n.dataset.node), cur = Number(i);
        n.classList.toggle('active', k === cur);
        n.classList.toggle('done', k < cur);
      }
    };
    if (reducedMotion()) { story.classList.add('static'); show(String(steps.length - 1)); continue; }
    // the step crossing the middle of the screen is the active one
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) show((e.target as HTMLElement).dataset.step ?? '0');
    }, { rootMargin: '-45% 0px -45% 0px' });
    for (const s of steps) io.observe(s);
    show('0');
  }
}

export function initArticle(): void {
  diagrams();
  stories();
}
