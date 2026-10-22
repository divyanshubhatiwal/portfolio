// Live status badges on project cards that have a live deployment, from /api/status.
// If the check isn't available (offline, or a static preview without the API) no badge is shown.
import { $, $$ } from './dom';

interface Result { name: string; ok: boolean; status: number | null; ms: number | null }

export async function initStatus(): Promise<void> {
  const grid = $('#project-grid');
  if (!grid) return;
  let results: Result[];
  try {
    const r = await fetch('/api/status', { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return;
    results = ((await r.json()) as { results: Result[] }).results;
  } catch { return; }
  const up = grid.dataset.statusUp ?? 'Up', down = grid.dataset.statusDown ?? 'Not responding';
  for (const res of results) {
    const card = $$('.project', grid).find((el) => el.dataset.name === res.name);
    const top = card?.querySelector('.top');
    if (!top || top.querySelector('.status-badge')) continue;
    const badge = document.createElement('span');
    badge.className = `status-badge ${res.ok ? 'up' : 'down'}`;
    badge.textContent = res.ok && res.ms != null ? `${up} · ${res.ms} ms` : down;
    badge.title = res.ok ? 'Live site checked in the last few minutes' : `Live site did not respond${res.status ? ` (HTTP ${res.status})` : ''} at the last check`;
    top.insertBefore(badge, top.lastElementChild);
  }
}
