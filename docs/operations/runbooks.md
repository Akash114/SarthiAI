# Operations runbooks (v1)

## Production config validation

The API process, RQ worker, and optional APScheduler each call `validate_settings_for_environment()` at startup (see [backend/app/config.py](../../backend/app/config.py)).

- When **`ENVIRONMENT`** is set to a deployed value (`production`, `staging`, `prod`, or `preview`), **`JWT_SECRET`** must not remain at the repository default and must be **at least 32 characters**.
- **`AUTH_RATE_LIMIT_PER_MINUTE`** (default `30`, `0` to disable) limits unauthenticated **`/v1/auth/register`**, **`/login`**, and **`/refresh`** per client IP in-process; for multiple API replicas, tune limits or move to a shared store.
- **`OPS_API_KEY`**: Set to expose **`/v1/ops/*`**; omit in environments where manual job triggers are not needed (routes return **404**).

## Backend API rollback

1. **Stop** serving traffic to the bad revision (load balancer / process manager).
2. **Redeploy** the previous container image or git tag that last passed CI and contract tests.
3. **Database:** Alembic upgrades are forward-only in production; if a migration caused the incident, restore from backup and re-apply only safe revisions after root-cause review. Do not run `downgrade` on production without a written decision record.
4. **Redis / RQ:** Failed jobs remain in Redis’s failed registry; drain or retry after the API is healthy. Worker processes can be restarted independently of the API.

## RQ worker

- **Queue name:** `sarthi` (see [backend/app/queue.py](../../backend/app/queue.py)).
- **Restart:** `python -m app.worker` (or Docker `worker` service). Ensure `REDIS_URL` and `DATABASE_URL` match the API.
- **Failed jobs:** With the same `REDIS_URL`, use the RQ Python API or a dashboard to list the **failed job registry** for queue `sarthi`, inspect exceptions, then **requeue** or delete after fixing root cause. Example (from `backend/` venv):

  ```python
  from redis import Redis
  from rq import Queue
  from rq.registry import FailedJobRegistry

  conn = Redis.from_url("redis://127.0.0.1:6379/0")
  q = Queue("sarthi", connection=conn)
  failed = FailedJobRegistry(queue=q)
  print("failed count:", len(failed))
  # Requeue one: failed.requeue(job_id)  # if supported; else delete and re-trigger via API
  ```

- **Logs:** Failed `run_generate_week1` emits `week1_job_failed` in worker logs with `resolution_id` and optional `request_id`; Sentry captures if `SENTRY_DSN` is set on the worker.

## APScheduler (optional process)

- **Purpose:** Interval **task reminder** scans and periodic **week-1 recovery** re-enqueues for stuck `pending` resolutions (see [backend/app/scheduler_main.py](../../backend/app/scheduler_main.py)).
- **Run:** From `backend/`: `python -m app.scheduler_main` with `SCHEDULER_ENABLED=true`, valid `DATABASE_URL`, and `REDIS_URL` (recovery enqueues RQ jobs).
- **Config:** `SCHEDULER_TIMEZONE`, `TASK_REMINDER_INTERVAL_MINUTES`, `TASK_REMINDER_LOOKAHEAD_MINUTES`, `WEEKLY_JOB_*` cron fields (see [backend/app/config.py](../../backend/app/config.py)).
- **Ops API:** When `OPS_API_KEY` is set, `POST /v1/ops/jobs/run` with header `X-Ops-Key` can run `reminders` or `week1_recover` manually without the scheduler process. Successful runs emit structured JSON logs with `message` `ops_job_run` and fields `ops_job`, `ops_processed`, `ops_detail`, and `request_id` for audit correlation.

## Mobile Android (EAS)

1. **Rollback:** In Play Console, halt rollout and promote the previous **App bundle** / track build, or ship a new build from the last known-good EAS profile (`preview` / `production` in [mobile/eas.json](../../mobile/eas.json)).
2. **OTA (EAS Update):** Only for JS/asset fixes that do not change native code or permissions (per [ADR 0009](../adr/0009-mobile-expo-eas.md)); otherwise submit a new store build.

### EAS env / secrets (preview & production)

Configure with `eas secret:create` (or project env UI). [mobile/app.config.ts](../../mobile/app.config.ts) maps these into `expo.extra` at build time:

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Backend origin (no trailing slash), e.g. `https://api.example.com` |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry React Native DSN |
| `EXPO_PUBLIC_POSTHOG_KEY` | PostHog project API key |
| `EXPO_PUBLIC_POSTHOG_HOST` | Optional; default `https://eu.i.posthog.com` |
| `EXPO_PUBLIC_SENTRY_ENVIRONMENT` | e.g. `preview`, `production` |

Use **non-production** projects for internal/preview builds per [Android release readiness](../product/android-release-readiness.md).

## Android staged rollout stabilization

Use during **production staged rollout**. Full checklist: [android-staged-rollout-checklist.md](../product/android-staged-rollout-checklist.md).

### When to pause or halt staged rollout

Do **not** increase Play rollout percentage while any of the following are true without a written risk decision:

1. **Mobile:** Crash-free sessions **drop materially** vs the previous build/release, or breach the internal threshold derived from [slo-android-v1.md](../engineering/slo-android-v1.md).
2. **API / worker:** Sustained **5xx** rate or **worker/RQ failure spike** beyond the SLO intent, or Sentry noise clearly above baseline.
3. **Product:** **Core funnel** collapse (e.g. onboarding completion or task completion) in PostHog **not** explained by cohort or campaign change.

### Rollback order (execute in order of speed)

1. **Google Play:** Halt rollout; promote the last **known-good App bundle** or previous track release (see [Mobile Android (EAS)](#mobile-android-eas) above).
2. **EAS Update:** Only for **JavaScript / asset-only** fixes that do **not** change native code or permissions ([ADR 0009](../adr/0009-mobile-expo-eas.md)). If the bug is native or permission-related, ship a **new store build**.
3. **Backend API:** Follow [Backend API rollback](#backend-api-rollback). Do not run Alembic `downgrade` in production without a decision record.

### Fix priority during rollout

| Priority | Examples |
| --- | --- |
| **P0** | Data loss; auth/security; crashes in onboarding or core task loop; broken push for **core** reminders |
| **P1** | Intervention path broken; elevated `week_1_plan_failed` / plan generation failures; UX issues with clear funnel impact |
| **P2** | Polish, non-blocking bugs — schedule after rollout is stable |

### On-call expectation (rollout window)

While staged **%** is being increased: a **named owner** monitors Sentry (mobile + API/worker) and PostHog at least daily; **primary** should be reachable for **halt/pause** decisions within the team’s SLA. Record names in [android-staged-rollout-checklist.md](../product/android-staged-rollout-checklist.md) section 4.

### Rollback / pause drill log

Complete at least **one** tabletop or real drill before declaring Android stabilization exit criteria met.

| Field | Value |
| --- | --- |
| Date | |
| Scenario (e.g. simulated crash spike, simulated 5xx) | |
| Actions taken (Play halt, bundle promote, EAS Update, API rollback) | |
| Time to mitigate (target) | |
| Gaps found | |
| Link to incident doc (if any) | |

## Observability

- **Logs:** API emits JSON lines with `request_id`, optional `user_id` (authenticated `/v1`), and optional `trace_id` when a span is active.
- **Traces (export):** Set `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` (see [backend/.env.example](../../backend/.env.example)). Use `OTEL_TRACES_SAMPLE_RATIO` (0–1) with parent-based sampling.
- **Traces (no collector):** Set `OTEL_INSTRUMENT_WITHOUT_EXPORT=true` to enable FastAPI instrumentation and in-process spans (discarded after processing) so `traceparent` is honored and `trace_id` appears in logs without an OTLP backend.

## SLO alerting (minimal)

- **API:** Sentry alerts on new issues / elevated error rate for the API project; optional log-based monitors if your host supports them.
- **Mobile:** Sentry Release Health (crash-free sessions) per [SLO doc](../engineering/slo-android-v1.md).
- **Product funnel:** PostHog insights for taxonomy events (onboarding → task → intervention).
