# ADR 0007: Error monitoring with Sentry (mobile + backend)

## Status

Accepted

## Context

The program reference requires Sentry on mobile and backend before production quality bar.

## Decision

Use **Sentry** as the primary error monitoring for Expo/React Native and FastAPI, with separate **projects** (or environments) per platform and `production` / `staging` / `development` release stages.

Default scrubbing:

- Strip authorization headers, cookies, and refresh tokens from error contexts.
- Do not attach resolution body text, prompts, or analytics-style PII in breadcrumbs without redaction.

## Rationale

- Mature RN and Python SDKs, release health, and stack traces for crash triage.
- Aligns with program spec without adding parallel error vendors in v1.

## Alternatives considered

- **Self-hosted-only or vendor lock-in avoidance:** Deferred; Sentry SaaS is acceptable for v1 velocity.

## Android-first timeline impact

Neutral: configure early alongside first real screens and API.

## Rollback / migration

Errors can be dual-exported later if needed; keep SDK initialization behind a thin module to swap implementation.
