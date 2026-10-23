// /demo/forensic-live: talks to public/forensic/worker.js, which runs the real pipeline in Pyodide.
import { $, $$, esc } from './dom';

interface Ev { id: string; at: string; type: string; user: string | null; process: string | null; path: string | null; dst: string | null; bytes_out: number | null; source: string; confidence: number }
interface Result {
  summary: Record<string, number | string>;
  sources: Record<string, number>; skew: Record<string, number>; anchors: Record<string, number>;
  incidents: { id: string; start: string; end: string; stages: string[]; score: number; confidence: number; rationale: string[]; events: Ev[] }[];
  anomalies: { id: string; score: number; severity: string; reasons: string[]; event: Ev }[];
  metrics: { name: string; value: number; detail: string }[];
}
interface Answer { query?: string; error?: string; findings: { statement: string; tier: string; confidence: number; evidence: string[]; reason: string }[]; withheld: number }

const root = $('#fl');
if (root) {
  const status = $('#fl-status')!, run = $<HTMLButtonElement>('#fl-run')!, pick = $<HTMLSelectElement>('#fl-case')!;
  const out = $('#fl-out')!;
  let worker: Worker | null = null;
  let ready = false;

  const time = (iso: string) => iso.slice(11, 19);
  const detail = (e: Ev) => esc([e.user, e.process, e.path, e.dst ? `→ ${e.dst}` : '', e.bytes_out ? `${(e.bytes_out / 1e6).toFixed(1)} MB out` : ''].filter(Boolean).join(' · '));

  const render = (r: Result, seconds: number) => {
    const s = r.summary;
    const skew = Object.entries(r.skew).map(([f, v]) => `${esc(f)} ${v > 0 ? '+' : ''}${v}s (${r.anchors[f] ?? 0} anchors)`).join(', ');
    $('#fl-summary')!.innerHTML = [
      [s.events, `events from ${s.sources} log sources`], [s.entities, `entities, ${s.relations} relations`],
      [s.anomalies, `flagged anomalous (${s.high_severity} high)`], [s.incidents, 'incident chains linked'],
      [s.mean_timestamp_confidence, 'mean timestamp confidence'], [`${seconds}s`, 'to analyse, in your browser'],
    ].map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('') + (skew ? `<p class="fl-note">Clock skew corrected: ${skew}.</p>` : '');
    $('#fl-incidents')!.innerHTML = r.incidents.map((inc) => `<article class="fl-inc">
      <header><b>${esc(inc.id)}</b><span>${esc(inc.start.slice(0, 10))} ${time(inc.start)}–${time(inc.end)} UTC · score ${inc.score} · confidence ${inc.confidence}</span></header>
      <p class="fl-stages">${inc.stages.map((st) => `<span>${esc(st)}</span>`).join('<i>→</i>')}</p>
      <ul class="fl-why">${inc.rationale.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <div class="table-wrap"><table><tbody>${inc.events.map((e) => `<tr><td><code>${time(e.at)}</code></td><td>${esc(e.type)}</td><td>${detail(e)}</td><td><code>${esc(e.id)}</code></td></tr>`).join('')}</tbody></table></div>
    </article>`).join('') || '<p>No incident chains in this case.</p>';
    $('#fl-eval')!.innerHTML = r.metrics.map((m) => `<tr><td>${esc(m.name)}</td><td><b>${m.value.toFixed(3)}</b></td><td>${esc(m.detail)}</td></tr>`).join('');
    $('#fl-anom')!.innerHTML = r.anomalies.map((a) => `<tr><td><code>${esc(a.id)}</code><br><small>${time(a.event.at)} ${esc(a.event.type)}</small></td><td><span class="sev sev-${a.severity[0]}">${esc(a.severity)}</span> ${a.score}</td><td>${esc(a.reasons.join('; ') || 'model score only; no rule matched')}</td></tr>`).join('');
    out.hidden = false;
  };

  const showAnswer = (a: Answer) => {
    const box = $('#fl-answer')!;
    if (a.error) { box.innerHTML = `<p>${esc(a.error)}</p>`; return; }
    box.innerHTML = a.findings.length
      ? `<p class="fl-note">Interpreted as: ${esc(a.query ?? '')}</p><ul class="fl-findings">${a.findings.map((f) => `<li class="t-${esc(f.tier)}">
          <span class="tier">${esc(f.tier)}</span> ${esc(f.statement)}
          <small>confidence ${f.confidence} · evidence ${f.evidence.map((id) => `<code>${esc(id)}</code>`).join(' ')}${f.reason ? ` · ${esc(f.reason)}` : ''}</small></li>`).join('')}</ul>`
      : `<p>No evidence in this case matches that question${a.query ? ` (${esc(a.query)})` : ''}. Nothing is asserted where nothing was recorded.</p>`;
  };

  const start = () => {
    worker = new Worker('/forensic/worker.js');
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data as { type: string; text?: string; seconds?: number; data?: unknown };
      if (m.type === 'progress') status.textContent = m.text ?? '';
      else if (m.type === 'ready') {
        ready = true;
        status.textContent = `Python ready in ${m.seconds}s. Analysing ${pick.value}…`;
        worker!.postMessage({ type: 'run', case: pick.value });
      } else if (m.type === 'result') {
        status.textContent = `Analysed ${pick.value}. Change the case to run it again.`;
        run.disabled = false; run.textContent = 'Run again';
        render(m.data as Result, m.seconds ?? 0);
      } else if (m.type === 'answer') showAnswer(m.data as Answer);
      else if (m.type === 'error') { status.textContent = `Something went wrong: ${m.text}`; run.disabled = false; }
    };
    worker.postMessage({ type: 'load' });
  };

  run.addEventListener('click', () => {
    run.disabled = true;
    if (!worker) start();
    else if (ready) { status.textContent = `Analysing ${pick.value}…`; worker.postMessage({ type: 'run', case: pick.value }); }
  });
  pick.addEventListener('change', () => { if (ready) run.click(); });
  const ask = (q: string) => { if (ready && q.trim()) { $('#fl-answer')!.innerHTML = '<p class="fl-note">Searching the evidence…</p>'; worker!.postMessage({ type: 'ask', question: q }); } };
  $('#fl-ask')?.addEventListener('submit', (e) => { e.preventDefault(); ask($<HTMLInputElement>('#fl-q')!.value); });
  for (const b of $$('#fl-suggest button')) b.addEventListener('click', () => { $<HTMLInputElement>('#fl-q')!.value = b.textContent ?? ''; ask(b.textContent ?? ''); });
}
