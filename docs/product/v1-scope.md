# Sarthi Android v1 — Product scope (FROZEN)

**Status:** FROZEN  
**Effective date:** 2026-04-20  
**Supersedes:** Informal scope notes only.  
**Change policy:** Any change to in-scope behavior, non-goals, or success metrics requires an explicit decision record per the [decision record policy](../governance/decision-record-policy.md).

---

## Purpose

This document freezes what Android v1 **must** deliver, what it **must not** attempt, and how we judge success. Engineering contracts ([contracts/openapi.yaml](../contracts/openapi.yaml)) and analytics ([analytics/taxonomy-v1.md](../analytics/taxonomy-v1.md)) must align with this scope.

---

## Product principles (non-negotiable)

These mirror the program reference spec and apply to all v1 work.

- **Agency first:** Autonomous actions are explainable, reviewable, and user-controllable.
- **Calm reliability:** Reminders, plans, and interventions behave predictably on Android.
- **Contract-first:** Public HTTP and analytics contracts are authoritative for client and server boundaries.
- **Evidence-driven:** Post-launch roadmap changes lean on telemetry and outcome metrics defined below.

---

## In scope (Android v1)

### User journeys (end-to-end)

1. **First-run onboarding**  
   User completes a guided flow (account/session establishment, preferences needed for coaching, notification permission prompt where appropriate). Onboarding has a defined completion state exposed via the API.

2. **Single active resolution**  
   User creates **one** active resolution/commitment at a time. The product and API enforce “at most one active resolution” for v1. User can complete or explicitly end a resolution before starting another.

3. **Week-1 actionable task loop**  
   After resolution setup, the system produces **week-1** actionable tasks. User sees tasks, marks them complete, and sees progress. Task completion is idempotent and sync-friendly (see API contract).

4. **One intervention path with user approval**  
   Exactly **one** intervention style in v1 (documented in engineering as a single state machine). The user receives a prompt, can **approve** or **dismiss** (or equivalent explicit actions). No silent auto-execution of intervention side effects without user approval.

5. **Transparency log**  
   User can inspect a chronological **transparency log** of **major** system actions (e.g., plan generated, reminder scheduled, intervention proposed). Append-only from the user’s perspective; pagination via API.

6. **Push notifications**  
   Push for **core reminders** and **intervention prompts**, behind the mobile notification provider abstraction. Server registers device tokens via API; permission state is respected.

### Core behavior loop (intent preserved)

Brain dump → decomposition → weekly plan → intervention remains the **conceptual** loop. v1 constrains surface area: one resolution, week-1 tasks, one intervention path, with transparency and control.

---

## Out of scope (initial v1)

- **Multiple concurrent resolutions** or rich resolution hierarchies beyond “one active”.
- **Social/community** features (sharing, feeds, groups).
- **Heavy customization** not tied to validated retention or completion outcomes (themes are fine; complex rule engines are not).
- **Simultaneous iOS launch**; iOS follows after Android stabilization per program plan.
- **Cross-device real-time collaboration** beyond normal sync of the same user account.
- **Advanced planner experimentation UI** (A/B of multiple planners, user-visible model pickers) unless required for safety; planner **versioning** is backend-internal for v1.

---

## Numeric and product constraints (normative)

| Constraint | v1 rule |
| --- | --- |
| Active resolutions | At most **one** active at a time per user |
| Task horizon | **Week 1** only (7-day window from plan start, defined in API) |
| Intervention paths | **Exactly one** product path; API reflects single pending/approve/dismiss flow |
| Transparency log | **Major** actions only; full low-level trace stays internal/ops |

---

## Success metrics (v1)

Targets are **directional** until baseline data exists; definitions are fixed so measurement does not drift.

| Metric | Definition | Notes |
| --- | --- | --- |
| Onboarding completion rate | % new users reaching `onboarding_completed` (see analytics taxonomy) | Primary activation |
| Week-1 task completion rate | Completed tasks / assigned week-1 tasks for users who finished onboarding | Core value loop |
| Intervention engagement | Approve + dismiss counts vs. impressions; time-to-action | “Calm” prompt, not spammy |
| Notification permission grant rate | OS permission granted where eligible | Enables reliability |
| Reliability incidents (qualitative + counts) | Missed reminders, duplicate pushes, contradictory tasks | Tracked as support + `error_boundary` events |

---

## Release definition (Android v1)

### Blocking (must fix before “v1 shipped” on Play)

- Violations of **agency first** (e.g., intervention side effects without approval path).
- Data loss for resolution/tasks/log entries already acknowledged by the server.
- Crash on core loop: onboarding → task list → complete task → view transparency log.
- Contract tests missing for any **core** `/v1` endpoint enumerated in [quality gates](../engineering/quality-gates-v1.md).
- No rollback path documented for backend and app release channels (runbook can live in `docs/` when added).

### Non-blocking (may ship with known issues if documented)

- Cosmetic UI defects with no impact on comprehension of autonomy or schedules.
- Non-core screens (e.g., secondary settings) with graceful degradation.
- Performance below target **if** SLOs are not yet baseline-measured, but no unbounded hangs on core endpoints.

---

## Engineering acceptance criteria stub

Delivery must produce **evidence** listed in [quality gates v1](../engineering/quality-gates-v1.md): contract tests for core endpoints, E2E smoke for onboarding → task completion → intervention path, and alignment of analytics taxonomy with implemented events.

---

## Security and privacy baseline (v1 appendix)

- **Transport:** TLS for all production API traffic; certificate pinning policy deferred to a later hardening milestone unless threat model requires earlier.
- **Tokens:** Mobile stores session secrets in **Expo SecureStore**; no long-lived tokens in plain app storage.
- **Data minimization:** Analytics must follow [taxonomy PII rules](../analytics/taxonomy-v1.md); free-text prompts are **not** analytics properties.
- **Transparency:** User-facing log mirrors major backend-side actions affecting the user; internal-only debug remains out of product UI.

---

## Legacy boundary

Code or assets under `old/` (when present) are **reference only**. No v1 feature work ships from legacy paths without meeting current contracts, tests, and security bar. Legacy code must not bypass the [decision record policy](../governance/decision-record-policy.md) for scope or contract changes.

---

## Legacy API parity (informative)

Frozen v1 **does not** replicate every legacy endpoint. The following are **intentional** for Android v1; see also the **Legacy API** section in [contracts/openapi.yaml](../contracts/openapi.yaml).

| Topic | Legacy behavior | v1 decision |
| --- | --- | --- |
| API prefix | Unversioned `/` routes | **`/v1` only** for product APIs |
| Multiple resolutions list | `GET /resolutions` with filters | **Deferred:** v1 is **one active resolution**; use `GET /v1/resolutions/current` and create/patch flows |
| Resolution decompose/approve steps | Separate `/decompose`, `/approve` | **Replaced** by week-1 generation (`generate-week-1`) and single-resolution model per normative constraints |
| Global task inbox | `GET /tasks` with status/date filters | **Deferred:** tasks are listed under **`/v1/resolutions/{resolution_id}/tasks`** (week-1 scope) |
| Rolling weekly plan + intervention snapshot CRUD | Top-level `/weekly-plan/*`, `/interventions/preview\|run\|history` | **Replaced** by resolution-scoped plan preview/history and **`/v1/interventions/*`** for the single intervention path |
| Agent log naming | `agent-log` | **Renamed** to **`transparency-log`** (same product intent) |
| Jobs / ops | `/jobs`, `/jobs/run-now` | **Replaced** by **`/v1/ops/jobs`** guarded by `X-Ops-Key` |

Anything not required for the [quality gates](../engineering/quality-gates-v1.md) core `/v1` list is **post-v1 backlog** unless the decision record policy is followed.
