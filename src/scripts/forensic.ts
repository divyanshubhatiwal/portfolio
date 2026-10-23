// /demo/forensic: three click-the-event questions, then reveal the agent's flags, stages and reasons.
import { $, $$ } from './dom';

interface Question { q: string; answer: string; why: string }

const root = $('#fx');
if (root) {
  const questions = JSON.parse(root.dataset.questions ?? '[]') as Question[];
  let i = 0;
  let correct = 0;
  let tries = 0;
  const rows = $$<HTMLTableRowElement>('.fx-table tbody tr');
  const set = (id: string, text: string) => { const el = $(id); if (el) el.textContent = text; };

  const reveal = () => {
    if (i < questions.length) { // revealed early, with the button
      set('#fx-step', 'Analysis shown');
      set('#fx-q', 'Here is what the agent flagged. Each row now shows its severity, stage and the reason it was flagged.');
      set('#fx-feedback', '');
    }
    root.classList.add('revealed');
    const res = $('#fx-result');
    if (res) res.hidden = false;
    const btn = $<HTMLButtonElement>('#fx-reveal');
    if (btn) btn.hidden = true;
  };

  const pick = (row: HTMLTableRowElement) => {
    const q = questions[i];
    if (!q || root.classList.contains('revealed')) return;
    const id = row.dataset.id ?? '';
    if (id === q.answer) {
      if (tries === 0) correct += 1;
      row.classList.add('found');
      set('#fx-feedback', `Right: ${id}. ${q.why}`);
      i += 1; tries = 0;
      const next = questions[i];
      if (next) {
        set('#fx-step', `Question ${i + 1} of ${questions.length}`);
        set('#fx-q', next.q);
      } else {
        set('#fx-step', 'Done');
        set('#fx-q', `You got ${correct} of ${questions.length} on the first try. Here's what the agent flagged.`);
        reveal();
      }
    } else {
      tries += 1;
      row.classList.add('miss');
      setTimeout(() => row.classList.remove('miss'), 600);
      set('#fx-feedback', tries > 1 ? 'Not that one. Hint: look at the events between 02:09 and 02:16 UTC, in the middle of the night.' : 'Not that one. Try again.');
    }
  };

  for (const row of rows) {
    row.addEventListener('click', () => pick(row));
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(row); } });
  }
  $('#fx-reveal')?.addEventListener('click', reveal);
}
