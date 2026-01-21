"""LLM-driven weekly planner (Rolling Wave) service."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import date, timedelta, time
from typing import Dict, List, Tuple
from uuid import UUID

import openai
from sqlalchemy.orm import Session

from app.api.schemas.weekly_plan import MicroResolutionPayload, SuggestedTaskPayload, WeeklyPlanInputs
from app.db.models.agent_action_log import AgentActionLog
from app.db.models.user import User
from app.db.models.resolution import Resolution
from app.db.models.task import Task


@dataclass
class WeeklyPlanPreview:
    week: Tuple[date, date]
    inputs: WeeklyPlanInputs
    micro_resolution: MicroResolutionPayload


@dataclass
class SnapshotResult:
    log: AgentActionLog
    created: bool


def get_weekly_plan_preview(db: Session, user_id: UUID) -> WeeklyPlanPreview:
    """Return a preview of the upcoming week using the LLM-driven planner."""
    week_start, week_end = _upcoming_week_window()
    micro_resolution, inputs = generate_weekly_plan(db, user_id)
    return WeeklyPlanPreview(
        week=(week_start, week_end),
        inputs=inputs,
        micro_resolution=micro_resolution,
    )


def persist_weekly_plan_preview(
    db: Session,
    *,
    user_id: UUID,
    preview: WeeklyPlanPreview | None,
    request_id: str | None,
    force: bool = False,
) -> SnapshotResult:
    """
    Backwards-compatible adapter that persists a snapshot using the Rolling Wave planner.

    The preview argument is ignored because run_weekly_planning_for_user now regenerates the plan
    when persisting to keep the snapshot + generated tasks in sync.
    """
    log = run_weekly_planning_for_user(db, user_id=user_id, force=force, request_id=request_id)
    created = bool(getattr(log, "_rolling_wave_created", True))
    return SnapshotResult(log=log, created=created)


def load_latest_weekly_plan(db: Session, user_id: UUID) -> AgentActionLog | None:
    """Fetch the latest stored weekly plan snapshot for a user."""
    return (
        db.query(AgentActionLog)
        .filter(
            AgentActionLog.user_id == user_id,
            AgentActionLog.action_type == "weekly_plan_generated",
        )
        .order_by(AgentActionLog.created_at.desc())
        .first()
    )


def generate_weekly_plan(db: Session, user_id: UUID) -> Tuple[MicroResolutionPayload, WeeklyPlanInputs]:
    """
    Call the Rolling Wave planner to produce a micro-resolution and suggested tasks.

    Returns both the micro plan and the contextual WeeklyPlanInputs used by response payloads.
    """
    stats = _collect_weekly_stats(db, user_id)
    context_summary = _gather_user_context(db, user_id, stats)
    micro_resolution = _request_plan_from_llm(context_summary)

    inputs = WeeklyPlanInputs(
        active_resolutions=stats["active_resolutions"],
        active_tasks_total=stats["total_tasks"],
        active_tasks_completed=stats["completed_tasks"],
        completion_rate=stats["completion_rate"],
    )
    return micro_resolution, inputs


def run_weekly_planning_for_user(
    db: Session,
    user_id: UUID,
    *,
    force: bool = False,
    request_id: str | None = None,
) -> AgentActionLog:
    """
    Execute the Rolling Wave planner, persist the snapshot, and create active tasks.

    Deduplicates by week unless force=True. Returns the AgentActionLog that was reused/created.
    """
    user = db.get(User, user_id)
    if not user:
        raise ValueError("User not found")

    week_start, week_end = _upcoming_week_window()
    week_start_iso = week_start.isoformat()
    week_end_iso = week_end.isoformat()

    if not force:
        existing = _find_existing_snapshot(
            db,
            user_id=user_id,
            action_type="weekly_plan_generated",
            week_start=week_start_iso,
            week_end=week_end_iso,
        )
        if existing:
            setattr(existing, "_rolling_wave_created", False)
            return existing

    micro_resolution, inputs = generate_weekly_plan(db, user_id)
    created_tasks = _materialize_tasks_from_plan(db, user_id, micro_resolution, week_start)

    payload = {
        "user_id": str(user_id),
        "week_start": week_start_iso,
        "week_end": week_end_iso,
        "week": {
            "start": week_start_iso,
            "end": week_end_iso,
        },
        "inputs": inputs.model_dump(),
        "micro_resolution": micro_resolution.model_dump(),
        "created_task_ids": [str(task.id) for task in created_tasks],
        "request_id": request_id or "",
    }

    log = AgentActionLog(
        user_id=user_id,
        action_type="weekly_plan_generated",
        action_payload=payload,
        reason="Rolling Wave weekly plan generated",
        undo_available=True,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    setattr(log, "_rolling_wave_created", True)
    return log


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _gather_user_context(db: Session, user_id: UUID, stats: Dict[str, float | int | List[str]] | None = None) -> str:
    """
    Build a natural-language summary of the user's recent performance.

    Example: "User has 2 active goals. Last week completion: 85%. Notes: 'Felt tired on Tuesday'."
    """
    stats = stats or _collect_weekly_stats(db, user_id)
    completion_pct = round(stats["completion_rate"] * 100)
    notes = stats["notes"]
    if notes:
        quoted = "; ".join(f"'{note}'" for note in notes[:3])
        notes_fragment = f"Notes: {quoted}."
    else:
        notes_fragment = "Notes: none recorded."

    return f"User has {stats['active_resolutions']} active goals. Last week completion: {completion_pct}%. {notes_fragment}"


def _collect_weekly_stats(db: Session, user_id: UUID) -> Dict[str, float | int | List[str]]:
    """Return counts/notes for the trailing seven-day window."""
    today = date.today()
    window_start = today - timedelta(days=6)

    active_resolutions = (
        db.query(Resolution)
        .filter(Resolution.user_id == user_id, Resolution.status == "active")
        .all()
    )
    scheduled_tasks = (
        db.query(Task)
        .filter(
            Task.user_id == user_id,
            Task.scheduled_day.isnot(None),
            Task.scheduled_day >= window_start,
            Task.scheduled_day <= today,
        )
        .all()
    )

    notes: List[str] = []
    total_tasks = 0
    completed_tasks = 0
    for task in scheduled_tasks:
        metadata = task.metadata_json or {}
        if metadata.get("draft"):
            continue
        total_tasks += 1
        if (
            task.completed
            and task.completed_at
            and window_start <= task.completed_at.date() <= today
        ):
            completed_tasks += 1
        note = metadata.get("note")
        if isinstance(note, str) and note.strip():
            notes.append(note.strip())

    completion_rate = round((completed_tasks / total_tasks), 2) if total_tasks else 0.0

    return {
        "active_resolutions": len(active_resolutions),
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "completion_rate": completion_rate,
        "notes": notes,
    }


def _request_plan_from_llm(context_summary: str) -> MicroResolutionPayload:
    """Call OpenAI with the specified prompts or fall back safely."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return _fallback_micro_resolution()

    client = openai.OpenAI(api_key=api_key)
    system_prompt = (
        "You are Sarthi AI, a strategic coach. Review the user's last week and design the next. "
        "If they struggled (<50%), simplify and focus on consistency. "
        "If they crushed it (>80%), gently increase intensity or variety."
    )
    user_prompt = (
        f"Context: {context_summary}\n"
        "Generate a 'Micro-Resolution' JSON object with keys 'title', 'why_this', "
        "and 'suggested_week_1_tasks'. Include 3-5 specific tasks for the upcoming week. "
        "Each task must contain 'title', 'duration_min' (integer minutes), "
        "and 'suggested_time' (morning, afternoon, or evening)."
    )

    try:
        completion = client.chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            temperature=0.6,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        content = completion.choices[0].message.content or "{}"
        payload = json.loads(content)
        micro = MicroResolutionPayload.model_validate(payload)
        return _ensure_task_bounds(micro)
    except Exception:
        return _fallback_micro_resolution()


def _fallback_micro_resolution() -> MicroResolutionPayload:
    """Deterministic fallback when the LLM call fails."""
    return MicroResolutionPayload(
        title="Reset Week",
        why_this="Lighten the load, rebuild confidence, and carry momentum into the following week.",
        suggested_week_1_tasks=[
            SuggestedTaskPayload(title="Schedule three 30-min focus blocks", duration_min=30, suggested_time="morning"),
            SuggestedTaskPayload(title="One midweek reflection note", duration_min=10, suggested_time="evening"),
            SuggestedTaskPayload(title="Weekend reset + planning ritual", duration_min=25, suggested_time="afternoon"),
        ],
    )


def _ensure_task_bounds(micro: MicroResolutionPayload) -> MicroResolutionPayload:
    """Clamp task count to 3-5 entries, padding with fallback tasks if needed."""
    tasks = list(micro.suggested_week_1_tasks or [])
    fallback_tasks = _fallback_micro_resolution().suggested_week_1_tasks
    idx = 0
    while len(tasks) < 3 and idx < len(fallback_tasks):
        tasks.append(fallback_tasks[idx])
        idx += 1
    if len(tasks) > 5:
        tasks = tasks[:5]

    return MicroResolutionPayload(
        title=micro.title or "Momentum Week",
        why_this=micro.why_this or "Keep the cadence gentle while sustaining visible progress.",
        suggested_week_1_tasks=tasks,
    )


def _materialize_tasks_from_plan(
    db: Session,
    user_id: UUID,
    micro_resolution: MicroResolutionPayload,
    week_start: date,
) -> List[Task]:
    """Create concrete Task rows from the suggested payload."""
    created: List[Task] = []
    suggestions = micro_resolution.suggested_week_1_tasks or []
    for index, suggestion in enumerate(suggestions):
        scheduled_day = week_start + timedelta(days=index % 7)
        scheduled_time = _map_suggested_time(suggestion.suggested_time)
        metadata = {
            "draft": False,
            "source": "rolling_wave",
            "micro_resolution_title": micro_resolution.title,
            "suggested_time": suggestion.suggested_time,
        }
        task = Task(
            user_id=user_id,
            resolution_id=None,
            title=suggestion.title,
            duration_min=suggestion.duration_min,
            scheduled_day=scheduled_day,
            scheduled_time=scheduled_time,
            metadata_json=metadata,
            completed=False,
            completed_at=None,
        )
        db.add(task)
        created.append(task)

    db.flush()
    return created


def _map_suggested_time(label: str | None) -> time | None:
    """Translate coarse labels to representative times."""
    if not label:
        return None
    label = label.lower()
    if label == "morning":
        return time(hour=9, minute=0)
    if label == "afternoon":
        return time(hour=13, minute=0)
    if label == "evening":
        return time(hour=19, minute=0)
    return None


def _upcoming_week_window(base: date | None = None) -> Tuple[date, date]:
    """Return the next Monday-start week window."""
    today = base or date.today()
    days_until_monday = (7 - today.weekday()) % 7 or 7
    week_start = today + timedelta(days=days_until_monday)
    return week_start, week_start + timedelta(days=6)


def _find_existing_snapshot(
    db: Session,
    *,
    user_id: UUID,
    action_type: str,
    week_start: str,
    week_end: str,
) -> AgentActionLog | None:
    logs = (
        db.query(AgentActionLog)
        .filter(AgentActionLog.user_id == user_id, AgentActionLog.action_type == action_type)
        .order_by(AgentActionLog.created_at.desc())
        .limit(100)
        .all()
    )
    for log in logs:
        payload = log.action_payload or {}
        if payload.get("week_start") == week_start and payload.get("week_end") == week_end:
            return log
    return None
