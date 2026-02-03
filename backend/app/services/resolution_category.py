"""Helpers for mapping resolutions to journey categories."""
from __future__ import annotations

from typing import Dict

TYPE_TO_CATEGORY: Dict[str, str] = {
    "health": "fitness",
    "habit": "fitness",
    "learning": "learning",
    "project": "hobby",
    "finance": "hobby",
}

CATEGORY_DISPLAY_NAMES: Dict[str, str] = {
    "fitness": "Fitness",
    "learning": "Learning",
    "hobby": "Hobby",
    "general": "General",
}


def infer_category(resolution_type: str | None) -> str:
    """Map the classified resolution type to a dashboard category."""
    if not resolution_type:
        return "general"
    return TYPE_TO_CATEGORY.get(resolution_type.lower(), "general")


def get_category_display_name(category: str | None) -> str:
    return CATEGORY_DISPLAY_NAMES.get((category or "").lower(), CATEGORY_DISPLAY_NAMES["general"])
