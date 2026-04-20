# ADR 0001: Background jobs with Redis + RQ

## Status

Accepted

## Context

Sarthi needs queue-backed workers for planner runs, notifications, and other asynchronous work. The program reference allows Celery or RQ with Redis.

## Decision

Use **Redis** as the broker/result backend and **RQ** for job execution, with explicit idempotency keys at the API boundary for mutations that enqueue work.

## Rationale

- **Operational simplicity:** RQ has a smaller moving surface than Celery (fewer worker modes, broker quirks, and beat/canvas patterns to reason about) for a small team.
- **Python-first:** Jobs are plain callables; aligns with FastAPI + SQLAlchemy service layer.
- **Sufficient scale for v1:** Expected queue depth and job types fit RQ; we can revisit if we need distributed chords, complex scheduling, or cross-language workers.

## Alternatives considered

- **Celery:** Strong ecosystem and patterns for complex workflows; rejected for v1 due to higher operational and cognitive overhead relative to current team size and scope.
- **In-process asyncio tasks only:** Rejected; fails reliability and observability goals from the program spec.

## Android-first timeline impact

Positive: faster path to a reliable worker loop and fewer infra footguns during Phase 2 vertical slice.

## Rollback / migration

If we outgrow RQ, introduce Celery (or another queue) behind a **job enqueue interface** in the domain layer. Redis can remain the broker for many Celery setups, reducing migration risk. Documented idempotency keys preserve correctness across worker implementations.
