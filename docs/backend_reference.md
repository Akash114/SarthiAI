# Sarthi AI Backend Reference

This document summarizes the backend architecture described in the README plus the current FastAPI implementation under `backend/app`. Use it as a quick onboarding reference for schemas, endpoints, and background workers.

## Application Initialization

- `app/main.py` wires up the FastAPI application with routers for every domain (brain dumps, resolutions, weekly plans, interventions, jobs, preferences, notifications, agent logs, tasks, dashboard).
- Logging is centralized via `app/core/logging.configure_logging`, which injects a request ID into every log line and respects `LOG_LEVEL`.
- `RequestIDMiddleware` (`app/core/middleware.py`) ensures every request carries/returns an `X-Request-Id` header and stores it on `request.state` plus a context var for log filters and tracing.
- Environment-driven configuration lives in `app/core/config.py` (`Settings`), which loads `.env` by default. Key toggles include database URL, Opik tracing, scheduler controls, and notification flags.
- Observability hooks (`app/observability/*`) initialize the optional Opik client at startup, expose a `trace` context manager used throughout the routes/services, and wrap metric logging so endpoints remain no-ops when Opik is disabled.

## Database Schema (SQLAlchemy Models)

| Table | Key Columns |
| --- | --- |
| `users` (`app/db/models/user.py`) | `id` (UUID PK), `created_at`. |
| `brain_dumps` (`app/db/models/brain_dump.py`) | `id`, FK `user_id`, `text`, `signals_extracted` (JSONB), `actionable`, `user_accepted_help`, timestamps. |
| `resolutions` (`app/db/models/resolution.py`) | `id`, `user_id`, `title`, `type`, `duration_weeks`, `status`, `metadata_json` storing raw intake text + plan metadata, timestamps. |
| `tasks` (`app/db/models/task.py`) | `id`, `user_id`, optional `resolution_id`, scheduling metadata, `completed`, `metadata_json` (tracks `draft`/`source`/notes), timestamps. |
| `user_preferences` (`app/db/models/user_preferences.py`) | PK `user_id`, booleans for `coaching_paused`, `weekly_plans_enabled`, `interventions_enabled`, `updated_at`. |
| `agent_actions_log` (`app/db/models/agent_action_log.py`) | `id`, `user_id`, `action_type`, `action_payload` (JSONB), `reason`, `undo_available`, `undone_at`, timestamps. |

The SQLAlchemy engine/session is configured in `app/db/session.py` using `settings.database_url`. FastAPI dependencies expose sessions via `app/db/deps.py:get_db`.

## Core Services

- **User bootstrap** (`app/services/user_service.py`): `get_or_create_user` ensures UUIDs exist before writing dependent rows.
- **Resolution intake/decomposition/approval** (`app/services/resolution_*`): deterministic heuristics normalize free text, expand 4–12 week plans, generate week-one draft tasks, and activate them after approval (marking `Task.metadata_json["draft"]=False`).
- **Weekly planner** (`app/services/weekly_planner.py`): synthesizes next-week previews from active resolutions and tasks, persists snapshots as `AgentActionLog` entries (type `weekly_plan_generated`), and supports preview/run/history endpoints plus scheduler jobs.
- **Intervention service** (`app/services/intervention_service.py`): inspects last-week task performance for “slippage”, builds intervention cards when thresholds are missed, and stores snapshots via `AgentActionLog`.
- **Job runners & scheduler** (`app/services/job_runner.py`, `app/worker/scheduler_main.py`): orchestrate weekly plan + intervention generation across all users, respecting `UserPreferences` (skip when paused) and emitting metrics/logs.
- **Notifications** (`app/services/notifications/*`): currently a `noop` provider. Hooks automatically enqueue action-log entries whenever weekly-plan/intervention snapshots are stored and preferences + flags allow notifications.
- **Preferences** (`app/services/preferences_service.py`): ensures default rows exist and records preference changes in `AgentActionLog`.
- **Dashboard/Tasks/Brain-dump helpers** (`app/services/dashboard_service.py`, `resolution_tasks.py`, `brain_dump_extractor.py`) provide aggregation logic for their respective routers.

## Pydantic Schemas (Inputs/Outputs)

Located under `app/api/schemas/`, grouped by domain:

- `brain_dump.py`: `BrainDumpRequest`, `BrainDumpSignals`, `BrainDumpResponse`.
- `resolution.py`, `decomposition.py`, `approval.py`: request/response payloads for intake, decomposition, and approval plus nested `PlanPayload`, `DraftTaskPayload`, `ApprovedTaskPayload`.
- `task.py`: `TaskSummary`, update/edit requests plus note helpers.
- `weekly_plan.py`, `interventions.py`: preview/run/history payloads for scheduler artefacts.
- `dashboard.py`, `preferences.py`, `jobs.py`, `agent_log.py`: supporting DTOs for dashboards, preference toggles, job ops, and transparency feeds.

These schemas are referenced directly in the FastAPI routes to enforce validation and generate OpenAPI documentation automatically.

## HTTP Endpoint Catalog

All paths are rooted at `/` (no version prefix). Every response includes `request_id` for traceability.

### Health & Ops
- `GET /health`: readiness probe, traces `http.health_check`.
- `GET /jobs`: exposes scheduler flags, cron window, and available job IDs.
- `POST /jobs/run-now`: debug-only manual execution (`weekly_plan` or `interventions`), optionally for a specific user, returns processing counts.
- `GET /notifications/config`: returns `enabled` + provider.

### Brain Dump
- `POST /brain-dump`: accepts `BrainDumpRequest`, extracts heuristics via `brain_dump_extractor`, stores `BrainDump` + agent log entry, returns signals + acknowledgement.

### Resolutions Lifecycle
- `POST /resolutions`: intake free text, auto-creates `User`, stores `Resolution` in `draft`.
- `GET /resolutions`: list summaries filtered by user/status.
- `GET /resolutions/{id}`: returns detail, including stored plan metadata plus either draft or active tasks via `resolution_tasks`.
- `POST /resolutions/{id}/decompose`: generates or reuses plan payload + week-one `Task` drafts; `regenerate=true` deletes existing drafts first.
- `POST /resolutions/{id}/approve`: decisions = `accept` (activates tasks, transitions to `active`), `reject` (keeps draft), or `regenerate` (prompts another decomposition run). Approved tasks are persisted from metadata and become active tasks.

### Tasks & Notes
- `GET /tasks`: filter by `status=active|draft|all` and optional date window; sorts by scheduled day/time.
- `GET /tasks/{task_id}`: fetch single task (ownership enforced).
- `PATCH /tasks/{task_id}`: toggle completion state; logs agent action.
- `PATCH /tasks/{task_id}/note`: set/clear trimmed notes (<=500 chars) stored in `Task.metadata_json`.
- `PATCH /tasks/{task_id}/edit`: mutation endpoint that can adjust title, scheduled fields, completion, note.

### Dashboard
- `GET /dashboard`: aggregates active resolutions, stats, and recent activity for a user.

### Weekly Plan Snapshots
- `GET /weekly-plan/preview`: returns synthetic next-week plan (not persisted).
- `POST /weekly-plan/run`: persists snapshot unless one already exists for the same week unless `force=true`; triggers notification hook when a new log is created.
- `GET /weekly-plan/latest`: fetch latest stored snapshot (404 when absent).
- `GET /weekly-plan/history`: list recent `weekly_plan_generated` logs (limit 1–100).
- `GET /weekly-plan/history/{log_id}`: return a stored snapshot payload.

### Intervention Snapshots
- `GET /interventions/preview`: returns current-week slippage summary, plus recommended card when flagged.
- `POST /interventions/run`: persists snapshot (same semantics as weekly plan run + notifications).
- `GET /interventions/latest`, `/history`, `/history/{log_id}` mirror the weekly plan endpoints but target `intervention_generated` logs.

### Preferences & Transparency
- `GET /preferences`, `PATCH /preferences`: manage `UserPreferences`. Updates record agent log entries with the changed fields.
- `GET /agent-log`: cursor-paginated list (50 default) of `AgentActionLog` entries with optional `action_type` filtering. Cursor is a base64-encoded `created_at|id`. Summaries are derived per action.
- `GET /agent-log/{log_id}`: fetch detailed payload for a specific log entry.

## Background Worker & Scheduler

- Launch via `python -m app.worker.scheduler_main`. It validates cron configuration (`WEEKLY_JOB_*` env vars) and uses APScheduler to schedule weekly jobs.
- When `SCHEDULER_ENABLED=false`, the worker logs a warning and exits.
- Jobs call `run_weekly_plan_for_all_users` / `run_interventions_for_all_users`, which filter eligible users based on `UserPreferences` and log metrics (`jobs.*`). `jobs_run_on_startup=true` runs both jobs immediately when the worker boots.
- The worker (and `jobs.run-now` API) reuse the same preview/persist services, ensuring identical payloads whether invoked via automation or HTTP.

## Notifications & Preferences Enforcement

- Global flags: `NOTIFICATIONS_ENABLED`, `NOTIFICATIONS_PROVIDER` (default `noop`).
- Hooks (`app/services/notifications/hooks.py`) fire after snapshots are persisted. They re-check `UserPreferences` to avoid notifying paused users, and interventions only send notifications when slippage is flagged.
- Each notification attempt (sent or skipped) creates an `AgentActionLog` entry so the transparency feed exposes what happened and why.

## Request/Trace Context

- Request IDs are set by middleware, surfaced in responses, logged, and stored in agent action payloads (where available) so Ops can correlate UI/API activity with scheduler events.
- Every route/service uses the shared `trace` helper to wrap significant operations (`resolution.intake`, `task.note`, `weekly_plan.preview`, etc.), making Opik traces/metrics consistent across domains.
