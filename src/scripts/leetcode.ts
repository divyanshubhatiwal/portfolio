// Fills the LeetCode card from /api/leetcode. The card stays hidden if the stats can't be loaded,
// so visitors never see a half-empty widget.
import { $, storageGet, storageSet } from './dom';

interface Stats { total: number; easy: number; medium: number; hard: number; ranking: number; rating: number | null; contests: number }

const CACHE_KEY = 'lc-cache', TTL = 10 * 60 * 1000;
const CIRC = 2 * Math.PI * 52; // circumference of the ring (r = 52 in the SVG)

async function load(): Promise<Stats> {
  try {
    const c = JSON.parse(storageGet(CACHE_KEY) ?? 'null') as { t: number; d: Stats } | null;
    if (c && Date.now() - c.t < TTL) return c.d;
  } catch { /* corrupt cache: refetch */ }
  const r = await fetch('/api/leetcode');
  if (!r.ok) throw new Error(String(r.status));
  const d = (await r.json()) as Stats;
  storageSet(CACHE_KEY, JSON.stringify({ t: Date.now(), d }));
  return d;
}

export async function initLeetCode(): Promise<void> {
  const card = $('#leetcode');
  if (!card) return;
  try {
    const s = await load();
    const set = (k: string, v: string) => { const el = $(`[data-lc="${k}"]`, card); if (el) el.textContent = v; };
    set('total', String(s.total));
    set('easy', String(s.easy));
    set('medium', String(s.medium));
    set('hard', String(s.hard));
    set('rating', s.rating ? String(s.rating) : '—');
    set('contests', String(s.contests));
    set('ranking', s.ranking ? s.ranking.toLocaleString() : '—'); // visitor's own digit grouping
    card.hidden = false;

    // ring: one arc per difficulty, sized by its share of solved problems, drawn once it scrolls into view
    const sum = s.easy + s.medium + s.hard || 1;
    const arcs: [string, number][] = [['e', s.easy], ['m', s.medium], ['h', s.hard]];
    const draw = () => {
      let offset = 0;
      for (const [cls, n] of arcs) {
        const c = $<SVGCircleElement>(`.lc-ring .${cls}`, card);
        if (!c) continue;
        const len = (n / sum) * CIRC;
        c.style.strokeDasharray = `${Math.max(len - 3, 0)} ${CIRC}`; // small gap between arcs
        c.style.strokeDashoffset = String(-offset);
        offset += len;
      }
    };
    new IntersectionObserver(([e], io) => { if (e?.isIntersecting) { draw(); io.disconnect(); } }, { threshold: 0.3 }).observe(card);
  } catch {
    card.hidden = true;
  }
}
