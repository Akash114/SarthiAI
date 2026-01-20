from app.services.plan_evaluator import evaluate_plan


def _build_task(title, duration=30, cadence_type="daily", cadence_extra=None):
    cadence = {"type": cadence_type, "times": ["morning"]}
    if cadence_extra:
        cadence.update(cadence_extra)
    return {
        "title": title,
        "estimated_duration_min": duration,
        "cadence": cadence,
    }


def test_plan_evaluator_passes_clear_skill_plan():
    plan = {
        "weeks": [
            {
                "week": 1,
                "focus": "Consistency",
                "tasks": [
                    _build_task("Practice major scales hands separately for tone control", 30),
                    _build_task("Review arpeggios slowly focusing on posture", 25),
                ],
            }
        ]
    }
    result = evaluate_plan(plan, "medium", "skill")
    assert result.passed
    assert result.score >= 70


def test_plan_evaluator_flags_vague_tasks():
    plan = {
        "weeks": [
            {
                "week": 1,
                "focus": "",
                "tasks": [_build_task("Practice piano", 20, cadence_type="flex")],
            }
        ]
    }
    result = evaluate_plan(plan, "medium", "skill")
    assert not result.passed
    assert result.vagueness_flags


def test_plan_evaluator_budget_violation_medium_band():
    heavy_tasks = [_build_task(f"Session {i}", 90) for i in range(5)]
    plan = {
        "weeks": [
            {
                "week": 1,
                "focus": "",
                "tasks": heavy_tasks,
            }
        ]
    }
    result = evaluate_plan(plan, "medium", "project")
    assert not result.passed
    assert result.budget_violations


def test_plan_evaluator_allows_high_band_heavier_plan():
    tasks = [
        _build_task(
            f"Deep project block {i}: outline feature spec",
            90,
            cadence_type="specific_days",
            cadence_extra={"days": ["monday", "wednesday", "friday"]},
        )
        for i in range(4)
    ]
    plan = {
        "weeks": [
            {
                "week": 1,
                "focus": "",
                "tasks": tasks,
            }
        ]
    }
    result = evaluate_plan(plan, "high", "project")
    assert result.score >= 70
    assert result.passed


def test_plan_evaluator_allows_minor_overage():
    tasks = [
        _build_task(
            f"Extended focus block {i}",
            150,
            cadence_type="specific_days",
            cadence_extra={"days": [day]},
        )
        for i, day in enumerate(["monday", "wednesday", "friday"], start=1)
    ]
    plan = {
        "weeks": [
            {
                "week": 1,
                "focus": "Ship milestone",
                "tasks": tasks,
            }
        ]
    }
    result = evaluate_plan(plan, "medium", "project")
    assert result.score >= 60
    assert result.passed
