# Android release readiness (governance)

**Purpose:** Supplements [contract-readiness-review.md](contract-readiness-review.md) for the reliability, observability, and Android pre-release bar. Use this as the checklist before promoting internal/preview Android builds.

**Sign-off (when ready):**

| Role | Name | Date |
| --- | --- | --- |
| Mobile lead | | |
| Backend lead | | |

**Gates (repository):**

- Contract tests green (`backend/tests/`), including auth rate limits and deployed-environment JWT validation (`tests/test_security_and_config.py`).
- CI green: backend pytest, mobile typecheck/lint/test, OpenAPI lint (see [.github/workflows/ci.yml](../../.github/workflows/ci.yml)).
- Maestro vertical slice flow documented ([mobile/maestro/slice.yaml](../../mobile/maestro/slice.yaml)); run on device/emulator before internal track (see [maestro workflow](../../.github/workflows/maestro.yml)).

**Vendor / org (complete outside git):**

- **Sentry:** Projects for API, worker, and mobile; DSNs only via env / [EAS secrets](../operations/runbooks.md#eas-env--secrets-preview--production). Enable **Release Health** (sessions) on the mobile project; set alerts for crash-free rate regression and elevated error volume for API/worker.
- **PostHog:** Project for `internal` / `preview` (and production when applicable); build **insights or dashboards** for the core funnel in [analytics taxonomy](../analytics/taxonomy-v1.md) (onboarding → task → intervention).
- **GitHub:** Branch protection on `main` (or default branch): require status checks from [ci.yml](../../.github/workflows/ci.yml) to pass before merge.

**Next:** Staged production rollout — [android-staged-rollout-checklist.md](android-staged-rollout-checklist.md).
