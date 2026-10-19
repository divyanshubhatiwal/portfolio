---
title: Venture DAO
cat: Full-stack · Fintech
lede: An autonomous trading and governance platform that refuses to hide its own losses.
tags: [Node.js, Express 5, MongoDB, React 19, Docker, Jest]
order: 2
img: /img/venturedao.jpg
links:
  - href: https://github.com/divyanshubhatiwal/venture-dao
    label: Source code
---

> A trading tool that only shows its good simulations is a sales pitch, not a tool.

## The problem

Money-moving software has one failure that matters more than any other: doing something twice. A retried or duplicated request must never open a second position. On top of that, no code path, however it's called, should be able to skip the risk checks.

<div class="story" data-story>
  <ol class="story-steps">
    <li data-step="0"><b>A trade request arrives.</b> Maybe it's new, maybe it's a network retry of one already sent. The engine can't tell yet.</li>
    <li data-step="1"><b>Idempotency key check.</b> Every order carries a key. A key the engine has seen before returns the original result instead of placing a second order.</li>
    <li data-step="2"><b>Mandatory risk preflight.</b> Drawdown ceiling, daily loss limit, position cap and stop-loss rules. There is no code path around this gate.</li>
    <li data-step="3"><b>State machine dispatch.</b> The order moves through explicit states, so a crash mid-flight resumes from a known state instead of guessing.</li>
    <li data-step="4"><b>Honest reporting.</b> The result, win or loss, goes into the numbers shown on the landing page.</li>
  </ol>
  <div class="story-stage" aria-hidden="true">
    <div class="story-node" data-node="0">Request</div>
    <div class="story-node" data-node="1">Idempotency</div>
    <div class="story-node" data-node="2">Risk gate</div>
    <div class="story-node" data-node="3">State machine</div>
    <div class="story-node" data-node="4">Report</div>
  </div>
</div>

## How it's built

- **Execution engine as an explicit state machine** with idempotent order dispatch, so duplicates are impossible by construction.
- **Mandatory risk preflight:** drawdown ceilings, daily loss limits, position caps and stop-loss enforcement that nothing can override.
- **Agent loop** with a goal manager, decision step, critic and episodic memory.
- **Live market terminal** with candlesticks, zoom/pan and EMA, ATR, Donchian and Bollinger overlays.
- **Walk-forward ML signals:** a logistic regression trained with gradient descent on scale-free features, validated with zero lookahead bias.
- **Gemini news sentiment** that votes with *weight zero* until its forward accuracy is proven.

## Security

- AES-256-GCM encryption for every credential at rest, scrypt password hashing and TOTP second factor.
- HMAC-signed exchange calls, rate limiting and CORS.
- Live trading needs **both** `DELTA_ENV=live` and `DELTA_ALLOW_LIVE=true`, so a single typo can't start moving real money.
- Nothing holding a secret may use the `VITE_` prefix, which would compile it into the browser bundle.
- 20+ Jest suites cover the engine, auth, vault and venue adapters, run before every Docker deploy.

## Honest results

These numbers are shown on the product's own landing page:

<div class="metrics">
  <div class="metric"><b class="bad">0.94</b><span>Profit factor (below 1.0 loses money, even with fees zeroed)</span></div>
  <div class="metric"><b>31 / 31</b><span>Winning trades, yet the account is still down 6.16%</span></div>
  <div class="metric"><b class="bad">4×</b><span>Fees relative to gross profit</span></div>
  <div class="metric"><b class="bad">0 / 2,000</b><span>Simulated runs that reached the goal</span></div>
</div>

The trained model has negative out-of-sample lift on every market tested. Publishing that is the point: the engineering is sound, the strategy isn't profitable yet, and the platform says so.

## Deployment

Frontend on Vercel, backend on Render and data on MongoDB Atlas. The exchange whitelists API keys by IP, so the backend needs a fixed outbound address, which rules out most free tiers.
