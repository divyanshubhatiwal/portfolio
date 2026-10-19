---
title: AutoSci
cat: AI / ML · Research system
lede: Can an LLM agent improve its experiment strategy by reasoning over its own failures, beyond what black-box hyperparameter search achieves on the same budget?
tags: [Python, LLM agents, Optuna, scikit-learn, Experiment design]
order: 1
---

## The problem

Plenty of "AI scientist" demos show an accuracy curve going up. That proves very little: a random search can produce a rising curve too. I wanted a harness where the question could actually be *answered*, which meant building the baselines before the agent.

## The experimental design

The environment is fixed and only the **proposer** changes. Five arms search the exact same action space, because giving the LLM a richer space than Optuna would rig the comparison.

| Arm | Sees history | Sees diagnostics | Purpose |
| --- | --- | --- | --- |
| `random` | no | no | Floor |
| `bayes` (Optuna TPE) | scalars | no | The real baseline to beat |
| `llm-stateless` | no | no | Does memory matter at all? |
| `llm-metric` | scalars | no | Ablation: history without failure analysis |
| `llm-diagnostic` | yes | yes | The system under test |

`llm-metric` versus `llm-diagnostic` is the actual contribution: it isolates whether *reasoning over failure*, not just remembering scores, drives any improvement.

## The experiment loop

Every arm runs the same loop; only the proposer changes. Click a step to see what happens there.

<div class="diagram loop" data-diagram>
  <div class="dg-flow" role="group" aria-label="Experiment loop">
    <button type="button" class="dg-node" data-k="propose"><span class="dg-i">1</span>Proposer</button>
    <button type="button" class="dg-node" data-k="spec"><span class="dg-i">2</span>ExperimentSpec</button>
    <button type="button" class="dg-node" data-k="run"><span class="dg-i">3</span>Runner</button>
    <button type="button" class="dg-node" data-k="measure"><span class="dg-i">4</span>Metrics</button>
    <button type="button" class="dg-node" data-k="diagnose"><span class="dg-i">5</span>Diagnostics</button>
  </div>
  <div class="dg-panel" aria-live="polite">
    <div data-detail="propose" id="as-propose"><b>Proposer.</b> One of five arms (random, Optuna TPE or one of three LLM variants) picks the next experiment. This is the only part that differs between arms.</div>
    <div data-detail="spec" id="as-spec" hidden><b>A validated spec, not code.</b> The proposal is a whitelisted <code>ExperimentSpec</code>: hashable, loggable and safe. The agent never writes code that gets executed.</div>
    <div data-detail="run" id="as-run" hidden><b>Same environment for everyone.</b> The runner compiles the spec into a scikit-learn pipeline and trains it, with the identical action space for every arm, so the comparison stays fair.</div>
    <div data-detail="measure" id="as-measure" hidden><b>Metrics beyond final accuracy.</b> Budget-to-target, hypothesis precision, novelty rate and regret, each with variance across seeds.</div>
    <div data-detail="diagnose" id="as-diagnose" hidden><b>What the agent learns from failure.</b> Only the <code>llm-diagnostic</code> arm sees why runs failed, then the loop returns to the proposer. Deciding what goes into this feedback is the research question itself.</div>
  </div>
</div>

## What gets measured

Final accuracy is the weakest metric, because one lucky run can win it. Instead:

- **Budget-to-target:** experiments needed to reach a fixed score.
- **Hypothesis precision:** the share of proposals that actually beat the incumbent. This is what separates reasoning from sampling.
- **Novelty rate:** how often proposals are structurally new. An agent that never explores is just an expensive Optuna.
- **Regret curve:** distance from the best score any arm found, over the budget.

Every metric is reported with variance across seeds. A single trajectory is an anecdote.

## Key design decisions

### The agent doesn't write code

It emits a validated, whitelisted `ExperimentSpec` that the runner compiles into a scikit-learn pipeline. That gives reproducibility (a spec is hashable and loggable), safety (no executing model-written code) and a fair comparison (Optuna searches the identical space).

### Contamination control

Ask an LLM about the Titanic dataset and it recites memorised feature engineering. That's recall, not reasoning. An `--obfuscate` mode strips dataset names, renames columns to `f_0..f_n` and shuffles their order, and a gap between named and obfuscated runs is itself a finding.

### Diagnostics are the research object

Deciding *what to show the agent about a failure* is where the real work lives. Everything else is plumbing to measure it.

## Status

The core loop and all baselines are implemented. Without an API key the LLM arms fall back to a deterministic mock, so the loop still runs end to end in CI. A literature/RAG arm, a knowledge graph and a dashboard are deliberately deferred.
