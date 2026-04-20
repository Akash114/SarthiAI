# Contract readiness review

**Note:** For Android pre-release sign-off, use [android-release-readiness.md](android-release-readiness.md).

**Purpose:** Capture a short, explicit sign-off that frozen contracts and ADRs are sufficient to expand client and server implementation without expected contract churn.

**How to use:** Mobile and backend leads (or named delegates) complete the checklist and sign below. If any item is “no”, open a decision record or update the frozen docs before merging work that depends on the contract.

---

## Checklist

### Product

- [ ] [v1 scope](v1-scope.md) (FROZEN) matches intended Android v1 journeys and constraints.
- [ ] [Decision record policy](../governance/decision-record-policy.md) is understood for any post-freeze change.
- [ ] Success metrics and release definition are actionable for engineering and QA.

### Stack and policy

- [ ] [ADRs](../adr/README.md) resolve the planned forks (jobs, analytics, E2E, CI, pinning, auth, Sentry, OTel bootstrap, EAS).
- [ ] No open “or” decisions block client or server implementation for the vertical slice.

### HTTP contract

- [ ] [OpenAPI v1](../contracts/openapi.yaml) covers auth, onboarding, resolution, week-1 tasks, intervention, transparency log, and push registration.
- [ ] Error envelope, idempotency, pagination, and changelog policy are understood by both client and server owners.
- [ ] OpenAPI validates in CI (Redocly in `.github/workflows/ci.yml` → `openapi` job) or locally (e.g. [docs/contracts/README.md](../contracts/README.md)) with **zero** errors on merge.

### Analytics

- [ ] [Taxonomy v1](../analytics/taxonomy-v1.md) (FROZEN) is implementable without PII ambiguity.
- [ ] PostHog project/stages exist or are scheduled before first instrumented build to Play internal.

### Quality gates linkage

- [ ] [Quality gates v1](../engineering/quality-gates-v1.md) is acknowledged as the evidence bar (contract tests + Maestro smoke).

---

## Schema churn risk (explicit)

| Topic | Risk if unreviewed | Mitigation |
| --- | --- | --- |
| Auth token claims | Client refresh logic churn | Freeze claim shape in backend ADR + OpenAPI descriptions |
| `OnboardingState.step` | Opaque strings drift | Align mobile routes to allowed step enum in implementation PR |
| Intervention state machine | Extra states leak into API | Keep `Intervention.status` enum minimal until product expands |

---

## Sign-off

| Role | Name | Date | Notes |
| --- | --- | --- | --- |
| Mobile lead | | | |
| Backend lead | | | |

By signing, both parties agree that **frozen contracts and ADRs are authoritative** for implementation unless superseded by a formal decision record.
