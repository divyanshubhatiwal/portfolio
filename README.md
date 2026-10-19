# Divyanshu Bhatiwal: portfolio

My personal site, built with [Astro](https://astro.build) 7 and TypeScript, deployed on Vercel.

Highlights: a WebGL hero, case studies and a blog written in Markdown (with RSS and generated link-preview
images), an AI "Ask my portfolio" chat and job-description matcher backed by Claude, live GitHub and LeetCode
stats, a browser-run T20 score model, a terminal mode (press `~`) and a command palette (`Ctrl K`).
It works offline once visited, and falls back gracefully whenever an API isn't available.

## Run it

Requires Node 22.22 or newer.

```bash
npm install
npm run dev        # http://localhost:4322 when started with --port 4322
npm run build      # type-check, then build to dist/
npm test           # Playwright end-to-end tests (reuses a running dev server)
```

## Configuration (Vercel environment variables)

| Variable | Needed for | Notes |
| --- | --- | --- |
| `SITE_URL` | absolute URLs in link previews, sitemap, RSS | e.g. `https://your-site.vercel.app` |
| `ANTHROPIC_API_KEY` | AI chat and job matcher | server-only; without it both fall back to built-in answers |
| `CLAUDE_MODEL` | optional | defaults to `claude-opus-5-5`; `claude-haiku-5-5` costs far less |
| `AI_DAILY_CAP` | optional | max AI calls per server instance per day (default 500) |
| `PUBLIC_WEB3FORMS_KEY` | contact form sending straight to email | free key from web3forms.com; without it the form opens the visitor's email app |

Turn on **Analytics** in the Vercel project to activate visitor stats.

## Editing content

| What | Where |
| --- | --- |
| Projects, skills, experience, certifications, achievements | `src/data/site.ts` |
| Case studies | `src/content/cases/*.md` |
| Blog posts | `src/content/blog/*.md` (set `draft: true` to hide one) |
| PWA icons (after changing `public/favicon.svg`) | `node scripts/generate-icons.mjs` |

## Notes

- The T20 model in `src/data/t20-model.json` is the Linear Regression from
  [t20-score-predictor](https://github.com/divyanshubhatiwal/t20-score-predictor), retrained on that repo's
  simulated dataset. The demo page explains what it does and doesn't learn.
- Dependency overrides in `package.json` pin patched versions of `path-to-regexp` and `fflate`.
- Lighthouse CI runs only in GitHub Actions (`npx @lhci/cli`), keeping its older dependency tree out of the project.
