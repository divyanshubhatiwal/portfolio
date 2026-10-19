---
title: RideCompare
cat: Backend · Aggregation
lede: One request, four ride-hailing providers, one comparable answer.
tags: [FastAPI, PostgreSQL 16, Redis 7, Celery, Flutter, Nginx]
order: 5
links:
  - href: https://github.com/divyanshubhatiwal/ridecompare
    label: Source code
---

## The problem

Every provider returns fares and ETAs in its own shape, at its own speed, and some of them fail. A comparison is only useful if it's fast and apples-to-apples.

## How it's built

- **Concurrent fan-out** of fare and ETA lookups to four providers behind a common adapter interface.
- **Normalisation** of inconsistent third-party responses into one comparable schema.
- **Redis caching** on the hot path.
- **JWT auth** with access/refresh token rotation.
- **Celery workers** for price alerts and token cleanup.
- **Versioned schema migrations** on PostgreSQL 16.
- **CI/CD:** GitHub Actions builds and deploys Docker images behind an Nginx reverse proxy, with a Flutter client on top.
