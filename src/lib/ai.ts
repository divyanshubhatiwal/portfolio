// Shared server-side pieces for the AI endpoints (/api/chat, /api/match).
// Server only: never import this from client scripts. The API key is read from process.env at runtime.
import Anthropic from '@anthropic-ai/sdk';
import { getCollection } from 'astro:content';
import { CERTS, EXPERIENCE, PROFILE, PROJECTS, SKILLS } from '@/data/site';

/** Default per the Claude API guidance. Set CLAUDE_MODEL (e.g. claude-haiku-5-5) in Vercel to trade quality for cost. */
export const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';

/** Server-side refusal fallback (beta) is available on these models; Haiku has none. */
export const SUPPORTS_FALLBACK = /^claude-(opus-5|fable-5-1|sonnet-5-5)/.test(MODEL);

let client: Anthropic | null | undefined;
/** null when no API key is configured, so the endpoints can answer 503 and the site falls back gracefully. */
export function getClient(): Anthropic | null {
  if (client === undefined) client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ maxRetries: 1, timeout: 25_000 }) : null;
  return client;
}

/** Strip HTML from the raw-HTML blocks inside case studies (diagrams, metrics) so only their text reaches the model. */
const plain = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

let contextPromise: Promise<string> | undefined;
/**
 * Everything the assistant may answer from, as one deterministic text block.
 * Deterministic (stable order, no dates or random values) so the prompt cache keeps hitting.
 */
export function getContext(): Promise<string> {
  contextPromise ??= (async () => {
    const [cases, posts] = await Promise.all([getCollection('cases'), getCollection('blog', ({ data }) => !data.draft)]);
    cases.sort((a, b) => a.data.order - b.data.order);
    posts.sort((a, b) => a.id.localeCompare(b.id));
    const e = PROFILE.education;
    return [
      `# Profile\nName: ${PROFILE.name}\nTitle: ${PROFILE.title}\nLocation: ${PROFILE.location}\nEmail: ${PROFILE.email}\nGitHub: ${PROFILE.github}\nLinkedIn: ${PROFILE.linkedin}\nLeetCode: https://leetcode.com/u/${PROFILE.leetcodeUser}/\nRésumé: /resume.pdf\nEducation: ${e.degree}, ${e.school}, ${e.years}, CGPA ${e.cgpa}/10; Class XII (CBSE) ${e.classXII}`,
      `# Skills\n${Object.entries(SKILLS).map(([c, l]) => `${c}: ${l.map((s) => s[0]).join(', ')}`).join('\n')}`,
      `# Projects\n${PROJECTS.map((p) => [
        `## ${p.name} (${p.cat})`, p.desc, `Stack: ${p.tags.join(', ')}`,
        p.live && `Live: ${p.live}`, p.code && `Source: ${p.code}`, p.slug && `Case study: /case/${p.slug}`,
      ].filter(Boolean).join('\n')).join('\n\n')}`,
      `# Experience and education\n${EXPERIENCE.map((x) => `## ${x.role}, ${x.org} (${x.period}, ${x.place})\n${x.points.map((p) => `- ${p}`).join('\n')}`).join('\n\n')}`,
      `# Certifications\n${CERTS.map((c) => `- ${c.title}, ${c.issuer} (${c.date})${c.url ? `: ${c.url}` : ''}`).join('\n')}`,
      `# Case studies (full text)\n${cases.map((c) => `## ${c.data.title} (/case/${c.id})\n${c.data.lede}\n${plain(c.body ?? '')}`).join('\n\n')}`,
      `# Blog posts (full text)\n${posts.map((p) => `## ${p.data.title} (/blog/${p.id})\n${plain(p.body ?? '')}`).join('\n\n')}`,
    ].join('\n\n');
  })();
  return contextPromise;
}

// ---------- cost control: best-effort rate limits ----------
// In-memory, so limits are per serverless instance and reset on cold starts. That is enough to stop
// casual abuse of a portfolio; for hard guarantees, back this with Vercel KV / Upstash Redis.
const hits = new Map<string, number[]>();
const daily = { day: '', count: 0 };

/** Sliding-window limit per key. Returns seconds to wait, or 0 when allowed. */
export function rateLimit(key: string, limit: number, windowMs: number): number {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) return Math.ceil((recent[0]! + windowMs - now) / 1000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
  return 0;
}

/** Hard cap on model calls per instance per day, whatever the IP. */
export function underDailyCap(cap = Number(process.env.AI_DAILY_CAP) || 500): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (daily.day !== today) { daily.day = today; daily.count = 0; }
  return ++daily.count <= cap;
}

export function clientIp(request: Request, fallback: string): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || fallback || 'unknown';
}

export const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });

/** Map SDK errors to safe responses; never leak error details or the key to the visitor. */
export function errorResponse(err: unknown): Response {
  if (err instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 429, { 'Retry-After': '30' });
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    console.error('[ai] API key rejected: check ANTHROPIC_API_KEY in Vercel');
    return json({ error: 'not_configured' }, 503);
  }
  if (err instanceof Anthropic.APIError) {
    console.error(`[ai] Anthropic API error ${err.status}`);
    return json({ error: 'upstream' }, 502);
  }
  console.error('[ai] unexpected error', err);
  return json({ error: 'internal' }, 500);
}
