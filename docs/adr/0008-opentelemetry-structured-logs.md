# ADR 0008: OpenTelemetry and structured logs (minimal bootstrap)

## Status

Accepted

## Context

Program reference requires OpenTelemetry plus structured logs for observability.

## Decision

**Phase 2–3 bootstrap (normative direction):**

- **Logs:** JSON structured logs on backend with required fields `timestamp`, `level`, `message`, `request_id`, and optional `user_id` (opaque UUID only).
- **Traces:** W3C `traceparent` propagation on `/v1` requests; export OpenTelemetry traces from FastAPI in **staging/production** first; local dev may run a collector or no-op exporter until Phase 3 hardening.

Mobile: defer full OTel until Phase 3 unless needed for perf work; Sentry performance monitoring is optional and subordinate to product analytics.

## Rationale

- Avoids blocking Phase 2 feature work on full distributed tracing while meeting the “structured + trace context” direction.
- Backend is the source of truth for request correlation with jobs (RQ) via shared `request_id` / trace IDs in enqueue payloads.

## Alternatives considered

- **Full OTel on mobile in v1:** Rejected as unnecessary cost before Android stability baseline exists.

## Android-first timeline impact

Positive: keeps initial mobile scope lean; backend logs cover API failures during slice development.

## Rollback / migration

Exporters and collectors are pluggable; log field names remain stable contracts for log pipelines.
