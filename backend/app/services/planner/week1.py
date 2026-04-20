"""Generate week-1 actionable tasks from resolution context.

Uses a deterministic heuristic pipeline by default; optionally calls OpenAI when
``openai_api_key`` is configured.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any

from app.config import Settings

logger = logging.getLogger(__name__)

PLANNER_VERSION_HEURISTIC = "heuristic_v1"
PLANNER_VERSION_OPENAI = "openai_json_v1"


@dataclass(frozen=True)
class Week1PlanResult:
    """Structured planner output for persistence and transparency."""

    planner_version: str
    task_titles: list[str]
    source: str
    raw_model_response: str | None = None


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _heuristic_tasks(title: str, detail: str | None) -> list[str]:
    """Build 3–5 concrete tasks from resolution title/detail without an LLM."""
    base = _normalize_whitespace(title)
    ctx = _normalize_whitespace(detail or "")
    combined = f"{base} {ctx}".lower()

    tasks: list[str] = [
        f"Write one sentence: why “{base[:80]}” matters to you this week",
        f"Block 25–30 minutes on your calendar for the first step toward: {base[:100]}",
        f"Define a smallest measurable outcome for this week related to: {base[:100]}",
    ]

    if any(k in combined for k in ("run", "5k", "marathon", "fitness", "gym", "workout", "train")):
        tasks.append("Do one short easy session (walk or warmup) and note how you feel")
    if any(k in combined for k in ("read", "book", "study", "learn", "course")):
        tasks.append("Read or study for 20 minutes and jot one takeaway")
    if any(k in combined for k in ("save", "money", "budget", "debt")):
        tasks.append("Review spending for the last 7 days and pick one cut or cap")
    if any(k in combined for k in ("job", "career", "interview", "resume")):
        tasks.append("Update one resume bullet or send one networking message")

    # Cap at 5 tasks, dedupe preserving order
    seen: set[str] = set()
    out: list[str] = []
    for t in tasks:
        t = t.strip()
        if not t or t in seen:
            continue
        seen.add(t)
        out.append(t[:500])
        if len(out) >= 5:
            break
    return out


def _openai_task_titles(settings: Settings, title: str, detail: str | None) -> tuple[list[str], str] | None:
    api_key = settings.openai_api_key
    if not api_key:
        return None
    try:
        from openai import OpenAI
    except ImportError:
        logger.warning("openai package not installed; falling back to heuristic planner")
        return None

    client = OpenAI(api_key=api_key)
    system = (
        "You are a planning assistant. Return ONLY valid JSON: "
        '{"tasks": ["string", ...]} with 3 to 5 short actionable tasks for WEEK 1 only. '
        "Tasks must be specific, achievable in 7 days, and tied to the user's resolution."
    )
    user = f"Resolution title: {title}\n"
    if detail:
        user += f"Details: {detail}\n"
    user += "Respond with JSON only."

    try:
        completion = client.chat.completions.create(
            model=settings.openai_planner_model,
            temperature=0.4,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        raw = (completion.choices[0].message.content or "").strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw).strip()
        data: dict[str, Any] = json.loads(raw)
        items = data.get("tasks")
        if not isinstance(items, list):
            return None
        titles: list[str] = []
        for item in items:
            if isinstance(item, str) and item.strip():
                titles.append(item.strip()[:500])
        if not titles:
            return None
        return titles[:5], raw
    except Exception:
        logger.exception("openai planner failed; falling back to heuristic")
        return None


def generate_week1_plan(settings: Settings, title: str, detail: str | None) -> Week1PlanResult:
    """Produce week-1 task titles and planner metadata."""
    oa = _openai_task_titles(settings, title, detail)
    if oa:
        titles, raw = oa
        return Week1PlanResult(
            planner_version=PLANNER_VERSION_OPENAI,
            task_titles=titles,
            source="openai",
            raw_model_response=raw[:8000],
        )
    titles = _heuristic_tasks(title, detail)
    return Week1PlanResult(
        planner_version=PLANNER_VERSION_HEURISTIC,
        task_titles=titles,
        source="heuristic",
        raw_model_response=None,
    )
