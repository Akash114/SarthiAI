# ADR 0005: Dependency pinning policy (Python + Node)

## Status

Accepted

## Context

Reproducible builds and security review require explicit version pinning. README currently states Python 3.11+ and Node LTS without a lock policy.

## Decision

- **Python:** Minimum **3.11**. Use **`uv`** for dependency lock (`pyproject.toml` + `uv.lock`) once the backend adopts a committed lockfile. Dev dependencies grouped; production installs use locked versions only in CI and images.
- **Node / mobile:** Use **npm** with **`package-lock.json`** committed. Prefer **Active LTS** Node; the version pinned in `.github/workflows/ci.yml` is the source of truth (also summarized in the root README).
- **Infrastructure images:** Pin major.minor for Postgres and Redis in compose files; patch updates via deliberate PRs.

## Implementation status (repo)

The backend package exists under `backend/` but **does not yet ship `uv.lock`**. Local and CI installs use **`pip install -e ".[dev]"`** against `pyproject.toml` (see [backend/README.md](../../backend/README.md)). Adding `uv lock` / committing `uv.lock` is the follow-up that completes this ADR for Python.

## Rationale

- `uv` provides fast, deterministic resolves and is well suited to FastAPI services.
- npm lockfile is the default for Expo tooling in this repo today.

## Alternatives considered

- **Poetry / pip-tools:** Valid; rejected in favor of `uv` for speed and single-tool ergonomics.
- **pnpm / yarn:** Valid for Node; rejected to stay on npm default for Expo compatibility unless we hit measurable issues.

## Android-first timeline impact

Positive: fewer “works on my machine” incidents during parallel client/server work.

## Rollback / migration

Lockfile format changes (uv/poetry) require a one-time migration PR; keep semver ranges narrow for application code.
