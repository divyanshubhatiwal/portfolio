// /stats: live numbers. Each one fails quietly to "—" if its source doesn't answer.
import { PROFILE } from '@/data/site';
import { $ } from './dom';

const set = (id: string, v: string) => { const el = $(id); if (el) el.textContent = v; };
const get = <T>(url: string) => fetch(url).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(String(r.status)))));

if ($('#stats-live')) {
  get<{ total: number }>('/api/visits')
    .then((d) => set('#st-visits', d.total.toLocaleString('en-US')))
    .catch(() => set('#st-visits-l', 'Visits (counter not switched on yet)'));
  get<{ public_repos: number }>(`https://api.github.com/users/${PROFILE.githubUser}`)
    .then((d) => set('#st-repos', String(d.public_repos))).catch(() => {});
  get<{ total: number }>('/api/leetcode')
    .then((d) => set('#st-lc', String(d.total))).catch(() => {});
}
