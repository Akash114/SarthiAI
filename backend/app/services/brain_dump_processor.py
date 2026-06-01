from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.models.brain_dump import BrainDump
from app.models.brain_dump_proposal import BrainDumpProposal
from app.services.companion_context import build_companion_context
from app.services.llm_client import create_glm_client, glm_configured

logger = logging.getLogger(__name__)


class ProposalPayload(BaseModel):
    change_type: str
    target_type: str
    target_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    rationale: str | None = None
    confidence: float | None = Field(None, ge=0.0, le=1.0)


class BrainDumpPlan(BaseModel):
    acknowledgement: str
    proposals: list[ProposalPayload] = Field(default_factory=list)


@dataclass(frozen=True)
class ProcessedBrainDump:
    acknowledgement: str
    proposals: list[ProposalPayload]
    source: str


def _first_active_task(context: dict[str, Any]) -> dict[str, Any] | None:
    active = context.get("active_task")
    if isinstance(active, dict):
        return active
    tasks = context.get("open_tasks")
    if isinstance(tasks, list):
        return next((task for task in tasks if isinstance(task, dict)), None)
    return None


def _heuristic_plan(text: str, context: dict[str, Any]) -> BrainDumpPlan:
    lower = text.lower()
    proposals: list[ProposalPayload] = []
    active_task = _first_active_task(context)
    active_goal = context.get("active_goal") if isinstance(context.get("active_goal"), dict) else None

    if "split" in lower and active_task is not None:
        target_id = active_task.get("id")
        old_notes = active_task.get("notes") or ""
        proposals.append(
            ProposalPayload(
                change_type="update_task",
                target_type="task",
                target_id=target_id,
                payload={
                    "notes": (old_notes + "\n\nCompanion update: " + text).strip(),
                    "metadata_json": {"split_from_brain_dump": True},
                },
                rationale="The dump changes the scope of the current task.",
                confidence=0.82,
            )
        )
        title = "Prepare follow-up presentation"
        if "presentation" in lower:
            title = "Prepare second presentation"
        proposals.append(
            ProposalPayload(
                change_type="create_task",
                target_type="task",
                payload={
                    "title": title,
                    "notes": text,
                    "goal_id": active_task.get("goal_id") or (active_goal or {}).get("id"),
                    "team_id": active_task.get("team_id") or (active_goal or {}).get("team_id"),
                    "priority": "normal",
                    "source": "brain_dump",
                },
                rationale="The dump creates a second distinct deliverable.",
                confidence=0.8,
            )
        )

    if not ("split" in lower and active_task is not None):
        for match in re.finditer(r"(?:need to|should|have to|remember to)\s+([^.\n!]{5,140})", text, re.IGNORECASE):
            title = match.group(1).strip()
            if title:
                proposals.append(
                    ProposalPayload(
                        change_type="create_task",
                        target_type="task",
                        payload={
                            "title": title[:500],
                            "goal_id": (active_goal or {}).get("id"),
                            "team_id": (active_goal or {}).get("team_id"),
                            "source": "brain_dump",
                        },
                        rationale="The dump contains a direct action.",
                        confidence=0.7,
                    )
                )
            if len(proposals) >= 5:
                break

    if not proposals and any(word in lower for word in ("goal", "someday", "future", "long term")):
        proposals.append(
            ProposalPayload(
                change_type="create_goal",
                target_type="goal",
                payload={"title": text.strip()[:120], "description": text.strip()},
                rationale="The dump reads like a longer-term direction rather than a one-off task.",
                confidence=0.58,
            )
        )

    return BrainDumpPlan(
        acknowledgement="Captured. I found changes you may want to make." if proposals else "Captured for context.",
        proposals=proposals,
    )


def _glm_plan(settings: Settings, text: str, context: dict[str, Any]) -> BrainDumpPlan | None:
    if not glm_configured(settings):
        return None
    try:
        client = create_glm_client(settings)
    except RuntimeError:
        return None
    system = (
        "You are Sarthi, an AI companion for high-output people. "
        "Given a brain dump and user context, return JSON with acknowledgement and proposals. "
        "Each proposal must include change_type, target_type, optional target_id, payload, rationale, confidence. "
        "Allowed change_type values: create_goal, update_goal, create_task, update_task. "
        "Use IDs from context when updating. Prefer a small number of precise proposals."
    )
    user = f"Context JSON:\n{json.dumps(context)[:12000]}\n\nBrain dump:\n{text[:12000]}"
    try:
        completion = client.chat.completions.create(
            model=settings.glm_model,
            temperature=0.2,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            response_format={"type": "json_object"},
        )
        raw = (completion.choices[0].message.content or "{}").strip()
        return BrainDumpPlan.model_validate_json(raw)
    except Exception:
        logger.exception("brain_dump_glm_plan_failed")
        return None


def process_brain_dump(db: Session, dump: BrainDump, settings: Settings | None = None) -> ProcessedBrainDump:
    settings = settings or get_settings()
    context = build_companion_context(
        db,
        user_id=dump.user_id,
        focus_session_id=dump.focus_session_id,
        task_id=dump.active_task_id,
        goal_id=dump.active_goal_id,
        team_id=dump.team_id,
    )
    glm_plan = _glm_plan(settings, dump.body, context)
    source = "glm" if glm_plan is not None else "heuristic"
    plan = glm_plan or _heuristic_plan(dump.body, context)
    return ProcessedBrainDump(
        acknowledgement=plan.acknowledgement,
        proposals=plan.proposals,
        source=source,
    )


def persist_processed_brain_dump(db: Session, dump: BrainDump, result: ProcessedBrainDump, context: dict[str, Any]) -> None:
    dump.context_snapshot_json = context
    dump.ai_result_json = {
        "acknowledgement": result.acknowledgement,
        "source": result.source,
        "proposal_count": len(result.proposals),
    }
    dump.signals_extracted = dump.ai_result_json
    dump.actionable = bool(result.proposals)
    dump.processing_status = "processed"
    from datetime import UTC, datetime

    dump.processed_at = datetime.now(UTC)
    for item in result.proposals:
        target_id = None
        if item.target_id:
            try:
                target_id = UUID(item.target_id)
            except ValueError:
                target_id = None
        db.add(
            BrainDumpProposal(
                brain_dump_id=dump.id,
                change_type=item.change_type,
                target_type=item.target_type,
                target_id=target_id,
                payload_json=item.payload,
                rationale=item.rationale,
                confidence=item.confidence,
                status="pending",
            )
        )
