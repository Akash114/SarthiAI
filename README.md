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
├── mobile/                     # Expo + React Native app (create with commands below)
├── docs/                       # Optional: ADRs, runbooks (add as needed)
├── README.md
└── .gitignore
```

---

## Tech stack (target)

| Layer | Choice |
| --- | --- |
| Mobile | React Native, Expo (EAS), TypeScript |
| API | FastAPI, Pydantic, versioned `/v1` contracts |
| Data | PostgreSQL, SQLAlchemy, Alembic |
| Client state / server cache | Zustand, TanStack Query (conventions TBD in `mobile/`) |
| Jobs / background work | Queue-backed workers and explicit idempotency (details in backend) |
| Observability | Structured logs, error tracking (e.g. Sentry), traces as the stack matures |

Exact versions and packages should be pinned when `backend/` and `mobile/` are initialized.

---

## Prerequisites

- **Node.js** (LTS) and **npm** — for Expo / React Native.
- **Python 3.11+** — for the FastAPI backend when added.
- **PostgreSQL** — for production-like local development once the backend exists.

---

## License

[MIT License](LICENSE)
