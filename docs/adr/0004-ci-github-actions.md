# ADR 0004: CI baseline with GitHub Actions

## Status

Accepted

## Context

Program reference mandates GitHub Actions with lint, typecheck, test, and build gates before broad feature development.

## Decision

Use **GitHub Actions** as the sole CI platform for SarthiAI. Minimum required workflows:

| Workflow | Purpose | When it runs |
| --- | --- | --- |
| `ci.yml` (or split per package) | Lint, typecheck, unit tests | On PR and default branch |
| Optional `mobile-build.yml` | EAS or `expo prebuild` sanity | Phase 2+ when app is buildable in CI |
| Optional `contracts.yml` | Validate OpenAPI (Spectral or `openapi-cli validate`) | On PR when spec changes |

Concrete job names and caching strategy are implementation details filled in when `backend/` and workflows land in Phase 2; this ADR locks the **platform** and **minimum gate types**.

## Rationale

- Native GitHub integration, fork/PR ergonomics, and marketplace actions for Node and Python.
- Matches program delivery expectations.

## Alternatives considered

- **GitLab CI / Buildkite / Circle:** Capable; rejected to avoid split brain and extra accounts for this repository.

## Android-first timeline impact

Neutral: CI exists for all packages; Android-specific jobs added as mobile matures.

## Rollback / migration

Exporting workflows to another provider is a mechanical copy if ever required; keep jobs **package-scoped** to reduce lock-in.
