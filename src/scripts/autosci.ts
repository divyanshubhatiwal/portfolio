// /demo/autosci: replays one task/seed of a real AutoSci study, experiment by experiment.
import { $, esc, reducedMotion } from './dom';

type Step = [score: number, incumbent: number, improved: 0 | 1, model: string, hypothesis: string, signals: string];
interface Trial { k: string; test: number | null; steps: Step[] }

const ARMS = ['random', 'bayes', 'heuristic'] as const;
const W = 640, H = 260, PAD = { l: 48, r: 12, t: 14, b: 30 };

const root = $('#as');
if (root) {
  const data = new Map((JSON.parse(root.dataset.replay ?? '[]') as Trial[]).map((t) => [t.k, t]));
  const task = $<HTMLSelectElement>('#as-task'), seed = $<HTMLSelectElement>('#as-seed');
  const chart = $('#as-chart'), lanes = $('#as-lanes'), count = $('#as-n'), play = $<HTMLButtonElement>('#as-play');
  let n = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  const trials = () => ARMS.map((a) => data.get(`${task?.value}|${seed?.value}|${a}`));
  const total = () => Math.max(...trials().map((t) => t?.steps.length ?? 0));

  function draw(): void {
    const ts = trials();
    const all = ts.flatMap((t) => t?.steps.map((s) => s[0]) ?? []);
    const lo = Math.floor(Math.min(...all) * 20) / 20, hi = Math.ceil(Math.max(...all) * 20) / 20 || 1;
    const steps = total();
    const x = (i: number) => PAD.l + (i / Math.max(1, steps - 1)) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);

    let svg = '';
    for (let g = 0; g <= 4; g++) {
      const v = lo + ((hi - lo) * g) / 4;
      svg += `<line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${PAD.l - 6}" y="${y(v) + 4}" text-anchor="end">${v.toFixed(2)}</text>`;
    }
    svg += `<text class="ax" x="${(W + PAD.l) / 2}" y="${H - 6}" text-anchor="middle">experiment</text>`;
    ts.forEach((t, a) => {
      if (!t) return;
      const shown = t.steps.slice(0, n);
      if (!shown.length) return;
      const pts = shown.map((s, i) => `${x(i).toFixed(1)},${y(s[1]).toFixed(1)}`).join(' ');
      svg += `<polyline class="ln a-${ARMS[a]}" points="${pts}"/>`;
      shown.forEach((s, i) => { svg += `<circle class="pt a-${ARMS[a]}${s[2] ? ' up' : ''}" cx="${x(i).toFixed(1)}" cy="${y(s[0]).toFixed(1)}" r="${s[2] ? 4 : 2.5}"><title>${ARMS[a]} #${i + 1}: ${s[3]} ${s[0].toFixed(4)}</title></circle>`; });
    });
    if (chart) chart.innerHTML = svg;

    if (lanes) {
      lanes.innerHTML = ts.map((t, a) => {
        const arm = ARMS[a]!;
        if (!t) return '';
        const rows = t.steps.slice(0, n).map((s, i) => `<li class="${s[2] ? 'up' : ''}">
          <span class="n">${i + 1}</span><span class="m">${esc(s[3].replace(/_/g, ' '))}</span><b>${s[0].toFixed(3)}</b>
          ${arm === 'heuristic' && s[4] ? `<small>${esc(s[4])}</small>` : ''}</li>`).reverse().join('');
        const best = n ? Math.max(...t.steps.slice(0, n).map((s) => s[1])) : null;
        const done = n >= t.steps.length && t.test != null;
        return `<div class="lane a-${arm}"><h3>${arm}</h3>
          <p class="lane-best">best so far <b>${best == null ? '—' : best.toFixed(3)}</b>${done ? `<br>held-out test <b>${t.test!.toFixed(3)}</b>` : ''}</p>
          <ol>${rows}</ol></div>`;
      }).join('');
    }
    if (count) count.textContent = String(n);
  }

  const stop = () => { clearInterval(timer); timer = undefined; if (play) play.textContent = n >= total() ? 'Replay' : 'Play'; };
  const advance = () => { if (n < total()) { n += 1; draw(); } if (n >= total()) stop(); };

  play?.addEventListener('click', () => {
    if (timer) { stop(); return; }
    if (n >= total()) n = 0;
    if (reducedMotion()) { n = total(); draw(); stop(); return; }
    play.textContent = 'Pause';
    advance();
    timer = setInterval(advance, 700);
  });
  $('#as-step')?.addEventListener('click', () => { stop(); advance(); });
  $('#as-all')?.addEventListener('click', () => { stop(); n = total(); draw(); if (play) play.textContent = 'Replay'; });
  for (const s of [task, seed]) s?.addEventListener('change', () => { stop(); n = 0; draw(); if (play) play.textContent = 'Play'; });
  draw();
}
