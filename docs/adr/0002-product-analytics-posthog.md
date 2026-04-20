# ADR 0002: Product analytics with PostHog

## Status

Accepted

## Context

The program reference requires PostHog or Amplitude with a **frozen taxonomy** before launch-scale implementation.

## Decision

Use **PostHog** for product analytics (cloud project for production; self-host not required for v1).

## Rationale

- **Engineering velocity:** SDK and event capture are straightforward for Expo/React Native and server-side events if needed later.
- **Inspectability:** Live event stream and funnels help validate the Android-first loop during Phase 2–4.
- **Cost and flexibility:** Pricing and feature set are acceptable for early-stage; open-source core aligns with project values if self-host becomes desirable.

## Alternatives considered

- **Amplitude:** Mature enterprise analytics; rejected primarily on marginal value over PostHog for v1 scope and team familiarity trade-offs (either can work; pick one to avoid split taxonomies).

## Android-first timeline impact

Neutral to positive: single vendor decision unblocks instrumentation in Phase 2 without parallel integrations.

## Rollback / migration

Taxonomy is vendor-agnostic in [docs/analytics/taxonomy-v1.md](../analytics/taxonomy-v1.md). If migrating vendors, map event names/properties through a thin client wrapper and replay validation in staging.
