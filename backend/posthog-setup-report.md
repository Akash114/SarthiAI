<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Sarthi FastAPI backend. Here is a summary of every change made:

- **`backend/pyproject.toml`** — added `posthog>=3.0.0` to project dependencies.
- **`backend/.env.example`** — documented `POSTHOG_API_KEY` and `POSTHOG_HOST` as optional environment variables.
- **`backend/.env`** — set `POSTHOG_API_KEY` and `POSTHOG_HOST` (not committed to version control).
- **`backend/app/config.py`** — added `posthog_api_key: str | None` and `posthog_host: str` to the Pydantic `Settings` class (loaded from env vars).
- **`backend/app/main.py`** — initialised a `Posthog` client in the lifespan context manager on startup (when `POSTHOG_API_KEY` is set), stored it on `app.state.posthog`, registered `shutdown` with `atexit`, and called `flush()` on lifespan shutdown.
- **`backend/app/api/v1/deps.py`** — added `get_posthog(request)` FastAPI dependency that reads `app.state.posthog`.
- **`backend/app/api/v1/auth.py`** — added `posthog` dependency to `register`, `login`, and `logout` endpoints; uses `new_context()` + `identify_context()` to capture `user signed up`, `user logged in`, and `user logged out` with the user's UUID as `distinct_id`.
- **`backend/app/api/v1/users_onboard.py`** — added `posthog` dependency to `patch_onboarding`; captures `onboarding step advanced` (with the new step name) and `onboarding completed`.
- **`backend/app/api/v1/core_routes.py`** — added `posthog` dependency to `resolutions_create`, `resolutions_patch`, `resolutions_generate_week_1`, `tasks_complete`, `interventions_approve`, and `interventions_dismiss`; captures the corresponding events with minimal, safe properties (no PII).
- **`backend/app/jobs/week1.py`** — `_run()` now returns `user_id`; `run_generate_week1` creates a short-lived `Posthog` instance after a successful job completion and captures `week 1 plan generated`, then flushes immediately.

All events use `new_context()` / `identify_context()` so that the user's UUID is the `distinct_id`, enabling frontend↔backend correlation when the mobile client also identifies with the same UUID.

## Events instrumented

| Event | Description | File |
|---|---|---|
| `user signed up` | User successfully registers a new account | `backend/app/api/v1/auth.py` |
| `user logged in` | User successfully authenticates with email and password | `backend/app/api/v1/auth.py` |
| `user logged out` | User explicitly invalidates all refresh tokens (session end) | `backend/app/api/v1/auth.py` |
| `onboarding step advanced` | User advances to a new onboarding step | `backend/app/api/v1/users_onboard.py` |
| `onboarding completed` | User marks onboarding as fully completed | `backend/app/api/v1/users_onboard.py` |
| `resolution created` | User creates a new active resolution/goal | `backend/app/api/v1/core_routes.py` |
| `resolution status updated` | User changes the status of an existing resolution | `backend/app/api/v1/core_routes.py` |
| `week 1 plan requested` | User requests AI generation of the week-1 task plan | `backend/app/api/v1/core_routes.py` |
| `task completed` | User marks a task as completed | `backend/app/api/v1/core_routes.py` |
| `intervention approved` | User approves an AI-suggested intervention check-in | `backend/app/api/v1/core_routes.py` |
| `intervention dismissed` | User dismisses an AI-suggested intervention check-in | `backend/app/api/v1/core_routes.py` |
| `week 1 plan generated` | Background worker successfully generates the week-1 task plan | `backend/app/jobs/week1.py` |

## Next steps

We've built an "Analytics basics" dashboard and five insights for you:

- **Dashboard:** https://eu.posthog.com/project/163174/dashboard/633276
- **Signup → Onboarding → Resolution funnel** — https://eu.posthog.com/project/163174/insights/2NosA9wF
- **Daily signups and logins** — https://eu.posthog.com/project/163174/insights/O7pcK0u6
- **Task completions and resolution creation** — https://eu.posthog.com/project/163174/insights/W3jLn2sP
- **Intervention approval vs dismissal** — https://eu.posthog.com/project/163174/insights/zVkLRLCM
- **User retention after signup** — https://eu.posthog.com/project/163174/insights/MKAt4COA

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-fastapi/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
