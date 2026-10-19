// GitHub activity from the public API (no token). Cached per visitor for 10 minutes to stay
// under GitHub's 60-requests-per-hour limit for unauthenticated calls.
import { PROFILE } from '@/data/site';
import { $, esc, storageGet, storageSet } from './dom';

interface GhUser { public_repos: number; followers: number; created_at: string }
interface GhRepo { name: string; fork: boolean; language: string | null; description: string | null; html_url: string; stargazers_count: number; pushed_at: string }

const LANG_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219', 'C++': '#f34b7d', C: '#555555',
  HTML: '#e34c26', CSS: '#563d7c', Dart: '#00B4AB', Jupyter: '#DA5B0B', PHP: '#4F5D95',
};
const color = (l: string) => LANG_COLORS[l] ?? 'var(--accent)';
const CACHE_KEY = 'gh-cache', TTL = 10 * 60 * 1000;

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json() as Promise<T>;
}

async function load(): Promise<{ user: GhUser; repos: GhRepo[] }> {
  try {
    const c = JSON.parse(storageGet(CACHE_KEY) ?? 'null') as { t: number; d: { user: GhUser; repos: GhRepo[] } } | null;
    if (c && Date.now() - c.t < TTL) return c.d;
  } catch { /* corrupt cache: refetch */ }
  const u = PROFILE.githubUser;
  const [user, repos] = await Promise.all([
    getJson<GhUser>(`https://api.github.com/users/${u}`),
    // sort by last push: "updated" also changes when only a description is edited
    getJson<GhRepo[]>(`https://api.github.com/users/${u}/repos?per_page=100&sort=pushed`),
  ]);
  const d = { user, repos };
  storageSet(CACHE_KEY, JSON.stringify({ t: Date.now(), d }));
  return d;
}

const set = (sel: string, v: string | number) => { const el = $(sel); if (el) el.textContent = String(v); };

export async function initGitHub(): Promise<void> {
  const section = $('#github');
  if (!section) return;
  const u = PROFILE.githubUser;
  const chart = $<HTMLImageElement>('#gh-chart');
  if (chart) {
    chart.addEventListener('error', () => { const g = $('.gh-graph'); if (g) g.style.display = 'none'; });
    chart.src = `https://ghchart.rshah.org/6d28d9/${u}`;
  }
  const note = $('#gh-note');
  try {
    const { user, repos } = await load();
    const own = repos.filter((r) => !r.fork);
    set('[data-gh="repos"]', user.public_repos);
    set('[data-gh="followers"]', user.followers);
    set('[data-gh="since"]', new Date(user.created_at).getFullYear());

    const counts: Record<string, number> = {};
    for (const r of own) if (r.language) counts[r.language] = (counts[r.language] ?? 0) + 1;
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    const langs = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const bar = $('#lang-bar'), list = $('#lang-list');
    if (bar) bar.innerHTML = langs.map(([l, n]) => `<i style="width:${((n / total) * 100).toFixed(1)}%;background:${color(l)}" title="${esc(l)}"></i>`).join('');
    if (list) list.innerHTML = langs.map(([l, n]) => `<li style="--c:${color(l)}"><b>${esc(l)}</b>${Math.round((n / total) * 100)}%</li>`).join('');

    const grid = $('#gh-repos');
    if (grid) grid.innerHTML = own.slice(0, 6).map((r, i) => `
      <a class="repo spot gh-pop" style="--pd:${(i * 0.05).toFixed(2)}s" href="${esc(r.html_url)}" target="_blank" rel="noopener noreferrer" data-hover>
        <h4><svg aria-hidden="true"><use href="#i-github"/></svg>${esc(r.name)}</h4>
        <p>${esc(r.description || 'No description yet.')}</p>
        <div class="meta">${r.language ? `<span style="--c:${color(r.language)}"><i></i>${esc(r.language)}</span>` : ''}<span>★ ${r.stargazers_count}</span><span>${new Date(r.pushed_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span></div>
      </a>`).join('');
    if (note) note.innerHTML = `Showing ${Math.min(6, own.length)} of ${own.length} original repos. <a href="https://github.com/${u}?tab=repositories" target="_blank" rel="noopener noreferrer">See all on GitHub</a>`;
  } catch {
    if (note) note.innerHTML = `Couldn't reach GitHub right now. <a href="https://github.com/${u}" target="_blank" rel="noopener noreferrer">View my profile directly</a>`;
  }
}
