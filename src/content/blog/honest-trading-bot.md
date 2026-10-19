---
title: 31 winning trades and still losing money
summary: Why my trading platform puts its worst numbers on the landing page.
date: 2026-10-19
tag: Venture DAO
---

My trading bot won 31 trades out of 31. The account was still down 6.16%.

The reason was boring: fees. Across those trades, fees came to four times the gross profit. Every individual trade "worked", and the strategy as a whole lost money. A dashboard that celebrated the win rate would have been technically true and completely misleading.

## The numbers I chose to show

- **Profit factor 0.94.** Below 1.0 means losing money, and it stayed below 1.0 even with fees set to zero.
- **0 of 2,000** Monte Carlo runs reached the goal. Every one hit the loss limit first.
- The trained model has **negative out-of-sample lift** on every market I tested.
- News sentiment from Gemini votes with **weight zero** until it proves it can predict anything.

All of that is on Venture DAO's landing page, not buried in a log file.

## Why publish bad results?

Because the engineering and the strategy are separate claims. The engineering claim (orders can't be duplicated, risk checks can't be skipped, secrets are encrypted at rest) is backed by tests. The strategy claim ("this makes money") isn't true yet, and saying so is what makes the first claim believable.

> A trading tool that only shows its good simulations is a sales pitch, not a tool.

## What I took away

Win rate is a vanity metric. Measure the thing you actually care about, net of costs, and decide before you look at the results which number counts as success.
