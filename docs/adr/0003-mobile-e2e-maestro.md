# ADR 0003: Mobile E2E smoke tests with Maestro

## Status

Accepted

## Context

The program reference calls for Jest + RNTL plus Detox **or** Maestro for smoke flows. The vertical slice requires an E2E smoke covering onboarding → task completion → intervention.

## Decision

Use **Maestro** for mobile E2E smoke tests on Android (primary). Continue using Jest + React Native Testing Library for unit/component tests when introduced.

## Rationale

- **Expo compatibility:** Maestro drives the built app via UI without deep native test harness wiring; generally lower friction for Expo-managed projects than Detox native setup.
- **Authoring cost:** YAML flows are quick to iterate for a **single** critical smoke path in v1.
- **CI fit:** Can run on emulator/CI with documented setup alongside the slice.

## Alternatives considered

- **Detox:** Powerful gray-box E2E; rejected for v1 smoke **gate** due to heavier native toolchain and maintenance cost for this repo’s Expo-first workflow. Re-evaluate if we need deep native assertions or complex gestures not well covered by Maestro.

## Android-first timeline impact

Positive: faster time-to-first-smoke on Android.

## Rollback / migration

Smoke flows are a small asset surface; rewriting in Detox later is possible if program requirements outgrow Maestro. Keep **test IDs** stable in UI to reduce rewrite cost.
