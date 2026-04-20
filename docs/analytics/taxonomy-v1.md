# Product analytics taxonomy — v1 (FROZEN)

**Status:** FROZEN  
**Effective date:** 2026-04-20  
**Vendor:** PostHog (per [ADR 0002](../adr/0002-product-analytics-posthog.md))  
**Change policy:** Same as product scope — any event rename, semantic change, or new required PII-adjacent property requires an explicit decision record.

---

## Naming conventions

- **Event names:** `snake_case`, present tense verb phrases where possible (`onboarding_started`, not `OnboardingStarted`).
- **Properties:** `snake_case`, stable and documented below. Prefer enums over free text.
- **Versioning:** Do not embed `_v2` in event names; use taxonomy revision doc if a breaking analytics change is unavoidable.

---

## Global properties (optional on every event when applicable)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `app_version` | string | no | Semantic app version (e.g. `1.4.2`) |
| `build_channel` | string | no | `development`, `internal`, `beta`, `production` |
| `platform` | string | no | `android` (iOS later) |
| `locale` | string | no | BCP 47 tag (e.g. `en-IN`) — **no** raw locale-specific free text |
| `network_online` | boolean | no | Best-effort connectivity hint |

---

## Core funnel events (normative list)

### Onboarding

| Event | When emitted | Required properties | Optional properties |
| --- | --- | --- | --- |
| `onboarding_started` | First screen of onboarding shown after account exists | — | `entry_point` (enum: `post_registration`, `resume`) |
| `onboarding_step_viewed` | A step becomes visible | `step` (string, max 64) | `step_index` (int) |
| `onboarding_step_completed` | User completes a step | `step` | `duration_ms` (int, non-negative) |
| `onboarding_completed` | Terminal success of onboarding | — | `total_duration_ms` (int) |
| `onboarding_abandoned` | User leaves before completion (heuristic: session timeout or explicit) | `last_step` | `reason` (enum: `background`, `explicit_exit`, `unknown`) |

### Resolution

| Event | When emitted | Required properties | Optional properties |
| --- | --- | --- | --- |
| `resolution_draft_saved` | Draft text saved locally or synced | — | `char_count_title`, `char_count_detail` (ints, capped reporting buckets only) |
| `resolution_created` | Server accepted new resolution | `resolution_id` (uuid) | `had_detail` (boolean) |
| `resolution_activated` | Status becomes `active` | `resolution_id` | — |
| `resolution_completed` | User marks complete | `resolution_id` | — |
| `resolution_abandoned` | User marks abandoned | `resolution_id` | — |

### Week-1 tasks

| Event | When emitted | Required properties | Optional properties |
| --- | --- | --- | --- |
| `week_1_plan_requested` | User or system triggers generation | `resolution_id` | — |
| `week_1_plan_ready` | Tasks available to client | `resolution_id`, `task_count` (int) | — |
| `week_1_plan_failed` | Generation failed | `resolution_id` | `error_code` (string, stable, no stack traces) |
| `task_list_viewed` | Task list screen shown | `resolution_id` | `open_task_count` (int) |
| `task_completed` | User completes a task | `resolution_id`, `task_id` | `ordinal` (int, position in list) |
| `task_skipped` | User skips (if supported in product) | `resolution_id`, `task_id` | — |

### Intervention (single path)

| Event | When emitted | Required properties | Optional properties |
| --- | --- | --- | --- |
| `intervention_prompt_shown` | UI shows pending intervention | `intervention_id` | — |
| `intervention_approved` | User approves | `intervention_id` | `time_to_action_ms` (int) |
| `intervention_dismissed` | User dismisses | `intervention_id` | `time_to_action_ms` (int) |

### Notifications

| Event | When emitted | Required properties | Optional properties |
| --- | --- | --- | --- |
| `notification_permission_prompt_shown` | OS or in-app rationale shown | — | `context` (enum: `onboarding`, `settings`, `pre_reminder`) |
| `notification_permission_changed` | Result known | `granted` (boolean) | `context` |
| `push_token_registered` | Successful API registration | `platform` | — |
| `push_token_registration_failed` | API failure | `platform` | `error_code` (string) |

### Errors / stability (product-safe)

| Event | When emitted | Required properties | Optional properties |
| --- | --- | --- | --- |
| `error_boundary` | RN error boundary caught | `boundary_id` (string, stable component key) | `fatal` (boolean) |

Additional `error_boundary_*` events are **out of scope for v1** unless added via a taxonomy revision; use `error_boundary` with `boundary_id` to disambiguate surfaces.

---

## Property dictionary (shared types)

| Name | JSON type | Constraints |
| --- | --- | --- |
| `resolution_id` | string | UUID canonical lowercase |
| `task_id` | string | UUID |
| `intervention_id` | string | UUID |
| `step` | string | Max 64 chars; alphanumeric + `_` |
| `error_code` | string | Max 64 chars; from allow-list in client/server mapping — **no** raw exception messages |

---

## PII and data minimization rules

**Never send to PostHog (or attach as properties):**

- Email, name, phone, government IDs, precise address
- Raw **resolution title or detail** text (brain dump)
- Raw push tokens (log only hashed prefix server-side if needed)
- Access/refresh tokens, passwords
- Free-form user notes unless passed through a redaction pipeline (out of scope for v1 — **do not**)

**Allowed identifiers:**

- Opaque UUIDs (`resolution_id`, `task_id`, `intervention_id`) for correlation within analytics only; treat as sensitive in exports.

**Coarse metrics instead of raw text:**

- Use `char_count_*` buckets (e.g. `0`, `1-50`, `51-200`, `201+`) if length telemetry is needed — not exact counts of highly sensitive content if product considers that identifying at low lengths.

---

## Sampling and experimentation

- **Default:** No client-side sampling for core funnel events in v1.
- **Performance:** High-frequency debug events are **out of scope** for v1 taxonomy; use engineering logs/Sentry instead.
- **Experiments:** If introduced, gate with explicit `experiment_key` + `variant` properties and an ADR; do not repurpose existing event names.

---

## Consent and notification linkage

- `notification_permission_*` events must reflect **OS-level** permission state, not inferred from API alone.
- Marketing or non-coaching pushes are **out of scope** for v1; all notification analytics assume **transactional coaching** context only.

---

## Taxonomy checklist (for instrumentation PRs)

- [ ] Event name matches table exactly (no drift).
- [ ] Required properties present; enums respected.
- [ ] No forbidden PII fields.
- [ ] UUIDs only from server-issued entities (no client-generated fake IDs logged as real).
