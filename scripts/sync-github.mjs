// Collects skill evidence, code-tour excerpts and commit timelines from the public GitHub repos
// listed in scripts/github-config.mjs, pinned to each repo's current commit, into
// src/data/github.json. Run it by hand when the repos change, then commit the JSON:
//   node scripts/sync-github.mjs
// Uses GITHUB_TOKEN if set, otherwise the GitHub CLI's login (`gh auth token`).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { EVIDENCE, OWNER, REPOS, TOURS } from './github-config.mjs';

const root = path.resolve(import.meta.dirname, '..');
const OUT = path.join(root, 'src/data/github.json');

const token = process.env.GITHUB_TOKEN || (() => {
  try { return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim(); } catch { return ''; }
})();
if (!token) { console.error('sync-github: set GITHUB_TOKEN or log in with `gh auth login`.'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gh(url, { raw = false, accept } = {}) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url.startsWith('http') ? url : `https://api.github.com/${url}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', Accept: accept ?? (raw ? 'application/vnd.github.raw' : 'application/vnd.github+json') },
    });
    // the commit-stats endpoints answer 202 while GitHub computes them; search is rate-limited
    if ((r.status === 202 || r.status === 403 || r.status === 429) && attempt < 6) { await sleep(2000 * (attempt + 1)); continue; }
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return raw ? r.text() : r.json();
  }
}

const blobUrl = (repo, sha, file, a, b) => `https://github.com/${OWNER}/${repo}/blob/${sha}/${file}${a ? `#L${a}${b && b !== a ? `-L${b}` : ''}` : ''}`;

/** dependency names (with the line they're on) from the manifests we understand */
function parseDeps(file, text) {
  const lines = text.split('\n');
  const out = [];
  if (file.endsWith('package.json')) {
    let pkg; try { pkg = JSON.parse(text); } catch { return out; }
    for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
      const line = lines.findIndex((l) => l.includes(`"${name}"`)) + 1;
      out.push({ name, line });
    }
  } else if (/requirements.*\.txt$/.test(file)) {
    lines.forEach((l, i) => {
      const m = /^\s*([A-Za-z0-9_.\-]+)(\[[^\]]*\])?\s*(==|>=|<=|~=|>|<|$)/.exec(l);
      if (m && !l.trim().startsWith('#')) out.push({ name: m[1], line: i + 1 });
    });
  } else if (file.endsWith('pubspec.yaml')) {
    let inDeps = false;
    lines.forEach((l, i) => {
      if (/^(dev_)?dependencies:/.test(l)) { inDeps = true; return; }
      if (/^\S/.test(l)) inDeps = false;
      const m = /^ {2}([a-z0-9_]+):/.exec(l);
      if (inDeps && m) out.push({ name: m[1], line: i + 1 });
    });
  }
  return out;
}

/** daily and weekly commit counts for the whole history, plus first/last commit dates */
async function timeline(repo) {
  const commits = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await gh(`repos/${OWNER}/${repo}/commits?per_page=100&page=${page}`);
    commits.push(...batch.map((c) => ({ at: c.commit.author?.date ?? c.commit.committer?.date, msg: c.commit.message.split('\n')[0] })));
    if (batch.length < 100) break;
  }
  const dates = commits.map((c) => c.at).filter(Boolean).sort();
  const weeks = {}, days = {};
  for (const d of dates) {
    days[d.slice(0, 10)] = (days[d.slice(0, 10)] ?? 0) + 1;
    const t = new Date(d); t.setUTCHours(0, 0, 0, 0); t.setUTCDate(t.getUTCDate() - t.getUTCDay()); // week starting Sunday
    const k = t.toISOString().slice(0, 10);
    weeks[k] = (weeks[k] ?? 0) + 1;
  }
  return { total: commits.length, first: dates[0] ?? null, last: dates.at(-1) ?? null, weeks, days, recent: commits.slice(0, 5) };
}

const repos = {};
for (const [project, repo] of Object.entries(REPOS)) {
  const meta = await gh(`repos/${OWNER}/${repo}`);
  const head = await gh(`repos/${OWNER}/${repo}/commits/${meta.default_branch}`);
  const sha = head.sha;
  const tree = (await gh(`repos/${OWNER}/${repo}/git/trees/${sha}?recursive=1`)).tree.filter((e) => e.type === 'blob').map((e) => e.path)
    .filter((p) => !/(^|\/)(node_modules|dist|dev-dist|build|\.venv|vendor)\//.test(p));
  const manifests = tree.filter((p) => /(^|\/)(package\.json|requirements[^/]*\.txt|pubspec\.yaml)$/.test(p));
  const deps = [];
  for (const file of manifests) {
    const text = await gh(`repos/${OWNER}/${repo}/contents/${encodeURIComponent(file).replace(/%2F/g, '/')}?ref=${sha}`, { raw: true });
    for (const d of parseDeps(file, text)) deps.push({ ...d, file });
  }
  const languages = await gh(`repos/${OWNER}/${repo}/languages`);
  repos[repo] = { project, sha, branch: meta.default_branch, url: meta.html_url, homepage: meta.homepage || null, description: meta.description, tree, deps, languages, timeline: await timeline(repo) };
  console.log(`${repo} @ ${sha.slice(0, 7)}: ${tree.length} files, ${deps.length} dependencies, ${repos[repo].timeline.total} commits`);
}

/** a file's text at the pinned commit, fetched once */
const fileCache = new Map();
async function fileText(repo, file) {
  const key = `${repo}/${file}`;
  if (!fileCache.has(key)) fileCache.set(key, await gh(`repos/${OWNER}/${repo}/contents/${file}?ref=${repos[repo].sha}`, { raw: true }));
  return fileCache.get(key);
}
// skill -> evidence in each repo
const evidence = {};
for (const [skill, rule] of Object.entries(EVIDENCE)) {
  const items = [];
  for (const [repo, r] of Object.entries(repos)) {
    if (rule.deps) {
      const d = r.deps.find((x) => rule.deps.test(x.name));
      if (d) { items.push({ repo, project: r.project, kind: 'dependency', label: `${d.name} in ${d.file}`, url: blobUrl(repo, r.sha, d.file, d.line) }); continue; }
    }
    if (rule.files) {
      const hits = r.tree.filter((p) => rule.files.test(p));
      if (hits.length) { items.push({ repo, project: r.project, kind: 'files', label: hits.length === 1 ? hits[0] : `${hits.length} files, e.g. ${hits[0]}`, url: blobUrl(repo, r.sha, hits[0]) }); continue; }
    }
    if (rule.grep) {
      for (const file of r.tree.filter((p) => rule.grep.in.test(p))) {
        const line = (await fileText(repo, file)).split('\n').findIndex((l) => l.includes(rule.grep.text)) + 1;
        if (line) { items.push({ repo, project: r.project, kind: 'code', label: `${rule.grep.text} in ${file}`, url: blobUrl(repo, r.sha, file, line) }); break; }
      }
    }
  }
  evidence[skill] = items;
}

// code tours: excerpts located by marker text

const tours = [];
for (const tour of TOURS) {
  const r = repos[tour.repo];
  const steps = [];
  for (const s of tour.steps) {
    const lines = (await fileText(tour.repo, s.file)).replace(/\r\n/g, '\n').split('\n');
    const a = lines.findIndex((l) => l.includes(s.from));
    const b = a < 0 ? -1 : lines.findIndex((l, i) => i >= a && l.includes(s.to));
    if (a < 0 || b < 0) throw new Error(`tour ${tour.slug}: markers not found in ${s.file} (${s.from} .. ${s.to})`);
    const start = Math.max(0, a - (s.before ?? 0)), end = Math.min(lines.length - 1, b + (s.after ?? 0));
    steps.push({ title: s.title, note: s.note, file: s.file, start: start + 1, end: end + 1, code: lines.slice(start, end + 1).join('\n'), url: blobUrl(tour.repo, r.sha, s.file, start + 1, end + 1) });
  }
  tours.push({ slug: tour.slug, repo: tour.repo, project: r.project, sha: r.sha, title: tour.title, summary: tour.summary, steps });
}

for (const r of Object.values(repos)) { delete r.tree; delete r.deps; } // only needed while building the evidence
fs.writeFileSync(OUT, `${JSON.stringify({ synced: new Date().toISOString(), owner: OWNER, repos, evidence, tours }, null, 1)}\n`);
console.log(`wrote ${path.relative(root, OUT)}: ${Object.values(evidence).filter((e) => e.length).length} skills with code evidence, ${tours.length} tours`);
