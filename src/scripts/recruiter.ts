// Recruiter view: /?for=backend (or ai, frontend, fullstack, mobile) puts the most relevant projects
// and skills first and says so in a small banner. Nothing is hidden; the order is all that changes.
import { $, $$ } from './dom';

interface Focus { label: string; cats: string[]; tags: RegExp; skills: string[] }

export const FOCUS: Record<string, Focus> = {
  ai: { label: 'AI / ML', cats: ['AI / ML'], tags: /llm|rag|optuna|scikit|anomaly|graph|claude|vector|experiment/i, skills: ['AI / ML', 'Languages'] },
  backend: { label: 'backend', cats: ['Backend'], tags: /fastapi|node|express|postgres|redis|mongo|celery|elasticsearch|docker|webrtc|jest|pytest/i, skills: ['Backend & Data', 'Languages'] },
  frontend: { label: 'frontend', cats: [], tags: /react|tailwind|typescript|vite|reanimated|expo/i, skills: ['Frontend & Mobile', 'Languages'] },
  fullstack: { label: 'full-stack', cats: ['Full-Stack'], tags: /react|node|supabase|mongo|postgres/i, skills: ['Frontend & Mobile', 'Backend & Data'] },
  mobile: { label: 'mobile', cats: ['Mobile'], tags: /react native|expo|reanimated|flutter/i, skills: ['Frontend & Mobile', 'Languages'] },
};

export function initRecruiterView(): void {
  const key = new URLSearchParams(location.search).get('for')?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
  const focus = FOCUS[key];
  const grid = $('#project-grid');
  if (!focus || !grid) return;

  // projects: category match counts double, each matching tag once; ties keep the original order
  const cards = $$('.project', grid);
  const score = (el: HTMLElement) =>
    (focus.cats.includes(el.dataset.cat ?? '') ? 2 : 0) + $$('.tags span', el).filter((t) => focus.tags.test(t.textContent ?? '')).length;
  cards.map((el, i) => ({ el, i, s: score(el) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .forEach(({ el }) => grid.append(el));

  // skills: the relevant groups first
  const skills = $('#skills .skills-grid');
  if (skills) {
    const groups = $$('.skill-cat', skills);
    const rank = (el: HTMLElement) => {
      const i = focus.skills.indexOf(el.dataset.group ?? ''); // the English group name, on every language
      return i < 0 ? 99 : i;
    };
    groups.sort((a, b) => rank(a) - rank(b)).forEach((el, i) => {
      skills.append(el);
      const n = el.querySelector('h3 .n');
      if (n) n.textContent = `0${i + 1}`;
    });
  }

  const banner = document.createElement('div');
  banner.className = 'focus-banner';
  banner.setAttribute('role', 'status');
  // text comes from the page, so it's in the page's language
  banner.innerHTML = `<span>${grid.dataset.focusShown ?? 'Showing my <b></b> work first.'}</span> <a></a>`;
  const reset = banner.querySelector('a')!;
  reset.href = location.pathname;
  reset.textContent = grid.dataset.focusReset ?? 'Show the usual order';
  const b = banner.querySelector('b');
  if (b) b.textContent = focus.label;
  $('#projects .wrap')?.prepend(banner);
}
