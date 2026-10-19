// T20 demo: runs the exported Linear Regression in the browser.
// Feature order must match model.py: batting_team, bowling_team, venue, over, current_score,
// wickets, current_run_rate, last_5_overs_runs (teams and venue are label-encoded indices).
import { $ } from './dom';

const raw = $('#t20-model')?.textContent;
const model = raw ? (JSON.parse(raw) as { coef: number[]; intercept: number }) : null;

const sel = (id: string) => $<HTMLSelectElement>(id);
const num = (id: string) => $<HTMLInputElement>(id);
const bat = sel('#t20-bat'), bowl = sel('#t20-bowl'), venue = sel('#t20-venue');
const over = num('#t20-over'), wk = num('#t20-wk'), score = num('#t20-score'), last5 = num('#t20-last5');

function update(): void {
  if (!model || !bat || !bowl || !venue || !over || !wk || !score || !last5) return;
  const o = Number(over.value), w = Number(wk.value);
  const s = Math.max(0, Math.min(300, Math.round(Number(score.value) || 0)));
  // in the first five overs, "last 5 overs" is the whole innings so far (as in the generator)
  if (o <= 5) { last5.value = String(s); last5.disabled = true; } else { last5.disabled = false; }
  const l5 = Math.max(0, Math.min(s, Math.round(Number(last5.value) || 0)));
  const crr = Math.round((s / o) * 100) / 100;

  const x = [Number(bat.value), Number(bowl.value), Number(venue.value), o, s, w, crr, l5];
  const raw = model.intercept + model.coef.reduce((sum, c, i) => sum + c * (x[i] ?? 0), 0);
  const pred = Math.max(s, Math.round(raw)); // a final score can't be below the current one
  const naive = Math.round(s + crr * (20 - o));

  const set = (id: string, v: string) => { const el = $(id); if (el) el.textContent = v; };
  set('#t20-over-v', String(o));
  set('#t20-wk-v', String(w));
  set('#t20-pred', String(pred));
  set('#t20-crr', crr.toFixed(2));
  set('#t20-naive', String(naive));
  const d = pred - naive;
  set('#t20-diff', d === 0 ? 'same' : `${d > 0 ? '+' : ''}${d} runs`);
  // keep the bowling side different from the batting side
  for (const opt of bowl.options) opt.disabled = opt.value === bat.value;
  if (bowl.value === bat.value) bowl.value = String((Number(bat.value) + 1) % bowl.options.length);
}

for (const el of [bat, bowl, venue, over, wk, score, last5]) el?.addEventListener('input', update);
update();
