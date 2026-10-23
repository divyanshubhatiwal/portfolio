# Divyanshu Bhatiwal: portfolio

My personal site, built with [Astro](https://astro.build) 7 and TypeScript, deployed on Vercel.

Highlights: case studies and a blog written in Markdown (with RSS and generated link-preview
images), an AI "Ask my portfolio" chat and job-description matcher backed by Claude, live GitHub and LeetCode
stats, a browser-run T20 score model, a terminal mode (press `~`) and a command palette (`Ctrl K`).
The chat cites its sources and has voice input. Three project demos use real output from my repos: an AutoSci
replay, a Forensic Agent investigation and a Venture DAO risk-gate simulator. There's also a `/now` page, a `/stats`
page, a recruiter view (`/?for=backend`, `ai`, `frontend`, `fullstack` or `mobile`) and a Hindi home page at `/hi/`.
Also: `/evidence` links every skill to the exact file or line on GitHub that uses it, `/tour` walks through real
code with notes, `/resume` prints a one-page résumé tailored to a role, project cards show whether live sites are up,
case studies show their public commit history, and chat answers suggest follow-up questions and can be shared as links.
`/demo/forensic-live` runs the Forensic Agent's real Python pipeline in the browser (Pyodide, in a Web Worker),
a 1-minute guided tour starts from the hero, and `?` lists the keyboard shortcuts. See [SECURITY.md](SECURITY.md) for the
security measures and how to report a problem.
It works offline once visited, and falls back gracefully whenever an API isn't available.

## Run it

Requires Node 22.22 or newer.

```bash
npm install
npm run dev        # http://localhost:4322 when started with --port 4322
npm run build      # type-check, build, then add the security headers (scripts/security-headers.mjs)
npm test           # Playwright end-to-end tests (reuses a running dev server; build first for the built-site tests)
npm run test:visual  # screenshot comparison; baselines are made in CI (.github/workflows/visual.yml)
node scripts/eval-chat.mjs  # AI chat evaluation; calls the paid API, see the file for setup
```

## Configuration (Vercel environment variables)

| Variable | Needed for | Notes |
| --- | --- | --- |
| `SITE_URL` | absolute URLs in link previews, sitemap, RSS | e.g. `https://your-site.vercel.app` |
| `ANTHROPIC_API_KEY` | AI chat and job matcher | server-only; without it both fall back to built-in answers |
| `CLAUDE_MODEL` | optional | defaults to `claude-opus-5-5`; `claude-haiku-5-5` costs far less |
| `AI_DAILY_CAP` | optional | max AI calls per server instance per day (default 500) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | visitor counter on /stats | set automatically when you connect an Upstash for Redis store in Vercel (Storage) |
| `AI_EVAL_TOKEN` | optional | lets `scripts/eval-chat.mjs` skip the per-IP rate limit; keep it secret |
| `PUBLIC_WEB3FORMS_KEY` | contact form sending straight to email | free key from web3forms.com; without it the form opens the visitor's email app |

Turn on **Analytics** in the Vercel project to activate visitor stats.

## Editing content

| What | Where |
| --- | --- |
| Projects, skills, experience, certifications, achievements | `src/data/site.ts` |
| Case studies | `src/content/cases/*.md` |
| Blog posts | `src/content/blog/*.md` (set `draft: true` to hide one) |
| Hindi home page text | `src/i18n/hi.ts` (machine-assisted; needs a native speaker's review) |
| Skill evidence, code tours, repo history | `scripts/github-config.mjs`, then `node scripts/sync-github.mjs` and commit `src/data/github.json` |
| PWA icons (after changing `public/favicon.svg`) | `node scripts/generate-icons.mjs` |

## Notes

- The T20 model in `src/data/t20-model.json` is the Linear Regression from
  [t20-score-predictor](https://github.com/divyanshubhatiwal/t20-score-predictor), retrained on that repo's
  simulated dataset. The demo page explains what it does and doesn't learn.
- Dependency overrides in `package.json` pin patched versions of `path-to-regexp` and `fflate`.
- Lighthouse CI runs only in GitHub Actions (`npx @lhci/cli`), keeping its older dependency tree out of the project.
- The demo data comes from the projects themselves: `src/data/autosci-openml.json` is exported read-only from
  AutoSci's experiment ledger (study `study_322258374f`), `src/data/forensic-case001.ts` is copied from the
  Forensic Agent's report on its synthetic `CASE_001`, and `src/lib/preflight.ts` ports Venture DAO's `preflight()`.
- Security headers (CSP with hashes of the inline scripts, HSTS, frame and permissions policies) are written into
  `.vercel/output/config.json` after each build, because the Vercel adapter ignores `headers` in `vercel.json`.- `public/forensic/` holds the Forensic Agent's analysis pipeline (copied unchanged from the project, minus its
  dashboard, login and CLI) and two synthetic sample cases, in which the user "divyanshu" is renamed "kiran".
  Pyodide is pinned to v0.27.7; only `/forensic/worker.js` may load it, through its own CSP.
- `node scripts/capture-shots.mjs` re-captures the project screenshots and demo clips from the running dev server.