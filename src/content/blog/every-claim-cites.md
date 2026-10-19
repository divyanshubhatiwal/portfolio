---
title: Every claim needs a citation
summary: Lessons from building a forensic pipeline where the model is never allowed to just say things.
date: 2026-10-19
tag: Forensic Agent
---

An investigator can't act on "the model thinks the attacker escalated privileges at 2 a.m." They need to know *which records* say so. That shaped every decision in my forensic pipeline.

## Rule 1: no citation, no claim

Every finding carries the event IDs behind it. If the model produces a finding that cites an event outside the retrieved evidence, the whole finding is dropped, not patched, and counted. On the test case the unsupported-claim rate is 0.

## Rule 2: the model never decides order

Sequence comes from normalised timestamps with deterministic tie-breaking. A plausible-but-wrong ordering is exactly the kind of error that survives review, so I never ask an LLM what happened first.

## Rule 3: timestamps are the hard problem

The test evidence mixes five timestamp formats, two timezones, one source with no year, and one with an undeclared 37-second clock skew. The pipeline recovers that skew from events recorded in two sources at once, and it was exact on the test case: true +37 s, recovered +37 s.

## The number I'm least happy with

Recall is perfect (22 of 22 planted events flagged), but overall precision is 0.232: about three in four flags are benign. That's deliberate, because missing an event can end an investigation, and the top-10 ranked queue an investigator actually works is 10 for 10. It's still the first thing I'd improve.

## What I took away

Making an LLM useful in a high-stakes setting is mostly about deciding what it's *not* allowed to do.
