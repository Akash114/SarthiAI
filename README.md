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
├── backend/                    # FastAPI service (scaffold when you start the API)
├── mobile/                     # Expo + React Native app
├── docs/                       # Product scope, ADRs, analytics taxonomy, API contracts
├── README.md
└── .gitignore
```

---

## Phase 1 artifacts (contracts and decisions)

| Artifact | Path |
| --- | --- |
| Android v1 scope (FROZEN) | [docs/product/v1-scope.md](docs/product/v1-scope.md) |
| Phase 2 readiness review | [docs/product/phase2-readiness-review.md](docs/product/phase2-readiness-review.md) |
| Quality gates (Phase 2 evidence) | [docs/engineering/quality-gates-v1.md](docs/engineering/quality-gates-v1.md) |
| Decision record policy (in-repo) | [docs/governance/decision-record-policy.md](docs/governance/decision-record-policy.md) |
| Architecture Decision Records | [docs/adr/README.md](docs/adr/README.md) |
| Public HTTP API (OpenAPI 3.1) | [docs/contracts/openapi.yaml](docs/contracts/openapi.yaml) |
| Analytics taxonomy (FROZEN) | [docs/analytics/taxonomy-v1.md](docs/analytics/taxonomy-v1.md) |

**Lint OpenAPI (fast, pinned CLI):** from repo root, `cd tooling/openapi && npm ci && npm run lint` (see [docs/contracts/README.md](docs/contracts/README.md)). Prefer this over repeated `npx @redocly/cli`, which downloads on each invocation and is easy to mistake for a hung terminal.

---

## Tech stack (locked for rebuild v1)

Decisions and rationale live in [docs/adr/](docs/adr/README.md). Summary:

| Layer | Choice |
| --- | --- |
| Mobile | React Native, Expo (EAS), TypeScript ([ADR 0009](docs/adr/0009-mobile-expo-eas.md)) |
| Navigation / state (target) | React Navigation; TanStack Query; Zustand; React Hook Form + Zod (per program spec; wire in Phase 2) |
| API | FastAPI, Pydantic; public contract in [docs/contracts/openapi.yaml](docs/contracts/openapi.yaml) (`/v1`) |
| Auth | JWT access + refresh ([ADR 0006](docs/adr/0006-auth-jwt-bearer.md)) |
| Data | PostgreSQL, SQLAlchemy, Alembic ([ADR 0010](docs/adr/0010-database-migrations-alembic.md)) |
| Jobs | Redis + **RQ** ([ADR 0001](docs/adr/0001-background-jobs-rq.md)); idempotency at HTTP boundary |
| Product analytics | **PostHog** ([ADR 0002](docs/adr/0002-product-analytics-posthog.md)); [taxonomy](docs/analytics/taxonomy-v1.md) |
| Error monitoring | **Sentry** ([ADR 0007](docs/adr/0007-observability-sentry.md)) |
| Tracing / logs | OpenTelemetry + structured JSON logs, minimal bootstrap ([ADR 0008](docs/adr/0008-opentelemetry-structured-logs.md)) |
| CI/CD | **GitHub Actions** ([ADR 0004](docs/adr/0004-ci-github-actions.md)) |
| Mobile E2E smoke | **Maestro** ([ADR 0003](docs/adr/0003-mobile-e2e-maestro.md)) |
| Pinning | **uv** + `uv.lock` (Python), **npm** + `package-lock.json` ([ADR 0005](docs/adr/0005-dependency-pinning.md)) |

Python **3.11+** and Node **Active LTS** are required; pin CI images when workflows land.

---

## Prerequisites

- **Node.js** (LTS) and **npm** — for Expo / React Native.
- **Python 3.11+** — for the FastAPI backend when added.
- **PostgreSQL** — for production-like local development once the backend exists.

---

## License

[MIT License](LICENSE)
