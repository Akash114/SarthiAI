# Sarthi AI

Sarthi is an AI coaching companion that helps people follow through on commitments with **supportive autonomy**: plans and nudges stay explainable, controllable, and aligned with what the user actually wants to do.

---

## Vision and principles

- **Agency first**: autonomous actions are explainable, reviewable, and user-controllable.
- **Calm reliability**: reminders, plans, and interventions behave predictably (Android-first release, then iOS).
- **Contract-first**: backend APIs and event schemas are defined before UI work expands.
- **Evidence-driven**: product changes lean on telemetry and user outcomes, not feature count alone.

---

## Target architecture

```text
┌─────────────────────────────┐       ┌─────────────────────────────┐
│  Mobile (Expo / RN + TS)    │◀─────▶│  Backend (FastAPI + Python) │
│  Android first, then iOS    │       │  REST / JSON, Postgres      │
└─────────────────────────────┘       └──────────────┬──────────────┘
                                                   │
                                    ┌──────────────┴──────────────┐
                                    │  Jobs, LLM services, etc.   │
                                    └─────────────────────────────┘
```

---

## Repository layout (broad)

```text
SarthiAI/
├── backend/                    # FastAPI `/v1` service + Alembic + RQ worker
├── mobile/                     # Expo + React Native app
├── docs/                       # Product scope, ADRs, analytics taxonomy, API contracts
├── tooling/openapi/            # Pinned Redocly CLI for linting docs/contracts/openapi.yaml
├── .github/workflows/          # CI (OpenAPI, backend pytest, mobile lint/typecheck/test)
├── redocly.yaml                # Redocly rules (referenced by tooling/openapi)
├── README.md
└── .gitignore
```

---

## Product and engineering artifacts

| Artifact | Path |
| --- | --- |
| Android v1 scope (FROZEN) | [docs/product/v1-scope.md](docs/product/v1-scope.md) |
| Contract readiness review | [docs/product/contract-readiness-review.md](docs/product/contract-readiness-review.md) |
| Quality gates (evidence bar) | [docs/engineering/quality-gates-v1.md](docs/engineering/quality-gates-v1.md) |
| Decision record policy (in-repo) | [docs/governance/decision-record-policy.md](docs/governance/decision-record-policy.md) |
| Architecture Decision Records | [docs/adr/README.md](docs/adr/README.md) |
| Public HTTP API (OpenAPI 3.1) | [docs/contracts/openapi.yaml](docs/contracts/openapi.yaml) |
| Analytics taxonomy (FROZEN) | [docs/analytics/taxonomy-v1.md](docs/analytics/taxonomy-v1.md) |

---

## Android rollout (governance)

| Artifact | Path |
| --- | --- |
| Android release readiness | [docs/product/android-release-readiness.md](docs/product/android-release-readiness.md) |
| Android staged rollout and stabilization | [docs/product/android-staged-rollout-checklist.md](docs/product/android-staged-rollout-checklist.md) |
| Operations runbooks (rollback, staged rollout pause/drill) | [docs/operations/runbooks.md](docs/operations/runbooks.md) |

**Lint OpenAPI (fast, pinned CLI):** from repo root, `cd tooling/openapi && npm ci && npm run lint` (see [docs/contracts/README.md](docs/contracts/README.md)). Prefer this over repeated `npx @redocly/cli`, which downloads on each invocation and is easy to mistake for a hung terminal.

---

## Tech stack (locked for rebuild v1)

Decisions and rationale live in [docs/adr/](docs/adr/README.md). Summary:

| Layer | Choice |
| --- | --- |
| Mobile | React Native, Expo (EAS), TypeScript ([ADR 0009](docs/adr/0009-mobile-expo-eas.md)) |
| Navigation / state | React Navigation; TanStack Query; Zustand; React Hook Form + Zod ([mobile/](mobile/)) |
| API | FastAPI, Pydantic; public contract in [docs/contracts/openapi.yaml](docs/contracts/openapi.yaml) (`/v1`) |
| Auth | JWT access + refresh ([ADR 0006](docs/adr/0006-auth-jwt-bearer.md)) |
| Data | PostgreSQL, SQLAlchemy, Alembic ([ADR 0010](docs/adr/0010-database-migrations-alembic.md)) |
| Jobs | Redis + **RQ** ([ADR 0001](docs/adr/0001-background-jobs-rq.md)); idempotency at HTTP boundary |
| Product analytics | **PostHog** ([ADR 0002](docs/adr/0002-product-analytics-posthog.md)); [taxonomy](docs/analytics/taxonomy-v1.md) |
| Error monitoring | **Sentry** ([ADR 0007](docs/adr/0007-observability-sentry.md)) |
| Tracing / logs | OpenTelemetry + structured JSON logs, minimal bootstrap ([ADR 0008](docs/adr/0008-opentelemetry-structured-logs.md)) |
| CI/CD | **GitHub Actions** ([ADR 0004](docs/adr/0004-ci-github-actions.md)) |
| Mobile E2E smoke | **Maestro** ([ADR 0003](docs/adr/0003-mobile-e2e-maestro.md)) |
| Pinning | **npm** + `package-lock.json` (mobile + `tooling/openapi`); Python **`pip`** + `pyproject.toml` today — **`uv`** + `uv.lock` per [ADR 0005](docs/adr/0005-dependency-pinning.md) when the lockfile is added |

CI pins **Python 3.11** and **Node 22** (see [.github/workflows/ci.yml](.github/workflows/ci.yml)). Match or exceed those locally.

---

## Setup

### Prerequisites

- **Node.js 22** and **npm** — Expo, React Native, and OpenAPI tooling (`tooling/openapi`).
- **Python 3.11+** — FastAPI backend ([backend/](backend/)).
- **Docker** — PostgreSQL and Redis via [backend/docker-compose.yaml](backend/docker-compose.yaml) (or install both locally and point `DATABASE_URL` / `REDIS_URL` at them).

### Third-party services and API keys

You can run the **backend tests** and much of local development **without** any vendor accounts: `pytest` uses an in-memory SQLite DB (see [backend/tests/conftest.py](backend/tests/conftest.py)). For a **full local stack** with analytics, errors, and optional AI planning, create accounts and keys as below.

| Service | What to create | Where it is used |
| --- | --- | --- |
| **[Sentry](https://sentry.io)** | Organization → **Projects**: one for the FastAPI API (and optionally a separate project for the RQ worker), and one **React Native** (or Expo) project for the mobile app. Each project has a **DSN** (public client key for the SDK). | **Backend:** `SENTRY_DSN` in [backend/.env](backend/.env) (from the API project). Optional: `SENTRY_WORKER_DSN` if the worker uses its own project. **Mobile:** `EXPO_PUBLIC_SENTRY_DSN` in `.env` or [mobile/app.json](mobile/app.json) `expo.extra` (from the mobile project’s DSN). Use distinct DSNs for server vs mobile. |
| **[PostHog](https://posthog.com)** | **Project** → **Project API key** (starts with `phc_…`). Choose **EU** or **US** cloud; the ingest host must match. | **Backend:** `POSTHOG_API_KEY`, `POSTHOG_HOST` (default `https://eu.i.posthog.com` in [backend/app/config.py](backend/app/config.py)). **Mobile:** `EXPO_PUBLIC_POSTHOG_KEY`, optional `EXPO_PUBLIC_POSTHOG_HOST`. |
| **[OpenAI](https://platform.openai.com)** (optional) | **API key** for the platform account; used when you want LLM-backed planning instead of heuristics only. | **Backend:** `OPENAI_API_KEY`, optional `OPENAI_PLANNER_MODEL` (default `gpt-4o-mini`). |
| **[Expo](https://expo.dev)** (optional) | Normal Expo / EAS workflow uses your Expo account for builds. **Expo Push** from the server optionally uses an **[access token](https://docs.expo.dev/push-notifications/sending-notifications/)** if you enable authenticated push sends. | **Backend:** `EXPO_ACCESS_TOKEN` when `NOTIFICATIONS_ENABLED=true` (see [backend/.env.example](backend/.env.example)). |

**Secrets you generate (not from a vendor):**

- **`JWT_SECRET`** — long random string (≥ 32 characters for staging/production). For local dev you can keep the placeholder in [backend/.env.example](backend/.env.example). Example: `openssl rand -hex 32`.
- **`OPS_API_KEY`** (optional) — if set, exposes `/v1/ops/*` with header `X-Ops-Key`; omit if you do not need manual job triggers.

**Optional observability:**

- **OpenTelemetry** — point `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` at your OTLP HTTP traces URL (vendor-specific; no single signup link). See [backend/.env.example](backend/.env.example) and [docs/adr/0008-opentelemetry-structured-logs.md](docs/adr/0008-opentelemetry-structured-logs.md).

**Mobile env at build time:** `EXPO_PUBLIC_*` variables are baked in by Metro / EAS. For EAS builds, use `eas secret:create` (see [docs/operations/runbooks.md](docs/operations/runbooks.md#eas-env--secrets-preview--production)). After changing `.env` locally, restart Metro with cache clear: `npx expo start --clear`.

### Backend

1. **Infra:** `docker compose -f backend/docker-compose.yaml up -d` (Postgres + Redis).
2. Copy [backend/.env.example](backend/.env.example) to `backend/.env` and set at least `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET`. Add optional keys from the table above.
3. From `backend/`: `pip install -e ".[dev]"`, then `alembic upgrade head`.
4. Run API and worker (two terminals):

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   python -m app.worker
   ```

   More detail: [backend/README.md](backend/README.md).

### Mobile

1. From [mobile/](mobile/): `npm ci`.
2. Copy [mobile/.env.example](mobile/.env.example) to `mobile/.env` if you need a custom API URL (physical device) or telemetry keys.
3. Defaults for API URL are in [mobile/src/config.ts](mobile/src/config.ts) (Android emulator → `http://10.0.2.2:8000`, iOS simulator → `http://127.0.0.1:8000`). [mobile/app.config.ts](mobile/app.config.ts) merges `EXPO_PUBLIC_*` into `expo.extra`.

### Optional

- **Maestro:** with the app running, `maestro test mobile/maestro/slice.yaml` (adjust `appId` for your build).

After the vertical slice flow reaches **Done**, use **Log out** to return to auth and register another user to exercise the full API flow again.

---

## License

[MIT License](LICENSE)
