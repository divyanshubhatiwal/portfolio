# Security policy

If you find a security problem in this site, please email **divyanshubhatiwal99@gmail.com** rather than
opening a public issue. Include what you found, how to reproduce it, and the page or endpoint involved.
I'll reply as soon as I can and credit you in the fix if you'd like.

## What the site already does

- A strict Content-Security-Policy: scripts only from this site plus hashed inline scripts, no inline event
  handlers, no framing. The Forensic Agent demo's worker alone may load its pinned Python runtime from jsDelivr.
- HSTS (preload), nosniff, a strict referrer policy, a permissions policy, and cross-origin isolation headers.
  All headers are set in `scripts/security-headers.mjs` and checked by `tests/built.spec.ts`.
- The AI endpoints accept only same-origin browser requests with a size-capped JSON body, rate-limit per
  visitor IP, cap daily calls, and never return error details or the API key.
- No secrets in the repository; server keys live in Vercel environment variables.
- CI runs a dependency audit, CodeQL code scanning, and end-to-end tests on every push; Dependabot keeps
  dependencies and pinned GitHub Actions current.