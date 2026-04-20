# Engineering quality gates — v1

This document ties the frozen product scope ([v1 scope](../product/v1-scope.md)) to **evidence** required before Android production (full hardening and observability maturity follow as the stack stabilizes).

## Core delivery evidence (before broad UI expansion)

1. **Contract tests** for every **core** `/v1` endpoint:
   - Auth: login, refresh, logout (or equivalent session lifecycle defined in OpenAPI).
   - Onboarding: read/update state.
   - Resolution: create, read current, update/complete; enforce single active rule at API level.
   - Tasks: list week-1, complete task (idempotency verified).
   - Intervention: fetch pending, approve, dismiss.
   - Transparency log: paged read.
   - Device push token registration.

2. **E2E smoke** (tooling per ADR): one automated flow covering **onboarding → task completion → intervention prompt** on Android (staging or CI device farm as available).

3. **Analytics instrumentation review**: implemented events are a subset of or equal to [taxonomy v1](../analytics/taxonomy-v1.md); no PII violations.

## Deferred (do not block the vertical slice)

- Crash-free session SLO enforcement in release tooling.
- Full OpenTelemetry deployment and SLO dashboards.
- Staged rollout playbook execution.

## References

- [OpenAPI v1 contract](../contracts/openapi.yaml)
- [Stack ADRs](../adr/README.md)
