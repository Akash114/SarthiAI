from __future__ import annotations

import uuid

from fastapi.testclient import TestClient


def test_register_login_me_onboarding_resolution_tasks_intervention_transparency_push(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    me = client.get("/v1/me", headers=auth_headers)
    assert me.status_code == 200
    assert "@" in me.json()["email"]

    ob = client.get("/v1/onboarding", headers=auth_headers)
    assert ob.status_code == 200
    assert ob.json()["status"] == "not_started"

    ob2 = client.patch(
        "/v1/onboarding",
        headers={**auth_headers, "Idempotency-Key": "ob-" + "x" * 8},
        json={"step": "prefs", "mark_completed": True},
    )
    assert ob2.status_code == 200
    assert ob2.json()["status"] == "completed"

    cur = client.get("/v1/resolutions/current", headers=auth_headers)
    assert cur.status_code == 200
    assert cur.json()["resolution"] is None

    r = client.post(
        "/v1/resolutions",
        headers={**auth_headers, "Idempotency-Key": "res-" + "x" * 8},
        json={"title": "Run a 5k", "detail": "Train gently"},
    )
    assert r.status_code == 201, r.text
    rid = r.json()["id"]

    r2 = client.post(
        "/v1/resolutions",
        headers={**auth_headers, "Idempotency-Key": "other-key-12345678"},
        json={"title": "Second"},
    )
    assert r2.status_code == 409

    g = client.post(
        f"/v1/resolutions/{rid}/generate-week-1",
        headers={**auth_headers, "Idempotency-Key": "gen-" + "x" * 8},
    )
    assert g.status_code == 202, g.text
    assert g.json()["week_1_plan_status"] == "ready"

    g_dup = client.post(
        f"/v1/resolutions/{rid}/generate-week-1",
        headers={**auth_headers, "Idempotency-Key": "gen-" + "x" * 8},
    )
    assert g_dup.status_code == 202
    assert g_dup.json() == g.json()

    tl = client.get(f"/v1/resolutions/{rid}/tasks", headers=auth_headers)
    assert tl.status_code == 200
    tasks = tl.json()["tasks"]
    assert len(tasks) >= 1
    tid = tasks[0]["id"]

    tc = client.post(
        f"/v1/tasks/{tid}/complete",
        headers={**auth_headers, "Idempotency-Key": "tc-" + "x" * 8},
    )
    assert tc.status_code == 200
    assert tc.json()["status"] == "completed"

    tc2 = client.post(
        f"/v1/tasks/{tid}/complete",
        headers={**auth_headers, "Idempotency-Key": "tc-" + "x" * 8},
    )
    assert tc2.status_code == 200

    iv = client.get("/v1/interventions/current", headers=auth_headers)
    assert iv.status_code == 200
    assert iv.json()["intervention"] is not None
    iid = iv.json()["intervention"]["id"]

    ap = client.post(
        f"/v1/interventions/{iid}/approve",
        headers={**auth_headers, "Idempotency-Key": "ap-" + "x" * 8},
    )
    assert ap.status_code == 200
    assert ap.json()["status"] == "approved"

    log = client.get("/v1/transparency-log", headers=auth_headers)
    assert log.status_code == 200
    assert len(log.json()["items"]) >= 1

    pt = client.post(
        "/v1/devices/push-token",
        headers={**auth_headers, "Idempotency-Key": "pt-" + "x" * 8},
        json={"expo_push_token": "ExponentPushToken[test]", "platform": "android"},
    )
    assert pt.status_code == 204

    out = client.post(
        "/v1/auth/logout",
        headers=auth_headers,
        json={"revoke_all": False},
    )
    assert out.status_code == 204


def test_refresh_token(client: TestClient) -> None:
    email = f"r_{uuid.uuid4().hex[:8]}@test.dev"
    reg = client.post("/v1/auth/register", json={"email": email, "password": "password123"})
    refresh = reg.json()["refresh_token"]
    ref = client.post("/v1/auth/refresh", json={"refresh_token": refresh})
    assert ref.status_code == 200
    assert ref.json()["access_token"]


def test_invalid_login(client: TestClient) -> None:
    r = client.post(
        "/v1/auth/login",
        json={"email": "nope@test.dev", "password": "wrong"},
    )
    assert r.status_code == 401
