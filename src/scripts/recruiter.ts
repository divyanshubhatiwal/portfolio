// Recruiter view: /?for=backend (or ai, frontend, fullstack, mobile) puts the most relevant projects
// and skills first and says so in a small banner. Nothing is hidden; the order is all that changes.
import { $, $$ } from './dom';
import { groupRank, projectScore, readFocus } from '@/lib/focus';

export function initRecruiterView(): void {
  const picked = readFocus();
  const grid = $('#project-grid');
  if (!picked || !grid) return;
  const { key, focus } = picked;

  // projects: most relevant first; ties keep the original order
  $$('.project', grid)
    .map((el, i) => ({ el, i, s: projectScore(focus, el.dataset.cat ?? '', $$('.tags span', el).map((t) => t.textContent ?? '')) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .forEach(({ el }) => grid.append(el));

  // skills: the relevant groups first (data-group is the English name, on every language)
  const skills = $('#skills .skills-grid');
  if (skills) {
    $$('.skill-cat', skills)
      .sort((a, b) => groupRank(focus, a.dataset.group ?? '') - groupRank(focus, b.dataset.group ?? ''))
      .forEach((el, i) => {
        skills.append(el);
        const n = el.querySelector('h3 .n');
        if (n) n.textContent = `0${i + 1}`;
      });
  }

  const banner = document.createElement('div');
  banner.className = 'focus-banner';
  banner.setAttribute('role', 'status');
  // text comes from the page, so it's in the page's language
  banner.innerHTML = `<span>${grid.dataset.focusShown ?? 'Showing my <b></b> work first.'}</span> <a class="cv-link"></a> <a class="reset"></a>`;
  const cv = banner.querySelector<HTMLAnchorElement>('.cv-link')!;
  cv.href = `/resume?for=${key}`;
  cv.textContent = grid.dataset.focusCv ?? 'Get a résumé for this role';
  const reset = banner.querySelector<HTMLAnchorElement>('.reset')!;
  reset.href = location.pathname;
  reset.textContent = grid.dataset.focusReset ?? 'Show the usual order';
  const b = banner.querySelector('b');
  if (b) b.textContent = focus.label;
  $('#projects .wrap')?.prepend(banner);
}
