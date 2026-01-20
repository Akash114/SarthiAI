from app.services.effort_band import infer_effort_band


def test_infer_low_band_when_goal_mentions_casual():
    band, rationale = infer_effort_band("a casual, no pressure stretch", "health", 8)
    assert band == "low"
    assert "casual" in rationale.lower()


def test_infer_high_band_for_short_project():
    band, _ = infer_effort_band("ship feature fast", "project", 4)
    assert band == "high"


def test_infer_high_band_for_advanced_skill_keywords():
    band, _ = infer_effort_band("Master advanced piano exam", "skill", 10)
    assert band == "high"


def test_infer_intense_only_when_explicit_and_short():
    band, _ = infer_effort_band("intense bootcamp", "skill", 4)
    assert band == "intense"
    band_long, _ = infer_effort_band("intense bootcamp", "skill", 8)
    assert band_long == "high"
