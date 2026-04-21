# ADR-0004: Additive Coaching Preferences & Task Planner Metadata

Date: 2026-04-21
Status: Accepted
Deciders: Sarthi engineering team

## Context

Android v1 exposes a `CoachingPreferencesState` / `CoachingPreferencesPatchRequest` API
and a week-1 task generator (`/v1/resolutions/{id}/generate-week-1`). The mobile UI
designs require two additional round-trip fields for the **Personalize** flow and
planner-generated tasks that carry duration / time-of-day metadata so the UI can
render actionable chips without local transformations.

Both are **additive only** — no existing field is changed, renamed, or made required.
Older clients simply ignore the new fields. This is intentionally within the FROZEN v1
scope per the [change policy](../../governance/decision-record-policy.md).

## Decision

### 1. Extend `CoachingPreferencesState` and `CoachingPreferencesPatchRequest`

Add optional fields to the Pydantic schemas (and underlying `UserCoachingPreferences`
SQLAlchemy model):

| Field | Type | Description |
| --- | ---- | ----------- |
| `work_hours_start` | `string \| null` | HH:MM local time when work begins (e.g. `"09:00"`) |
| `work_hours_end` | `string \| null` | HH:MM local time when work ends (e.g. `"17:00"`) |
| `work_days` | `int[] \| null` | ISO weekday numbers 1-7; e.g. `[1,2,3,4,5]` for Mon-Fri |
| `personal_slots` | `dict<string, "morning"\|"afternoon"\|"evening"> \| null` | Per-category preferred time-of-day |

The patch endpoint accepts all four; the GET endpoint returns them. The mobile app sends
`work_hours_start`, `work_hours_end`, `work_days`, and `personal_slots` when the user
completes the **Design Your Ideal Day** Personalize screen.

### 2. Document `Task.metadata_json` reserved keys

`Task.metadata_json` is already `additionalProperties: true` in OpenAPI. This ADR formally
documents the reserved keys the planner populates, with the note that clients must
tolerate unknown keys:

| Key | Type | Description |
| --- | ---- | ----------- |
| `duration_minutes` | `number` | Estimated task duration in minutes (default 10) |
| `time_of_day` | `"morning" \| "afternoon" \| "evening"` | Preferred time block for the task |
| `category` | `string` | `"personal"` \| `"work"` \| arbitrary tag |

### 3. Week-1 planner emits `metadata_json`

The heuristic and OpenAI week-1 planners (`backend/app/services/planner/week1.py`) must
populate `metadata_json` on each created `Task` with at least `duration_minutes` and
`time_of_day`. The mobile UI renders these fields directly; the server is the source of
truth.

## Consequences

- Mobile **PersonalizeScreen** can POST `work_hours_* / work_days / personal_slots` and
  receive them back from `GET /v1/preferences`.
- Week-1 task list renders duration + time-of-day chips sourced from `Task.metadata_json`
  rather than client-side defaults.
- No breaking changes to existing API consumers. Older Android builds or non-Android
  clients ignore the new fields.
- Alembic migration `20260421_0004` adds four nullable columns to
  `user_coaching_preferences`. No data migration required (all nullable).

## References

- [v1 product scope](../../product/v1-scope.md)
- [OpenAPI contract](../../../contracts/openapi.yaml)
- [UserCoachingPreferences model](../../models/user_coaching_preferences.py)
- [week1 planner service](../../services/planner/week1.py)
