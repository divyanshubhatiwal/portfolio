// Is each live project up? Checks only the fixed `live` URLs from src/data/site.ts (never a URL from
// the request), and the CDN caches the answer for five minutes, so visitors never trigger a flood of checks.
import type { APIRoute } from 'astro';
import { PROJECTS } from '@/data/site';

export const prerender = false;

const TARGETS = PROJECTS.filter((p) => p.live).map((p) => ({ name: p.name, url: p.live! }));
const TIMEOUT_MS = 6000;

async function check(url: string): Promise<{ ok: boolean; status: number | null; ms: number | null }> {
  const t0 = Date.now();
  try {
    // redirects aren't followed: some hosts (Streamlit) bounce every cookieless visitor through a login
    // redirect that loops without cookies. Any answer below 400 means the server is up.
    const r = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': 'portfolio-status-check' } });
    await r.body?.cancel(); // only the status matters
    return { ok: r.status > 0 && r.status < 400, status: r.status, ms: Date.now() - t0 };
  } catch {
    return { ok: false, status: null, ms: null };
  }
}

export const GET: APIRoute = async () => {
  const results = await Promise.all(TARGETS.map(async (t) => ({ ...t, ...(await check(t.url)) })));
  return new Response(JSON.stringify({ checked: new Date().toISOString(), results }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' },
  });
};
