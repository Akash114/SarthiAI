# ADR 0006: Authentication for `/v1` — JWT bearer

## Status

Accepted

## Context

OpenAPI and mobile client need a single, explicit auth model. Supporting multiple auth styles in parallel would fragment client and server implementation.

## Decision

Use **short-lived access JWTs** plus **refresh tokens** (opaque to client, server-stored or revocable) issued by the Sarthi backend after primary authentication.

- HTTP API uses `Authorization: Bearer <access_token>`.
- Refresh uses a dedicated endpoint (`POST /v1/auth/refresh` in the contract) with rotation policy decided in backend implementation (must document rotation in runbook by production).

Primary **credential** mechanism for v1: **email + password** registration and login, with room for future passwordless flows **without** changing the bearer scheme (only the token issuance path).

## Rationale

- Standard FastAPI + mobile integration patterns.
- Clear boundary for TanStack Query `401` refresh handling later.
- Avoids tying v1 to a third-party IdP contract before it is needed.

## Alternatives considered

- **OAuth-only (Google/Apple) for v1:** Reduces password handling; rejected as sole path for v1 because product still needs a backend-controlled account for coaching state without external IdP coupling on day one (can add as complement in a later version).
- **Opaque session cookie only:** Common for web; less ideal for native mobile without additional patterns.

## Android-first timeline impact

Neutral: mobile SecureStore holds refresh token; access token in memory.

## Rollback / migration

Bearer scheme remains; issuance can move behind OAuth or magic links without breaking resource routes if client refreshes correctly. Document breaking changes as `/v2` if token claims shape changes incompatibly.
