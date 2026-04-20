# Sarthi backend

FastAPI service implementing the frozen `/v1` contract ([docs/contracts/openapi.yaml](../docs/contracts/openapi.yaml)).

## Local development

1. Start Postgres and Redis (optional: API + RQ worker in containers):

   ```bash
   docker compose -f docker-compose.yaml up -d postgres redis
   ```

   To run the API and worker in Docker as well (after `alembic upgrade head` against the DB), copy `.env.example` to `.env`, set `JWT_SECRET`, then:

   ```bash
   docker compose -f docker-compose.yaml up -d
   ```

2. Create a virtualenv and install:

   ```bash
   pip install -e ".[dev]"
   ```

   (ADR 0005 allows `uv` + lockfile; this repo currently uses `pip` + `pyproject.toml`.)

3. Set `DATABASE_URL` and `REDIS_URL` (see [.env.example](.env.example)).

4. Run migrations:

   ```bash
   alembic upgrade head
   ```

5. API + RQ worker (two terminals):

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   python -m app.worker
   ```

   Optional third process for **scheduled** reminders / week-1 recovery (`SCHEDULER_ENABLED=true`):

   ```bash
   python -m app.scheduler_main
   ```

## Deployed environments

When **`ENVIRONMENT`** is set to `production`, `staging`, `prod`, or `preview`, the API, RQ worker, and scheduler refuse to start unless **`JWT_SECRET`** is a unique value **≥ 32 characters** (not the default from [app/config.py](app/config.py)). Unauthenticated auth routes (`/v1/auth/register`, `/login`, `/refresh`) are **rate-limited** per client IP (`AUTH_RATE_LIMIT_PER_MINUTE`, `0` disables). See [docs/operations/runbooks.md](../docs/operations/runbooks.md).

## Contract tests

`pytest` uses an **in-memory SQLite** database and an **inline RQ stub** (see [tests/conftest.py](tests/conftest.py)); you do **not** need Docker for the default suite.

```bash
pytest tests/ -v
```

For manual testing against real Postgres + Redis + a real worker, use docker compose and the steps under **Local development** above.
