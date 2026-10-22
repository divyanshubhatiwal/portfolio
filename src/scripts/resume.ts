// /resume: reorder for the chosen role, keep the page to one sheet, and print to PDF.
import { $, $$ } from './dom';
import { FOCUS, groupRank, projectScore, readFocus } from '@/lib/focus';

const cv = $('#cv');
if (cv) {
  const shown = Number(cv.dataset.shown ?? 5);
  const list = $('#cv-projects')!, skills = $('#cv-skills')!;
  const items = $$('.cv-item', list); // original order
  const groups = $$('[data-group]', skills);
  const role = $<HTMLSelectElement>('#cv-role')!;

  const apply = (key: string) => {
    const focus = FOCUS[key];
    const ordered = focus
      ? items.map((el, i) => ({ el, i, s: projectScore(focus, el.dataset.cat ?? '', (el.dataset.tags ?? '').split('|')) }))
        .sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.el)
      : items;
    ordered.forEach((el, i) => { list.append(el); el.classList.toggle('cut', i >= shown); });
    (focus ? [...groups].sort((a, b) => groupRank(focus, a.dataset.group ?? '') - groupRank(focus, b.dataset.group ?? '')) : groups)
      .forEach((el) => skills.append(el));
    document.title = `Résumé${focus ? ` (${focus.label})` : ''} | Divyanshu Bhatiwal`; // becomes the PDF's file name
  };

  const start = readFocus();
  role.value = start?.key ?? '';
  apply(role.value);
  role.addEventListener('change', () => {
    const url = new URL(location.href);
    if (role.value) url.searchParams.set('for', role.value); else url.searchParams.delete('for');
    history.replaceState(history.state, '', url);
    apply(role.value);
  });
  $('#cv-print')?.addEventListener('click', () => print());
}
