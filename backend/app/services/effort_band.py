"""Effort-band inference utilities for plan generation."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Tuple

EFFORT_BAND_BUDGETS: Dict[str, Dict[str, Tuple[int, int] | int]] = {
    "low": {
        "minutes_per_day": (15, 30),
        "tasks_per_day": (1, 1),
        "weekly_minutes": 180,
    },
    "medium": {
        "minutes_per_day": (30, 60),
        "tasks_per_day": (1, 2),
        "weekly_minutes": 360,
    },
    "high": {
        "minutes_per_day": (60, 120),
        "tasks_per_day": (2, 4),
        "weekly_minutes": 720,
    },
    "intense": {
        "minutes_per_day": (120, 240),
        "tasks_per_day": (3, 6),
        "weekly_minutes": 1440,
    },
}

LOW_KEYWORDS = {"casual", "light", "no pressure"}
INTENSE_KEYWORDS = {"intense", "crash course", "bootcamp"}
SKILL_PUSH_KEYWORDS = {"master", "advanced", "exam", "certification", "daily practice", "serious"}


def infer_effort_band(user_input: str, resolution_type: str | None, duration_weeks: int | None) -> tuple[str, str]:
    """Infer effort band and rationale from goal text/type."""
    text = (user_input or "").lower()
    duration = duration_weeks or 8
    base_band = "medium"
    rationale = "Defaulted to medium effort."

    if any(keyword in text for keyword in LOW_KEYWORDS):
        return "low", "Goal explicitly requests a casual/light approach."

    if resolution_type in {"habit", "health"}:
        base_band = "medium"
        rationale = "Habits/health default to medium effort."
    elif resolution_type in {"skill", "learning"}:
        base_band = "medium"
        rationale = "Skill/learning defaults to medium effort."
        if any(keyword in text for keyword in SKILL_PUSH_KEYWORDS):
            base_band = "high"
            rationale = "Skill goal indicates advanced intensity."
    elif resolution_type in {"project", "work"}:
        if duration <= 6:
            base_band = "high"
            rationale = "Short project/work goal defaulted to high effort."
        else:
            base_band = "medium"
            rationale = "Longer project/work plan kept at medium effort."
    else:
        base_band = "medium"
        rationale = "No specific type, defaulting to medium effort."

    if any(keyword in text for keyword in INTENSE_KEYWORDS):
        if duration <= 4:
            return "intense", "Explicit intense wording with short duration."
        return "high", "Explicit intense wording but duration suggests high effort."

    return base_band, rationale
