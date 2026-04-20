from __future__ import annotations

from unittest.mock import MagicMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models.device_push import DevicePushToken


def test_health_ready(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from unittest.mock import MagicMock

    import app.main as main_mod

    h = client.get("/health")
    assert h.status_code == 200
    assert h.json()["status"] == "ok"
    monkeypatch.setattr(main_mod, "redis_connection", lambda: MagicMock(ping=lambda: True))
    r = client.get("/ready")
    assert r.status_code == 200
    assert r.json()["status"] == "ready"


def test_notifications_config(client: TestClient) -> None:
    c = client.get("/v1/notifications/config")
    assert c.status_code == 200
    body = c.json()
    assert "enabled" in body
    assert body["provider"] in ("expo", "noop")


def _register_and_resolution(client: TestClient, auth_headers: dict[str, str]) -> str:
    client.patch(
        "/v1/onboarding",
        headers={**auth_headers, "Idempotency-Key": "ob-ext" + "x" * 8},
        json={"step": "done", "mark_completed": True},
    )
    r = client.post(
        "/v1/resolutions",
        headers={**auth_headers, "Idempotency-Key": "res-ext" + "x" * 8},
        json={"title": "Learn Spanish", "detail": "15 minutes daily"},
    )
    assert r.status_code == 201
    return r.json()["id"]


def test_week1_preview_and_plan_history(client: TestClient, auth_headers: dict[str, str]) -> None:
    rid = _register_and_resolution(client, auth_headers)
    p = client.post(f"/v1/resolutions/{rid}/week-1/preview", headers=auth_headers)
    assert p.status_code == 201, p.text
    data = p.json()
    assert data["planner_version"]
    assert data["source"] in ("heuristic", "openai")
    assert len(data["tasks"]) >= 3
    sid = data["snapshot_id"]

    h = client.get(f"/v1/resolutions/{rid}/plan-history", headers=auth_headers)
    assert h.status_code == 200
    assert any(item["id"] == sid for item in h.json()["items"])

    d = client.get(f"/v1/plan-snapshots/{sid}", headers=auth_headers)
    assert d.status_code == 200
    assert len(d.json()["tasks"]) >= 3


def test_dashboard_and_journey(client: TestClient, auth_headers: dict[str, str]) -> None:
    rid = _register_and_resolution(client, auth_headers)
    client.post(
        f"/v1/resolutions/{rid}/generate-week-1",
        headers={**auth_headers, "Idempotency-Key": "gw1-" + "x" * 8},
    )
    dash = client.get("/v1/dashboard", headers=auth_headers)
    assert dash.status_code == 200
    assert dash.json()["resolution"] is not None
    assert dash.json()["resolution"]["open_tasks"] >= 1

    j = client.get("/v1/journey/daily", headers=auth_headers)
    assert j.status_code == 200
    assert len(j.json()["tasks"]) >= 1


def test_interventions_history_after_dismiss(client: TestClient, auth_headers: dict[str, str]) -> None:
    rid = _register_and_resolution(client, auth_headers)
    client.post(
        f"/v1/resolutions/{rid}/generate-week-1",
        headers={**auth_headers, "Idempotency-Key": "gw2-" + "x" * 8},
    )
    tl = client.get(f"/v1/resolutions/{rid}/tasks", headers=auth_headers)
    tid = tl.json()["tasks"][0]["id"]
    client.post(f"/v1/tasks/{tid}/complete", headers={**auth_headers, "Idempotency-Key": "tc-h" + "x" * 7})
    iv = client.get("/v1/interventions/current", headers=auth_headers).json()["intervention"]
    assert iv
    client.post(
        f"/v1/interventions/{iv['id']}/dismiss",
        headers={**auth_headers, "Idempotency-Key": "ds-h" + "x" * 7},
    )
    hist = client.get("/v1/interventions/history", headers=auth_headers)
    assert hist.status_code == 200
    assert len(hist.json()) >= 1


def test_ops_disabled_without_key(client: TestClient) -> None:
    r = client.get("/v1/ops/jobs", headers={"X-Ops-Key": "nope"})
    assert r.status_code == 404


def test_ops_run_with_key(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPS_API_KEY", "secret-ops-test-key-123")
    from app.config import get_settings

    get_settings.cache_clear()
    r = client.get("/v1/ops/jobs", headers={"X-Ops-Key": "secret-ops-test-key-123"})
    assert r.status_code == 200
    body = r.json()
    assert "jobs" in body
    rr = client.post(
        "/v1/ops/jobs/run",
        headers={"X-Ops-Key": "secret-ops-test-key-123"},
        json={"job": "reminders"},
    )
    assert rr.status_code == 200
    assert rr.json()["job"] == "reminders"


def test_week1_job_failure_marks_failed(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def boom(*_a, **_k):
        raise RuntimeError("planner down")

    monkeypatch.setattr("app.jobs.week1.generate_week1_plan", boom)
    rid = _register_and_resolution(client, auth_headers)
    g = client.post(
        f"/v1/resolutions/{rid}/generate-week-1",
        headers={**auth_headers, "Idempotency-Key": "fail-" + "x" * 8},
    )
    assert g.status_code == 202
    res = client.get(f"/v1/resolutions/{rid}", headers=auth_headers)
    assert res.json()["week_1_plan_status"] == "failed"


def test_expo_invalidates_token(
    client: TestClient, auth_headers: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.config import get_settings
    from app.services.notifications import expo as expo_mod
    from app.services.notifications.expo import send_expo_push_batch

    monkeypatch.setenv("NOTIFICATIONS_ENABLED", "true")
    get_settings.cache_clear()

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = b"{}"
    mock_resp.json = lambda: {
        "data": [
            {
                "status": "error",
                "message": "DeviceNotRegisteredError",
                "to": "ExponentPushToken[x]",
            }
        ]
    }

    class MockClient:
        def __init__(self, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, json=None, headers=None):
            return mock_resp

    monkeypatch.setattr(expo_mod.httpx, "Client", MockClient)

    client.post(
        "/v1/devices/push-token",
        headers={**auth_headers, "Idempotency-Key": "pt-expo" + "x" * 8},
        json={"expo_push_token": "ExponentPushToken[x]", "platform": "android"},
    )
    me = client.get("/v1/me", headers=auth_headers).json()
    user_id = UUID(me["id"])

    from app.db import get_session_factory

    db = get_session_factory()()
    try:
        s = get_settings()
        send_expo_push_batch(
            db,
            s,
            user_id,
            [{"to": "ExponentPushToken[x]", "title": "t", "body": "b"}],
        )
        db.commit()
        row = db.scalar(select(DevicePushToken).where(DevicePushToken.expo_push_token == "ExponentPushToken[x]"))
        assert row is not None
        assert row.invalidated_at is not None
    finally:
        db.close()


def test_preferences_get_patch(client: TestClient, auth_headers: dict[str, str]) -> None:
    g = client.get("/v1/preferences", headers=auth_headers)
    assert g.status_code == 200
    assert g.json()["task_reminders_enabled"] is True
    p = client.patch(
        "/v1/preferences",
        headers={**auth_headers, "Idempotency-Key": "pref-" + "x" * 8},
        json={"coaching_paused": True},
    )
    assert p.status_code == 200
    assert p.json()["coaching_paused"] is True


def test_brain_dump_creates_transparency(client: TestClient, auth_headers: dict[str, str]) -> None:
    r = client.post(
        "/v1/brain-dump",
        headers=auth_headers,
        json={"text": "I need to run a 5k and I feel a bit stressed about work."},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["id"]
    assert "signals" in data
    log = client.get("/v1/transparency-log", headers=auth_headers, params={"action_type": "brain_dump_recorded"})
    assert log.status_code == 200
    assert any("Reflection" in item["headline"] for item in log.json()["items"])


def test_transparency_entry_get_and_task_patch(client: TestClient, auth_headers: dict[str, str]) -> None:
    client.patch(
        "/v1/onboarding",
        headers={**auth_headers, "Idempotency-Key": "ob-tp" + "x" * 8},
        json={"step": "x", "mark_completed": True},
    )
    res = client.post(
        "/v1/resolutions",
        headers={**auth_headers, "Idempotency-Key": "rs-tp" + "x" * 8},
        json={"title": "Task patch test"},
    )
    rid = res.json()["id"]
    client.post(
        f"/v1/resolutions/{rid}/generate-week-1",
        headers={**auth_headers, "Idempotency-Key": "gw-tp" + "x" * 8},
    )
    tl = client.get(f"/v1/resolutions/{rid}/tasks", headers=auth_headers)
    tid = tl.json()["tasks"][0]["id"]
    tp = client.patch(
        f"/v1/tasks/{tid}",
        headers={**auth_headers, "Idempotency-Key": "tkpt-" + "x" * 8},
        json={"note": "my note"},
    )
    assert tp.status_code == 200
    assert tp.json()["metadata_json"]["note"] == "my note"
    tg = client.get(f"/v1/tasks/{tid}", headers=auth_headers)
    assert tg.status_code == 200
    log = client.get("/v1/transparency-log", headers=auth_headers)
    eid = log.json()["items"][0]["id"]
    eg = client.get(f"/v1/transparency-log/{eid}", headers=auth_headers)
    assert eg.status_code == 200
    assert eg.json()["id"] == eid


def test_devices_push_token_delete(client: TestClient, auth_headers: dict[str, str]) -> None:
    client.post(
        "/v1/devices/push-token",
        headers={**auth_headers, "Idempotency-Key": "pt-d-" + "x" * 8},
        json={"expo_push_token": "ExponentPushToken[delme]", "platform": "android"},
    )
    d = client.request(
        "DELETE",
        "/v1/devices/push-token",
        headers=auth_headers,
        json={"expo_push_token": "ExponentPushToken[delme]", "platform": "android"},
    )
    assert d.status_code == 204


def test_merge_anonymous_moves_resolution(client: TestClient) -> None:
    import uuid as u

    ea = f"ma_{u.uuid4().hex[:8]}@t.dev"
    eb = f"mb_{u.uuid4().hex[:8]}@t.dev"
    ra = client.post("/v1/auth/register", json={"email": ea, "password": "password123"})
    rb = client.post("/v1/auth/register", json={"email": eb, "password": "password123"})
    assert ra.status_code == 201 and rb.status_code == 201
    ha = {"Authorization": f"Bearer {ra.json()['access_token']}"}
    hb = {"Authorization": f"Bearer {rb.json()['access_token']}"}
    uid_b = client.get("/v1/me", headers=hb).json()["id"]
    client.patch(
        "/v1/onboarding",
        headers={**hb, "Idempotency-Key": "ob-mb" + "x" * 8},
        json={"step": "x", "mark_completed": True},
    )
    cr = client.post(
        "/v1/resolutions",
        headers={**hb, "Idempotency-Key": "rs-mb" + "x" * 8},
        json={"title": "From B"},
    )
    assert cr.status_code == 201
    rid = cr.json()["id"]
    m = client.post("/v1/auth/merge-anonymous", headers=ha, json={"anonymous_user_id": uid_b})
    assert m.status_code == 200
    assert m.json()["merged"] is True
    cur = client.get("/v1/resolutions/current", headers=ha)
    assert cur.json()["resolution"]["id"] == rid


def test_merge_anonymous_conflict_two_actives(client: TestClient) -> None:
    import uuid as u

    ea = f"mc_{u.uuid4().hex[:8]}@t.dev"
    eb = f"md_{u.uuid4().hex[:8]}@t.dev"
    ra = client.post("/v1/auth/register", json={"email": ea, "password": "password123"})
    rb = client.post("/v1/auth/register", json={"email": eb, "password": "password123"})
    ha = {"Authorization": f"Bearer {ra.json()['access_token']}"}
    hb = {"Authorization": f"Bearer {rb.json()['access_token']}"}
    uid_b = client.get("/v1/me", headers=hb).json()["id"]
    for h, key in ((ha, "rsa"), (hb, "rsb")):
        client.patch(
            "/v1/onboarding",
            headers={**h, "Idempotency-Key": key + "x" * 10},
            json={"step": "x", "mark_completed": True},
        )
        client.post(
            "/v1/resolutions",
            headers={**h, "Idempotency-Key": key + "r" * 10},
            json={"title": "Both active"},
        )
    m = client.post("/v1/auth/merge-anonymous", headers=ha, json={"anonymous_user_id": uid_b})
    assert m.status_code == 409
