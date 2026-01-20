"""OpenAI-backed brain dump signal extractor."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import List

import openai
from pydantic import BaseModel, Field


class BrainDumpSignals(BaseModel):
    """Structured signals extracted from a brain dump."""

    sentiment_score: float = Field(..., ge=-1.0, le=1.0)
    emotions: List[str]
    topics: List[str]
    actionable_items: List[str]
    acknowledgement: str


@dataclass
class ExtractionResult:
    signals: dict
    actionable: bool
    success: bool


def extract_signals_from_text(text: str) -> dict:
    """Call OpenAI to extract structured brain-dump signals or fall back safely."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return _fallback_signals().model_dump()

    client = openai.OpenAI(api_key=api_key)
    system_prompt = (
        "You are Sarathi AI, a compassionate listener. Analyze the user's mental dump. "
        "Extract structured signals and write a short, empathetic acknowledgement (max 15 words)."
    )
    user_prompt = f"User Text: '{text}'. Return JSON matching the schema."

    try:
        completion = client.chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        content = completion.choices[0].message.content or "{}"
        payload = json.loads(content)
        signals = BrainDumpSignals.model_validate(payload)
        return signals.model_dump()
    except Exception:
        return _fallback_signals().model_dump()


def extract_signals(text: str) -> ExtractionResult:
    """Adapter used by the API route to preserve the previous interface."""
    fallback_dict = _fallback_signals().model_dump()
    signals_dict = extract_signals_from_text(text)
    actionable = bool(signals_dict.get("actionable_items"))
    success = signals_dict != fallback_dict
    return ExtractionResult(signals=signals_dict, actionable=actionable, success=success)


def _fallback_signals() -> BrainDumpSignals:
    """Return a neutral, supportive response when OpenAI is unavailable."""
    return BrainDumpSignals(
        sentiment_score=0.0,
        emotions=[],
        topics=[],
        actionable_items=[],
        acknowledgement="Thanks for sharing. I'm here and we'll take it one step at a time.",
    )
