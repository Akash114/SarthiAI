# Android staged rollout and telemetry-driven stabilization

**Purpose:** Operational checklist to move Android from pre-release ([android-release-readiness.md](android-release-readiness.md)) to **production users under control**, then **stabilize using telemetry**. iOS is out of scope here; it is tracked separately per [v1 scope](v1-scope.md).

---

## 1. Preconditions (before first Play promotion)

Confirm each item before moving a build to **Internal testing** or beyond.

| Check | Owner | Date / notes |
| --- | --- | --- |
| [android-release-readiness.md](android-release-readiness.md) gates satisfied (CI, contracts, Maestro slice path documented) | | |
| Backend **API** and **RQ worker** deployed; **same** `DATABASE_URL` / `REDIS_URL` / API base URL as configured in mobile `EXPO_PUBLIC_API_URL` for this track | | |
| **Sentry:** separate projects (or clearly tagged environments) for API, worker, mobile; mobile **Release Health** on; DSNs via host env / [EAS secrets](../operations/runbooks.md#eas-env--secrets-preview--production) only | | |
| **PostHog:** project(s) per policy (preview vs production); EU/US **host** matches keys ([ADR 0002](../adr/0002-product-analytics-posthog.md)); dashboards exist for core funnel ([taxonomy](../analytics/taxonomy-v1.md): onboarding → task → intervention) | | |
| **GitHub:** branch protection requires [.github/workflows/ci.yml](../../.github/workflows/ci.yml) on merge | | |
| SLO baselines understood as **directional** until traffic exists ([slo-android-v1.md](../engineering/slo-android-v1.md)) | | |

**Sign-off — staged rollout start:**

| Role | Name | Date |
| --- | --- | --- |
| Mobile lead | | |
| Backend lead | | |

---

## 2. Play tracks and EAS profiles

Map Google Play tracks to local build/submit conventions ([mobile/eas.json](../../mobile/eas.json)).

| Play track | Typical use | EAS profile | Update channel (`eas.json`) | Telemetry env (`EXPO_PUBLIC_*`) |
| --- | --- | --- | --- | --- |
| **Internal testing** | Fastest feedback, smallest group | `preview` | `preview` | Non-production Sentry / PostHog projects |
| **Closed testing** | Broader devices/OS; Maestro on representative hardware | `preview` (or `production` bundle + internal listing — team choice) | `preview` unless you intentionally ship `production` channel | Align with preview/staging keys |
| **Production — staged rollout** | End users | `production` | `production` | Production API URL, Sentry env `production`, PostHog production project |

**Commands (reference):**

```bash
# Internal / preview-style artifact
eas build --profile preview --platform android

# Store-bound production artifact
eas build --profile production --platform android
eas submit --profile production --platform android   # submit.*.production in eas.json
```

**Version discipline**

- Bump **`expo.version`** (semver shown to users) when you want a visible release label.
- Bump **`expo.android.versionCode`** in [mobile/app.json](../../mobile/app.json) **for every** new bundle uploaded to Play (monotonic integer). This ties **Play**, **Sentry** `dist`, and support triage together.

**Traceability (fill per release)**

| Field | Value |
| --- | --- |
| Git tag / commit | |
| EAS build ID | |
| Play release name / version codes | |
| Notes / changelog link | |

---

## 3. Telemetry review cadence (during rollout)

Repeat **at least weekly**; **daily** while staged % is stepping.

| Activity | Where | Reference |
| --- | --- | --- |
| Crash-free sessions vs prior build | Sentry → mobile project → Release Health | [slo-android-v1.md](../engineering/slo-android-v1.md) (&gt; 99% directional) |
| New/regressed mobile issues | Sentry Issues, filtered by release | Core loop: onboarding, tasks, notifications |
| API/worker errors | Sentry + JSON logs (`request_id`, optional `trace_id`) | Same SLO doc; [runbooks](../operations/runbooks.md) |
| Product funnel | PostHog insights/dashboards | Events per [taxonomy-v1.md](../analytics/taxonomy-v1.md); segment by `build_channel`, `app_version`, `locale` — **no PII** |
| Worker failures | Logs `week1_job_failed`, RQ failed registry | [runbooks — RQ worker](../operations/runbooks.md#rq-worker) |
| Optional p95 latency | OTLP backend if `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` set | [runbooks — Observability](../operations/runbooks.md#observability) |

---

## 4. Stabilization rules (pause, rollback, priorities)

**Authoritative operational detail:** [runbooks — Android staged rollout](../operations/runbooks.md#android-staged-rollout-stabilization).

Summary:

- **Pause or halt** staged rollout if crash-free rate collapses, sustained 5xx/worker failures, or core funnel drops without cohort explanation.
- **Rollback order:** Play bundle promotion → **EAS Update** (JS/asset-only per [ADR 0009](../adr/0009-mobile-expo-eas.md)) → backend redeploy per runbooks.
- **Triage:** P0 = safety, auth, onboarding/task crashes, broken push reminders; P1 = interventions, plan generation failures; P2 after stable.

**Rollout week ownership**

| Role | Name | Contact |
| --- | --- | --- |
| Primary on-call (Sentry + PostHog during % increases) | | |
| Secondary | | |

---

## 5. Exit criteria (Android production stabilization)

Stabilization is **complete** when **all** of the following are true (adjust numeric gates after you have baseline weeks of data).

| Criterion | Target | Met (Y/N) | Evidence link / notes |
| --- | --- | --- | --- |
| Production staged rollout | Reached **100%** (or team-defined cap, documented below) without holding for unresolved **P0/P1** | | |
| Mobile crash-free sessions | Stable vs prior release and within [SLO](../engineering/slo-android-v1.md) band (&gt; 99% directional) | | |
| API availability / error rate | Within [SLO](../engineering/slo-android-v1.md) intent (no sustained breach; Sentry under control) | | |
| Core PostHog funnel | Acceptable conversion onboarding → task → intervention for **production** cohort; known gaps **fixed** or **explicitly accepted** with mitigation | | |
| Runbooks exercised | At least one **rollback or pause** drill **documented** (see [runbooks — Drill log](../operations/runbooks.md#rollback--pause-drill-log)) | | |

**Team-defined rollout cap (if not 100%):** *50%* — rationale: *To test the stability of the app and the backend API*

**Sign-off — stabilization complete:**

| Role | Name | Date |
| --- | --- | --- |
| Mobile lead | | |
| Backend lead | | |
| Product / owner | | |

---

## 6. Repository touchpoints (ongoing)

- Keep [.github/workflows/ci.yml](../../.github/workflows/ci.yml) green on stabilization fixes.
- Re-run [mobile/maestro/slice.yaml](../../mobile/maestro/slice.yaml) before each **production** artifact promotion if not automated ([maestro workflow](../../.github/workflows/maestro.yml) is manual).

iOS (TestFlight, App Store) follows once Android meets the quality bar in [v1 scope](v1-scope.md).
