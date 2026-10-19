---
title: FlowBoard
cat: Full-stack · AI
lede: An AI-powered project management app with real-time collaboration and 15+ productivity views.
tags: [React 18, TypeScript, Supabase, PostgreSQL, Tailwind CSS, Claude AI]
order: 4
links:
  - href: https://flowboard-teal.vercel.app/
    label: Live app
---

## What it does

One workspace with Kanban, Gantt timeline, sprint planning, calendar and analytics views over the same real-time data, plus an assistant that turns plain language into tasks.

## How it's built

- **Frontend:** React 18 and Tailwind CSS, with responsive layouts across all 15+ views.
- **Backend:** Supabase (PostgreSQL) with row-level security, real-time task sync and email-verified sign-up.
- **AI features:** natural-language task creation, risk detection, workload analysis and smart priority ranking, using Claude with an offline, rule-based fallback for when the model is unavailable.
- **Automation:** a rule-based workflow engine, recurring-task scheduler, task dependency graph and a team leaderboard with achievement badges.

## The design choice that matters

The AI is an accelerator, not a dependency. Every AI-driven action has a deterministic fallback, so the app keeps working when the model is slow, rate-limited or down.
