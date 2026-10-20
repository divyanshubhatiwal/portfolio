// /now: latest commits across my most recently pushed repos (public GitHub API, no token) and
// LeetCode totals from /api/leetcode. Cached per visitor for 10 minutes, like the home page.
import { PROFILE } from '@/data/site';
import { $, esc, storageGet, storageSet } from './dom';

interface Commit { repo: string; url: string; msg: string; at: string }
interface GhRepo { name: string; fork: boolean; pushed_at: string }
interface GhCommit { html_url: string; commit: { message: string; author: { date: string } | null } }

const CACHE_KEY = 'now-commits', TTL = 10 * 60 * 1000, REPOS = 4, PER_REPO = 3;

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json() as Promise<T>;
}

async function commits(): Promise<Commit[]> {
  try {
    const c = JSON.parse(storageGet(CACHE_KEY) ?? 'null') as { t: number; d: Commit[] } | null;
    if (c && Date.now() - c.t < TTL) return c.d;
  } catch { /* corrupt cache: refetch */ }
  const u = PROFILE.githubUser;
  const repos = (await getJson<GhRepo[]>(`https://api.github.com/users/${u}/repos?per_page=20&sort=pushed`))
    .filter((r) => !r.fork).slice(0, REPOS);
  const lists = await Promise.all(repos.map((r) =>
    getJson<GhCommit[]>(`https://api.github.com/repos/${u}/${r.name}/commits?per_page=${PER_REPO}`)
      .then((cs) => cs.map((c) => ({ repo: r.name, url: c.html_url, msg: c.commit.message.split('\n')[0] ?? '', at: c.commit.author?.date ?? r.pushed_at })))
      .catch(() => [] as Commit[])));
  const d = lists.flat().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
  storageSet(CACHE_KEY, JSON.stringify({ t: Date.now(), d }));
  return d;
}

const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 30 ? `${days} days ago` : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const list = $('#now-commits');
if (list) {
  commits().then((cs) => {
    list.innerHTML = cs.length
      ? cs.map((c) => `<li><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.msg)}</a><small><code>${esc(c.repo)}</code> · ${ago(c.at)}</small></li>`).join('')
      : '<li class="idle">No public commits found.</li>';
  }).catch(() => { list.innerHTML = '<li class="idle">GitHub didn\'t answer (it allows 60 requests an hour per visitor). Try again later.</li>'; });

  fetch('/api/leetcode').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((s: { total: number; easy: number; medium: number; hard: number }) => {
      const el = $('#now-lc');
      if (el) el.insertAdjacentHTML('afterbegin', `<b>${s.total}</b> problems solved (${s.easy} easy, ${s.medium} medium, ${s.hard} hard). `);
    })
    .catch(() => { /* keep the plain profile link */ });
}
