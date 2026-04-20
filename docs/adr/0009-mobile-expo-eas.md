# ADR 0009: Mobile delivery with Expo and EAS

## Status

Accepted

## Context

Program reference mandates React Native + Expo with EAS build/submit/update, Android-first.

## Decision

- Use **Expo Application Services (EAS)** for Android **internal** and **preview** tracks first; production Play uploads follow staged rollout (Internal → Closed → production staged rollout) when you reach that stage.
- **Environments:** `development`, `preview` (staging-like), `production` profiles in `eas.json`; secrets via EAS secrets, not committed.
- **OTA (EAS Update):** Allowed **only** for JavaScript/asset-only fixes that pass the same CI gates and do not change native code or permissions; feature work that touches native modules requires a new store build.

## Rationale

- Matches Android-first delivery and Expo best practices.
- OTA policy prevents “silent” native drift that breaks compliance or review expectations.

## Alternatives considered

- **Bare RN without Expo:** Rejected for v1 due to higher maintenance cost versus current repo direction.

## Android-first timeline impact

Positive: fastest path to device installs for dogfood.

## Rollback / migration

Profiles and bundle identifiers can be adjusted with a migration PR; document identifier changes for Play Console.
