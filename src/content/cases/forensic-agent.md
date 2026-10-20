---
title: Forensic Agent
cat: AI / ML · Security
lede: Rebuilds an incident timeline from messy, mixed-format logs while keeping every conclusion traceable to the records behind it.
tags: [Python, FastAPI, Entity graphs, Anomaly detection, RAG]
order: 3
demo: { href: /demo/forensic, label: Investigate a case }
---

## The claim

Narrow and testable: *an automated pipeline can reconstruct an incident timeline from heterogeneous evidence while keeping every conclusion traceable to its supporting records.* A ground-truth generator and an evaluator exist to measure exactly that.

## Pipeline

Six stages, from raw logs to cited answers. Click a stage to see what it does.

<div class="diagram" data-diagram>
  <div class="dg-flow" role="group" aria-label="Pipeline stages">
    <button type="button" class="dg-node" data-k="ingest"><span class="dg-i">1</span>Ingest</button>
    <button type="button" class="dg-node" data-k="normalise"><span class="dg-i">2</span>Normalise</button>
    <button type="button" class="dg-node" data-k="graph"><span class="dg-i">3</span>Entity graph</button>
    <button type="button" class="dg-node" data-k="rank"><span class="dg-i">4</span>Rank anomalies</button>
    <button type="button" class="dg-node" data-k="correlate"><span class="dg-i">5</span>Correlate</button>
    <button type="button" class="dg-node" data-k="answer"><span class="dg-i">6</span>Cited answers</button>
  </div>
  <div class="dg-panel" aria-live="polite">
    <div data-detail="ingest" id="fa-ingest"><b>Ingest heterogeneous evidence.</b> Logs from several sources (five in the test case), in five timestamp formats across two timezones. Every file and line is kept so any event can be traced back to its raw source.</div>
    <div data-detail="normalise" id="fa-normalise" hidden><b>One event stream.</b> Timestamps are normalised and an undeclared 37-second clock skew is recovered from 17 anchor events seen in two sources at once. Derived timestamps carry reduced confidence that flows into later scores.</div>
    <div data-detail="graph" id="fa-graph" hidden><b>Entity graph.</b> Users, hosts and addresses become linked entities. A connection finder returns routes between any two of them, each route made of citable events.</div>
    <div data-detail="rank" id="fa-rank" hidden><b>Ranked anomaly queue.</b> Every flagged event carries the reason it was flagged. Recall is 1.000 (22/22 planted events), and the top 10 of the queue is 10 for 10.</div>
    <div data-detail="correlate" id="fa-correlate" hidden><b>Incident chains.</b> Anomalies are correlated and scored against access → escalation → execution → collection → exfiltration → cleanup. Routine browsing appears as context but earns no score, so ordinary web traffic doesn't look like an attack.</div>
    <div data-detail="answer" id="fa-answer" hidden><b>Answers that cite their evidence.</b> Every statement links the event IDs behind it. A model finding that cites anything outside the retrieved evidence is dropped whole and counted. Unsupported-claim rate on the test case: 0.000.</div>
  </div>
</div>

## Design decisions

- **Nothing is asserted without a citation.** A model-generated finding that cites an event outside the retrieved evidence is dropped whole, not repaired, and counted.
- **Order comes from evidence, never from a model.** A plausible-but-wrong ordering is the error most likely to survive review.
- **Timestamps are treated as the hard problem.** Five formats, two timezones, one source with no year and an undeclared 37-second clock skew, recovered from anchor events seen in two sources at once.
- **Fail closed.** The dashboard won't start until an account exists. Passwords use scrypt; sessions expire after 2 h idle or 12 h total; logins are rate-limited.
- **The dashboard computes nothing.** Every view is a projection of the same analysis the CLI produces, so the two can never disagree.

## Measured results

Against a generated case with known ground truth (527 events, 5 sources, 2 planted attack chains), stable across several seeds:

<div class="metrics">
  <div class="metric"><b>1.000</b><span>Anomaly recall (22/22 planted events)</span></div>
  <div class="metric"><b>1.000</b><span>Incident detection (2/2 chains)</span></div>
  <div class="metric"><b>0.00 s</b><span>Clock-skew error (true +37 s, from 17 anchors)</span></div>
  <div class="metric"><b>110/110</b><span>Event pairs ordered correctly</span></div>
  <div class="metric"><b>0.833</b><span>Retrieval precision@10</span></div>
  <div class="metric"><b>0.000</b><span>Unsupported claim rate</span></div>
</div>

### Reading the weak number honestly

Overall anomaly precision is **0.232**: roughly three in four flagged events are benign. That's a deliberate operating point, since a missed event can end an investigation, and precision@10 (1.000) is what an investigator working the ranked queue actually sees. It's also the first number to attack next.
