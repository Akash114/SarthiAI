"""Extract structured signals from free-text brain dumps (heuristic + optional OpenAI)."""

from __future__ import annotations

import json
import re
from typing import Any

from pydantic import BaseModel, Field

from app.config import Settings


class BrainDumpSignals(BaseModel):
    sentiment_score: float = Field(..., ge=-1.0, le=1.0)
    emotions: list[str]
    topics: list[str]
    actionable_items: list[str]
    acknowledgement: str


def _heuristic_signals(text: str) -> dict[str, Any]:
    t = text.strip().lower()
    emotions: list[str] = []
    if any(w in t for w in ("anxious", "worried", "stress", "overwhelm", "panic")):
        emotions.append("stress")
    if any(w in t for w in ("sad", "down", "depressed", "lonely")):
        emotions.append("low_mood")
    if any(w in t for w in ("excited", "happy", "great", "grateful")):
        emotions.append("positive")

    sentiment = 0.0
    if "positive" in emotions:
        sentiment += 0.35
    if "low_mood" in emotions:
        sentiment -= 0.45
    if "stress" in emotions:
        sentiment -= 0.25
    sentiment = max(-1.0, min(1.0, sentiment))

    topics: list[str] = []
    for label, keys in (
        ("health", ("health", "sleep", "exercise", "run", "gym", "food")),
        ("work", ("work", "job", "career", "boss", "deadline")),
        ("relationships", ("friend", "family", "partner", "marriage")),
        ("growth", ("learn", "study", "read", "habit", "goal")),
    ):
        if any(k in t for k in keys):
            topics.append(label)

    actionable_items: list[str] = []
    for m in re.finditer(
        r"(?:need to|want to|should|going to|have to)\s+([^.\n!]{5,120})",
        text,
        flags=re.IGNORECASE,
    ):
        s = m.group(1).strip()
        if s and s not in actionable_items:
            actionable_items.append(s[:200])
            if len(actionable_items) >= 5:
                break

    ack = "Thanks for sharing. We'll take the next step together when you're ready."
    return BrainDumpSignals(
        sentiment_score=sentiment,
        emotions=emotions,
        topics=topics,
        actionable_items=actionable_items,
        acknowledgement=ack,
    ).model_dump()


def _openai_signals(settings: Settings, text: str) -> dict[str, Any] | None:
    if not settings.openai_api_key:
        return None
    try:
        from openai import OpenAI
    except ImportError:
        return None
    client = OpenAI(api_key=settings.openai_api_key)
    try:
        completion = client.chat.completions.create(
            model=settings.openai_planner_model,
            response_format={"type": "json_object"},
            temperature=0.3,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Analyze the user's journal-style text. Return JSON with keys: "
                        "sentiment_score (-1 to 1), emotions (string array), topics (string array), "
                        "actionable_items (short strings), acknowledgement (max 15 words, empathetic)."
                    ),
                },
                {"role": "user", "content": text[:12000]},
            ],
        )
        raw = (completion.choices[0].message.content or "{}").strip()
        data = json.loads(raw)
        return BrainDumpSignals.model_validate(data).model_dump()
    except Exception:
        return None


def extract_brain_dump_signals(settings: Settings, text: str) -> dict[str, Any]:
    oa = _openai_signals(settings, text)
    if oa:
        return oa
    return _heuristic_signals(text)
