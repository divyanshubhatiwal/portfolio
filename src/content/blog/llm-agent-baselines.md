---
title: Making an LLM agent prove it can reason
summary: A rising accuracy curve proves nothing. Here is how I set up AutoSci so the result means something.
date: 2026-10-19
tag: AutoSci
---

Most "AI scientist" demos share one chart: accuracy going up over iterations. The trouble is that random search also produces a chart that goes up. On its own, that curve can't tell you whether the agent reasoned or got lucky.

## Baselines first, agent second

In AutoSci I built the comparison before the agent. Five arms run against the same environment and search the *same* action space:

- **random:** the floor.
- **Optuna TPE:** the real baseline to beat.
- **LLM, stateless:** does memory matter at all?
- **LLM with score history:** remembers results but gets no failure analysis.
- **LLM with diagnostics:** the system under test.

The last two are the interesting pair. If the diagnostic arm beats the score-history arm, the improvement comes from *reasoning about failure*, not just from having more context.

## Better metrics than "final accuracy"

Final best score rewards one lucky run. I measure budget-to-target, hypothesis precision (how often a proposal actually beats the current best), novelty rate and regret, all with variance across seeds.

## Two guardrails that keep it honest

**The agent doesn't write code.** It emits a validated experiment spec that gets compiled into a pipeline. That keeps runs reproducible and safe, and keeps the comparison fair, because Optuna searches the identical space.

**Contamination control.** An LLM that recognises a famous dataset will recite memorised tricks. Obfuscated mode strips names and shuffles columns, and if results differ between named and obfuscated runs, that gap is a finding in itself.

## What I took away

The hard part of an agent project usually isn't the agent. It's deciding what would convince you it works, and building that first.
