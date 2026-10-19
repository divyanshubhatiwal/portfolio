---
title: SafeSignal AI
cat: Backend · Health data
lede: An NLP pharmacovigilance data platform that surfaces drug-safety signals from messy adverse-event reports.
tags: [FastAPI, PostgreSQL, Redis, Elasticsearch, React, pytest]
order: 6
---

## The problem

Adverse-event reports arrive in inconsistent formats. Before any statistics can run, they have to be parsed, cleaned and normalised, and errors at that stage silently corrupt everything downstream.

## How it's built

- **Ingestion pipeline** that parses heterogeneous reports and normalises them into a relational Postgres schema.
- **Signal detection** using ROR and PRR disproportionality statistics.
- **Analytics API** on FastAPI, with Redis caching and Elasticsearch-backed search.
- **A full pytest suite**, so data-quality regressions are caught before they reach downstream output.
