---
title: My portfolio said Jest. The code said Vitest.
summary: Linking every skill on this site to real code exposed a claim that had quietly gone out of date. Here's how the check works.
date: 2026-10-22
tag: This site
---

This site said Venture DAO had "20+ Jest suites". It has 23 test files, so the number was right. The framework wasn't: the tests run on Vitest, and nothing had ever compared the description with the code.

Nobody would have noticed. That's the problem.

## Claims drift, code doesn't

A portfolio is a list of claims: I know PostgreSQL, I've used WebRTC, this project has tests. Each was true when written. Then the code changes and the description doesn't, because nothing connects the two.

So this site now connects them. The [skills evidence page](/evidence) links every skill to the place in a public repository that proves it: a dependency in `package.json`, a file in the tree, or a specific line of code, always pinned to an exact commit so the line numbers can't drift.

## How it works

A small script reads each public repo through the GitHub API:

1. Resolve the default branch to a commit hash, and pin everything to it.
2. List every file, and parse `package.json`, `requirements.txt` and `pubspec.yaml` into dependency names with their line numbers.
3. Check each skill against simple rules, like "Vitest means a `vitest` dependency" or "WebRTC means `RTCPeerConnection` appears in the client code".
4. Write the results to a JSON file the site builds from.

Projects whose code isn't public still appear, marked as *described* rather than *proven*, with a dashed line instead of a solid one. That distinction matters more than the graph does.

## What it caught

The first run found no Jest dependency anywhere in Venture DAO. The test runner is `vitest run`. Seven places on the site said otherwise: the project tags and description, the case study's tags and text, a milestone, and two lines of the Hindi translation. All seven now say Vitest. The [code tours](/tour) come out of the same script, so the excerpts there are also real lines at a known commit.

## The general idea

If a claim can be checked by a program, check it with a program. Hand-written descriptions are where small untruths survive, not because anyone lies, but because nobody re-reads them.
