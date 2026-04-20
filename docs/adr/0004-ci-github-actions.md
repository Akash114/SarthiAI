# ADR 0004: CI baseline with GitHub Actions

## Status

Accepted

## Context

Program reference mandates GitHub Actions with lint, typecheck, test, and build gates before broad feature development.

## Decision

Use **GitHub Actions** as the sole CI platform for SarthiAI. Minimum required workflows:

| Workflow | Purpose | When it runs |
| --- | --- | --- |
| [`ci.yml`](../../.github/workflows/ci.yml) | **OpenAPI:** Redocly lint via `tooling/openapi` · **Backend:** `pip install -e ".[dev]"`, `pytest` · **Mobile:** `npm ci`, `typecheck`, `lint`, `test` | Pull requests and pushes to `main` |
| [`openapi.yml`](../../.github/workflows/openapi.yml) | Same OpenAPI Redocly lint (path-filtered) | Push/PR when `docs/contracts/openapi.yaml`, `redocly.yaml`, or `tooling/openapi/` change |
| [`maestro.yml`](../../.github/workflows/maestro.yml) | Manual dispatch only; echoes how to run Maestro locally | `workflow_dispatch` |

Optional later: `mobile-build.yml` (EAS or `expo prebuild` sanity) when builds should run on every PR.

This ADR locks the **platform** and **minimum gate types**; the table above reflects the workflows that exist in-repo today.

## Rationale

- Native GitHub integration, fork/PR ergonomics, and marketplace actions for Node and Python.
- Matches program delivery expectations.

## Alternatives considered

- **GitLab CI / Buildkite / Circle:** Capable; rejected to avoid split brain and extra accounts for this repository.

## Android-first timeline impact

Neutral: CI exists for all packages; Android-specific jobs added as mobile matures.

## Rollback / migration

Exporting workflows to another provider is a mechanical copy if ever required; keep jobs **package-scoped** to reduce lock-in.
