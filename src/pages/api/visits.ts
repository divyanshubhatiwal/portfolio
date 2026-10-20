// Visitor counter. Works once an Upstash Redis store is connected in Vercel (Storage -> Upstash for Redis),
// which sets KV_REST_API_URL and KV_REST_API_TOKEN. Until then it answers 503 and the stats page says
// the counter isn't switched on. Counts one visit per browser session; stores no IPs or identifiers.
import type { APIRoute } from 'astro';

export const prerender = false;

const URL_ = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'portfolio:visits';

const json = (body: unknown, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache } });

async function redis(cmd: string): Promise<number> {
  const r = await fetch(`${URL_}/${cmd}/${KEY}`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(3000) });
  if (!r.ok) throw new Error(String(r.status));
  const { result } = (await r.json()) as { result: string | number | null };
  return Number(result ?? 0);
}

export const GET: APIRoute = async () => {
  if (!URL_ || !TOKEN) return json({ error: 'not_configured' }, 503);
  try { return json({ total: await redis('get') }, 200, 'public, s-maxage=60'); } catch { return json({ error: 'unavailable' }, 502); }
};

export const POST: APIRoute = async ({ request }) => {
  if (!URL_ || !TOKEN) return new Response(null, { status: 204 });
  // only count beacons from this site's own pages
  const site = request.headers.get('origin') ?? request.headers.get('referer') ?? '';
  const host = (() => { try { return new URL(site).host; } catch { return ''; } })();
  if (host !== new URL(request.url).host) return new Response(null, { status: 204 });
  try { await redis('incr'); } catch { /* counting is best-effort */ }
  return new Response(null, { status: 204 });
};
