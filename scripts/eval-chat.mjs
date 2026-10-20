// Evaluates the AI chat against tests/ai-eval/questions.json.
// Every run calls the paid Claude API (~30 requests), so it never runs automatically on a normal push.
//
// Usage (against a running server that has ANTHROPIC_API_KEY and AI_EVAL_TOKEN set):
//   AI_EVAL_TOKEN=... EVAL_BASE_URL=http://localhost:4322 node scripts/eval-chat.mjs
// Optional: EVAL_MIN_PASS=0.9 (fail below this pass rate), EVAL_ONLY=fastapi,cgpa (subset by id)
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const BASE = (process.env.EVAL_BASE_URL || 'http://localhost:4322').replace(/\/$/, '');
const TOKEN = process.env.AI_EVAL_TOKEN || '';
const MIN_PASS = Number(process.env.EVAL_MIN_PASS || 0.9);
const ONLY = new Set((process.env.EVAL_ONLY || '').split(',').filter(Boolean));

const questions = JSON.parse(fs.readFileSync(path.join(root, 'tests/ai-eval/questions.json'), 'utf8'))
  .filter((q) => !ONLY.size || ONLY.has(q.id));
if (!TOKEN) console.warn('AI_EVAL_TOKEN is not set: requests will hit the per-IP rate limit (20 per 10 minutes).');

const sources = await (await fetch(`${BASE}/api/sources.json`)).json();
const validUrls = new Set(sources.map((s) => s.url));
const lower = (s) => s.toLowerCase();

async function ask(question) {
  const r = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(TOKEN ? { 'x-eval-token': TOKEN } : {}) },
    body: JSON.stringify({ question }),
  });
  const body = await r.json().catch(() => ({}));
  if (r.status === 503) throw new Error('AI is not configured on this server (no ANTHROPIC_API_KEY).');
  if (!r.ok) return { error: `${r.status} ${body.error ?? ''}`.trim() };
  return body;
}

function grade(q, res) {
  const fails = [];
  if (res.error) return [`request failed: ${res.error}`];
  const text = lower(res.answer ?? '');
  const cited = (res.sources ?? []).map((s) => s.url);
  if (q.any && !q.any.some((w) => text.includes(lower(w)))) fails.push(`missing any of: ${q.any.join(' | ')}`);
  for (const w of q.all ?? []) if (!text.includes(lower(w))) fails.push(`missing: ${w}`);
  for (const w of q.none ?? []) if (text.includes(lower(w))) fails.push(`contains forbidden: ${w}`);
  if (q.cites && !cited.some((u) => q.cites.some((c) => u === c || u.startsWith(`${c}#`) || (c.length > 2 && u.startsWith(c))))) {
    fails.push(`expected a citation to: ${q.cites.join(' | ')} (got: ${cited.join(', ') || 'none'})`);
  }
  for (const u of cited) if (!validUrls.has(u)) fails.push(`citation to unknown source: ${u}`);
  return fails;
}

const results = [];
for (const q of questions) {
  const t0 = Date.now();
  let res;
  try { res = await ask(q.q); } catch (e) { console.error(e.message); process.exit(2); }
  const fails = grade(q, res);
  results.push({ ...q, ok: !fails.length, fails, ms: Date.now() - t0, answer: res.answer, sources: res.sources });
  console.log(`${fails.length ? 'FAIL' : 'pass'}  ${q.kind.padEnd(9)} ${q.id.padEnd(16)} ${String(Date.now() - t0).padStart(5)} ms${fails.length ? `\n      ${fails.join('\n      ')}` : ''}`);
}

const byKind = {};
for (const r of results) (byKind[r.kind] ??= []).push(r.ok);
console.log('\n--- summary');
for (const [k, v] of Object.entries(byKind)) console.log(`${k.padEnd(10)} ${v.filter(Boolean).length}/${v.length}`);
const passRate = results.filter((r) => r.ok).length / (results.length || 1);
console.log(`overall    ${results.filter((r) => r.ok).length}/${results.length} (${(passRate * 100).toFixed(0)}%), threshold ${(MIN_PASS * 100).toFixed(0)}%`);

fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
fs.writeFileSync(path.join(root, 'test-results/ai-eval.json'), JSON.stringify({ at: new Date().toISOString(), base: BASE, passRate, results }, null, 2));
process.exit(passRate >= MIN_PASS ? 0 : 1);
