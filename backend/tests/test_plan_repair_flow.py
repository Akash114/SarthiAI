import json
import os

import pytest

from app.services.resolution_decomposer import decompose_resolution_with_llm


class _FakeChatCompletions:
    def __init__(self, outer):
        self.outer = outer

    def create(self, **kwargs):  # noqa: D401 - stub
        if self.outer.call_index >= len(self.outer.responses):
            raise RuntimeError("No more fake responses")
        content = self.outer.responses[self.outer.call_index]
        self.outer.call_index += 1
        return type("FakeCompletion", (), {
            "choices": [
                type("Choice", (), {"message": type("Message", (), {"content": content})})
            ]
        })()


class _FakeChat:
    def __init__(self, outer):
        self.completions = _FakeChatCompletions(outer)


class FakeOpenAI:
    def __init__(self, responses):
        self.responses = responses
        self.call_index = 0
        self.chat = _FakeChat(self)


def _build_plan_json(task_title: str, duration: int) -> str:
    task = {
        "title": task_title,
        "intent": "Focus",
        "estimated_duration_min": duration,
        "cadence": "daily",
        "note": "",
    }
    plan = {
        "resolution_title": "Test Plan",
        "why_this_matters": "",
        "duration_weeks": 6,
        "milestones": [
            {"week_number": 1, "focus_summary": "Week 1"},
            {"week_number": 2, "focus_summary": "Week 2"},
        ],
        "week_1_tasks": [task],
        "weeks": [
            {"week": 1, "focus": "Week 1", "tasks": [task]},
            {"week": 2, "focus": "Week 2", "tasks": []},
        ],
        "band": "medium",
        "band_rationale": "default",
        "evaluation_summary": {},
    }
    return json.dumps(plan)


@pytest.fixture(autouse=True)
def _set_api_key(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    yield
    os.environ.pop("OPENAI_API_KEY", None)


def test_plan_repair_succeeds_after_retry(monkeypatch):
    bad_plan = _build_plan_json("Practice", 20)
    good_plan = _build_plan_json("Practice major scales hands separately", 30)
    fake_client = FakeOpenAI([bad_plan, good_plan])
    monkeypatch.setattr("openai.OpenAI", lambda api_key: fake_client)

    plan = decompose_resolution_with_llm(
        user_input="Master piano",
        duration_weeks=6,
        resolution_type="skill",
        user_context=None,
        effort_band="medium",
        band_rationale="test",
        request_id="req-1",
    )

    assert fake_client.call_index == 2
    summary = plan["evaluation_summary"]
    assert summary["passed"]
    assert summary["repair_used"]
    assert not summary["fallback_used"]


def test_plan_repair_falls_back_when_second_attempt_fails(monkeypatch):
    bad_plan = _build_plan_json("Practice", 200)
    fake_client = FakeOpenAI([bad_plan, bad_plan])
    monkeypatch.setattr("openai.OpenAI", lambda api_key: fake_client)

    plan = decompose_resolution_with_llm(
        user_input="Master piano",
        duration_weeks=6,
        resolution_type="skill",
        user_context=None,
        effort_band="medium",
        band_rationale="test",
        request_id="req-2",
    )

    assert fake_client.call_index == 2
    summary = plan["evaluation_summary"]
    assert summary["fallback_used"]
    assert summary["repair_used"]
