"""Utilities for working with user availability profiles."""
from __future__ import annotations

from typing import Any, Dict, List, Sequence, Tuple

DEFAULT_PERSONAL_SLOTS: Dict[str, str] = {
    "fitness": "morning",
    "learning": "evening",
    "admin": "weekend",
}

DEFAULT_AVAILABILITY_PROFILE: Dict[str, Any] = {
    "work_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "work_start": "09:00",
    "work_end": "18:00",
    "peak_energy": "morning",
    "work_mode_enabled": False,
    "personal_slots": DEFAULT_PERSONAL_SLOTS,
}

_DAY_NORMALIZATION = {
    "mon": "Mon",
    "monday": "Mon",
    "tue": "Tue",
    "tues": "Tue",
    "tuesday": "Tue",
    "wed": "Wed",
    "weds": "Wed",
    "wednesday": "Wed",
    "thu": "Thu",
    "thur": "Thu",
    "thurs": "Thu",
    "thursday": "Thu",
    "fri": "Fri",
    "friday": "Fri",
    "sat": "Sat",
    "saturday": "Sat",
    "sun": "Sun",
    "sunday": "Sun",
}

_SLOT_RANGE_MINUTES = {
    "morning": (6 * 60, 8 * 60),
    "afternoon": (12 * 60, 15 * 60),
    "evening": (19 * 60, 21 * 60),
    "night": (21 * 60, 23 * 60),
    "weekend": (10 * 60, 12 * 60),
    "evenings": (19 * 60, 21 * 60),
}


def sanitize_availability_profile(raw: Dict[str, Any] | None) -> Dict[str, Any]:
    """Return a normalized availability profile with defaults filled in."""
    if not isinstance(raw, dict):
        return {
            **DEFAULT_AVAILABILITY_PROFILE,
            "personal_slots": dict(DEFAULT_PERSONAL_SLOTS),
        }

    sanitized: Dict[str, Any] = {
        **DEFAULT_AVAILABILITY_PROFILE,
        "personal_slots": dict(DEFAULT_PERSONAL_SLOTS),
    }
    sanitized["work_days"] = _normalize_work_days(raw.get("work_days"))

    work_start = _normalize_time_string(raw.get("work_start"))
    work_end = _normalize_time_string(raw.get("work_end"))
    if work_start:
        sanitized["work_start"] = work_start
    if work_end:
        sanitized["work_end"] = work_end

    # Ensure start precedes end; if not, fall back to defaults.
    if _time_str_to_minutes(sanitized["work_start"]) >= _time_str_to_minutes(sanitized["work_end"]):
        sanitized["work_start"] = DEFAULT_AVAILABILITY_PROFILE["work_start"]
        sanitized["work_end"] = DEFAULT_AVAILABILITY_PROFILE["work_end"]

    peak = str(raw.get("peak_energy", "")).strip().lower()
    if peak in {"morning", "evening"}:
        sanitized["peak_energy"] = peak
    else:
        sanitized["peak_energy"] = DEFAULT_AVAILABILITY_PROFILE["peak_energy"]

    if isinstance(raw.get("work_mode_enabled"), bool):
        sanitized["work_mode_enabled"] = raw["work_mode_enabled"]
    else:
        sanitized["work_mode_enabled"] = DEFAULT_AVAILABILITY_PROFILE["work_mode_enabled"]

    sanitized["personal_slots"] = _normalize_personal_slots(raw.get("personal_slots"))

    return sanitized


def availability_prompt_block(domain: str | None, profile: Dict[str, Any] | None) -> str:
    """Return a text snippet describing availability rules for LLM prompts."""
    if not profile:
        return ""
    domain_label = (domain or "personal").lower()
    work_days = ", ".join(profile["work_days"])
    work_window = f"{profile['work_start']}–{profile['work_end']}"
    energy = profile["peak_energy"]
    energy_clause = (
        "- When the user says their peak energy is morning, schedule demanding tasks near the start of the allowed window.\n"
        if energy == "morning"
        else "- When the user says their peak energy is evening, schedule demanding tasks toward the end of the allowed window.\n"
    )
    if domain_label == "work":
        rule = (
            f"- Work focus days: {work_days}. ONLY schedule work tasks on those days between {work_window}.\n"
            "- Never place work tasks on weekends unless the list of work days explicitly includes them.\n"
        )
    else:
        rule = (
            f"- Work hours to AVOID for personal tasks: {work_window} on {work_days}.\n"
            "- Schedule personal tasks either before work_start or after work_end on work days. Weekends are fully open.\n"
        )
    work_mode_enabled = profile.get("work_mode_enabled", False)
    mode_hint = (
        "- Conflict Rule: Strict Work Mode is enabled, so personal tasks must avoid work hours and vice versa.\n"
        if work_mode_enabled
        else "- Conflict Rule: Work Mode is relaxed, but still favor keeping personal focus outside work hours.\n"
    )
    personal_slots = profile.get("personal_slots") or {}
    fitness_label = personal_slots.get("fitness", DEFAULT_PERSONAL_SLOTS["fitness"])
    hobby_label = personal_slots.get("learning", DEFAULT_PERSONAL_SLOTS["learning"])
    fitness_range = _slot_range_text(fitness_label)
    hobby_range = _slot_range_text(hobby_label)
    slot_hint = (
        f"- Fitness Rule: Fitness resolutions should aim for the {fitness_label} window ({fitness_range}).\n"
        f"- Hobby/Learning Rule: Hobby or learning resolutions should aim for the {hobby_label} window ({hobby_range}).\n"
    )
    return (
        "### SMART AVAILABILITY RULES\n"
        f"- Work Rule: Work-domain tasks must stay inside {work_window} on {work_days}.\n"
        f"{slot_hint}"
        f"{rule}"
        f"{energy_clause}"
        f"{mode_hint}"
        "- Times must always be formatted as HH:MM using 24-hour clocks.\n"
    )


def availability_day_to_weekday(day_code: str) -> int | None:
    """Convert short codes like 'Mon' to a weekday integer (Monday=0)."""
    normalized = _DAY_NORMALIZATION.get(day_code.strip().lower())
    mapping = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6}
    if not normalized:
        return None
    return mapping.get(normalized)


def _normalize_work_days(days: Sequence[str] | None) -> List[str]:
    if not days:
        return list(DEFAULT_AVAILABILITY_PROFILE["work_days"])

    normalized: List[str] = []
    for entry in days:
        if not isinstance(entry, str):
            continue
        key = entry.strip().lower()
        value = _DAY_NORMALIZATION.get(key)
        if value and value not in normalized:
            normalized.append(value)

    if not normalized:
        return list(DEFAULT_AVAILABILITY_PROFILE["work_days"])
    return normalized


def _normalize_time_string(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    parts = value.strip().split(":")
    if len(parts) != 2:
        return None
    try:
        hour = max(0, min(23, int(parts[0])))
        minute = max(0, min(59, int(parts[1])))
    except ValueError:
        return None
    return f"{hour:02d}:{minute:02d}"


def _time_str_to_minutes(value: str) -> int:
    try:
        hours, minutes = [int(part) for part in value.split(":")]
        return hours * 60 + minutes
    except Exception:
        return 0


def _slot_range_text(label: str) -> str:
    start, end = _slot_range_minutes(label)
    return f"{_minutes_to_time(start)}–{_minutes_to_time(end)}"


def _slot_range_minutes(label: str | None) -> Tuple[int, int]:
    if not label:
        return _SLOT_RANGE_MINUTES["evening"]
    normalized = label.strip().lower()
    return _SLOT_RANGE_MINUTES.get(normalized, _SLOT_RANGE_MINUTES["evening"])


def _minutes_to_time(total_minutes: int) -> str:
    hours = total_minutes // 60
    minutes = total_minutes % 60
    return f"{hours:02d}:{minutes:02d}"


def _normalize_personal_slots(raw) -> Dict[str, str]:
    normalized = dict(DEFAULT_PERSONAL_SLOTS)
    if not isinstance(raw, dict):
        return normalized
    fitness = str(raw.get("fitness", "")).lower()
    learning = str(raw.get("learning", "")).lower()
    admin = str(raw.get("admin", "")).lower()
    if fitness in {"morning", "afternoon", "evening"}:
        normalized["fitness"] = fitness
    if learning in {"morning", "afternoon", "evening"}:
        normalized["learning"] = learning
    if admin in {"weekend", "evenings"}:
        normalized["admin"] = admin
    return normalized


def category_slot_preferences(
    resolution_category: str | None,
    profile: Dict[str, Any],
) -> Tuple[Tuple[int, int] | None, bool]:
    """Return a preferred time range (minutes) and whether weekends should be prioritized."""
    category = (resolution_category or "").lower()
    slots = profile.get("personal_slots") or {}
    prefer_weekend = False
    if category == "fitness":
        label = slots.get("fitness", DEFAULT_PERSONAL_SLOTS["fitness"])
        return _slot_range_minutes(label), prefer_weekend
    if category in {"hobby", "learning"}:
        label = slots.get("learning", DEFAULT_PERSONAL_SLOTS["learning"])
        return _slot_range_minutes(label), prefer_weekend
    if category in {"admin", "chores"}:
        label = slots.get("admin", DEFAULT_PERSONAL_SLOTS["admin"])
        if label == "weekend":
            prefer_weekend = True
        return _slot_range_minutes(label), prefer_weekend
    return None, False
