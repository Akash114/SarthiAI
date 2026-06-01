from __future__ import annotations

import base64
import json
import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.config import DEFAULT_JWT_SECRET, Settings, validate_settings_for_environment


def _register_password(client: TestClient, email: str, password: str = "password123") -> dict:
    started = client.post("/v1/auth/password/register", json={"email": email, "password": password})
    assert started.status_code == 201, started.text
    code = started.json()["verification_code"]
    verified = client.post("/v1/auth/password/verify", json={"email": email, "code": code})
    assert verified.status_code == 200, verified.text
    return verified.json()


def _headers(token_response: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {token_response['access_token']}"}


def _local_google_token(email: str, subject: str = "google-subject", name: str = "Google User") -> str:
    raw = json.dumps(
        {
            "sub": subject,
            "email": email,
            "email_verified": True,
            "name": name,
            "picture": "https://example.test/avatar.png",
        }
    ).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def test_password_and_google_same_email_link_to_one_user(client: TestClient) -> None:
    email = f"same_{uuid.uuid4().hex[:8]}@test.dev"
    password_tokens = _register_password(client, email)
    google = client.post("/v1/auth/google", json={"id_token": _local_google_token(email, "sub-1")})
    assert google.status_code == 200, google.text
    assert google.json()["user"]["id"] == password_tokens["user"]["id"]
    methods = {method["provider"] for method in google.json()["user"]["auth_methods"]}
    assert methods == {"password", "google"}


def test_password_signup_existing_google_email_uses_same_account_after_verification(client: TestClient) -> None:
    email = f"google_first_{uuid.uuid4().hex[:8]}@test.dev"
    google = client.post("/v1/auth/google", json={"id_token": _local_google_token(email, "sub-2")})
    assert google.status_code == 200, google.text
    started = client.post("/v1/auth/password/register", json={"email": email.upper(), "password": "password123"})
    assert started.status_code == 201, started.text
    verified = client.post("/v1/auth/password/verify", json={"email": email, "code": started.json()["verification_code"]})
    assert verified.status_code == 200, verified.text
    assert verified.json()["user"]["id"] == google.json()["user"]["id"]


def test_account_deletion_and_anonymous_merge_are_gone(client: TestClient, auth_headers: dict[str, str]) -> None:
    assert client.request("DELETE", "/v1/me", headers=auth_headers, json={"password": "password123"}).status_code == 405
    assert client.post("/v1/auth/merge-anonymous", headers=auth_headers, json={"anonymous_user_id": str(uuid.uuid4())}).status_code == 404


def test_standalone_goal_task_and_goal_task_flow(client: TestClient, auth_headers: dict[str, str]) -> None:
    standalone = client.post("/v1/tasks", headers=auth_headers, json={"title": "Inbox task"})
    assert standalone.status_code == 201, standalone.text
    assert standalone.json()["goal_id"] is None

    goal = client.post("/v1/goals", headers=auth_headers, json={"title": "Launch course"})
    assert goal.status_code == 201, goal.text
    task = client.post(
        "/v1/tasks",
        headers=auth_headers,
        json={"title": "Draft curriculum", "goal_id": goal.json()["id"], "priority": "high"},
    )
    assert task.status_code == 201, task.text
    assert task.json()["goal_id"] == goal.json()["id"]

    completed = client.post(f"/v1/tasks/{task.json()['id']}/complete", headers=auth_headers)
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed"
    notifications = client.get("/v1/notifications", headers=auth_headers)
    assert notifications.status_code == 200, notifications.text
    assert notifications.json()["notifications"][0]["kind"] == "goal_progress"


def test_team_members_can_create_and_complete_shared_tasks(client: TestClient) -> None:
    owner = _register_password(client, f"owner_{uuid.uuid4().hex[:8]}@test.dev")
    member = _register_password(client, f"member_{uuid.uuid4().hex[:8]}@test.dev")
    owner_headers = _headers(owner)
    member_headers = _headers(member)

    team = client.post("/v1/teams", headers=owner_headers, json={"name": "Presentation team"})
    assert team.status_code == 201, team.text
    joined = client.post("/v1/teams/join", headers=member_headers, json={"invite_code": team.json()["invite_code"]})
    assert joined.status_code == 200, joined.text

    goal = client.post("/v1/goals", headers=member_headers, json={"title": "Shared launch", "team_id": team.json()["team"]["id"]})
    assert goal.status_code == 201, goal.text
    task = client.post(
        "/v1/tasks",
        headers=owner_headers,
        json={"title": "Publish agenda", "team_id": team.json()["team"]["id"], "goal_id": goal.json()["id"]},
    )
    assert task.status_code == 201, task.text
    done = client.post(f"/v1/tasks/{task.json()['id']}/complete", headers=member_headers)
    assert done.status_code == 200, done.text
    assert done.json()["completed_by_user_id"] == member["user"]["id"]


def test_focus_session_and_brain_dump_split_task(client: TestClient, auth_headers: dict[str, str]) -> None:
    goal = client.post("/v1/goals", headers=auth_headers, json={"title": "Conference talk"})
    due = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    task = client.post(
        "/v1/tasks",
        headers=auth_headers,
        json={
            "title": "Create presentation",
            "goal_id": goal.json()["id"],
            "due_at": due,
            "notes": "Cover every topic in one deck.",
        },
    )
    focus = client.post("/v1/focus-sessions/start", headers=auth_headers, json={"task_id": task.json()["id"]})
    assert focus.status_code == 201, focus.text
    active = client.get("/v1/focus-sessions/active", headers=auth_headers)
    assert active.status_code == 200, active.text
    assert active.json()["elapsed_seconds"] >= 0

    dump = client.post(
        f"/v1/focus-sessions/{focus.json()['id']}/brain-dumps",
        headers=auth_headers,
        json={"text": "The content is too much to cover tomorrow, so we should split it into 2 presentations."},
    )
    assert dump.status_code == 201, dump.text
    detail = client.get(f"/v1/brain-dumps/{dump.json()['id']}", headers=auth_headers)
    assert detail.status_code == 200, detail.text
    assert len(detail.json()["proposals"]) >= 2

    applied = client.post(f"/v1/brain-dumps/{dump.json()['id']}/apply", headers=auth_headers, json={})
    assert applied.status_code == 200, applied.text
    assert task.json()["id"] in applied.json()["updated_task_ids"]
    assert len(applied.json()["created_task_ids"]) == 1

    ended = client.post(f"/v1/focus-sessions/{focus.json()['id']}/end", headers=auth_headers, json={})
    assert ended.status_code == 200, ended.text
    assert ended.json()["ended_at"] is not None


def test_focus_sessions_list_cursor_pagination(client: TestClient, auth_headers: dict[str, str]) -> None:
    for _ in range(2):
        started = client.post("/v1/focus-sessions/start", headers=auth_headers, json={})
        assert started.status_code == 201, started.text
        ended = client.post(f"/v1/focus-sessions/{started.json()['id']}/end", headers=auth_headers, json={})
        assert ended.status_code == 200, ended.text
    page1 = client.get("/v1/focus-sessions", headers=auth_headers, params={"limit": 1})
    assert page1.status_code == 200, page1.text
    body1 = page1.json()
    assert len(body1["items"]) == 1
    assert body1["next_cursor"]
    page2 = client.get("/v1/focus-sessions", headers=auth_headers, params={"limit": 1, "cursor": body1["next_cursor"]})
    assert page2.status_code == 200, page2.text


def test_goal_progress_push_payload_on_task_complete(client: TestClient, auth_headers: dict[str, str], monkeypatch) -> None:
    from unittest.mock import MagicMock

    captured: list[dict] = []

    def fake_send(db, settings, user_id, messages):  # noqa: ANN001
        captured.extend(messages)
        result = MagicMock()
        result.ok = 1
        return result

    monkeypatch.setattr("app.api.v1.core_routes.send_expo_push_batch", fake_send)
    monkeypatch.setattr("app.api.v1.core_routes.get_settings", lambda: Settings(notifications_enabled=True))

    goal = client.post("/v1/goals", headers=auth_headers, json={"title": "Push goal"})
    assert goal.status_code == 201, goal.text
    task = client.post(
        "/v1/tasks",
        headers=auth_headers,
        json={"title": "Push task", "goal_id": goal.json()["id"]},
    )
    assert task.status_code == 201, task.text
    client.post(
        "/v1/devices/push-token",
        headers=auth_headers,
        json={"expo_push_token": "ExponentPushToken[test]", "platform": "android"},
    )
    done = client.post(f"/v1/tasks/{task.json()['id']}/complete", headers=auth_headers)
    assert done.status_code == 200, done.text
    assert captured
    assert captured[0]["data"]["type"] == "goal_progress"
    assert captured[0]["data"]["goal_id"] == goal.json()["id"]


def test_transparency_log_cursor_pagination(client: TestClient, auth_headers: dict[str, str]) -> None:
    for index in range(3):
        client.post("/v1/tasks", headers=auth_headers, json={"title": f"Transparency task {index}"})
    page1 = client.get("/v1/transparency", headers=auth_headers, params={"limit": 2})
    assert page1.status_code == 200, page1.text
    body1 = page1.json()
    assert len(body1["items"]) == 2
    assert body1["next_cursor"]
    page2 = client.get("/v1/transparency", headers=auth_headers, params={"limit": 2, "cursor": body1["next_cursor"]})
    assert page2.status_code == 200, page2.text
    body2 = page2.json()
    assert body2["items"]
    assert {item["id"] for item in body1["items"]}.isdisjoint({item["id"] for item in body2["items"]})


def test_settings_validation_rejects_default_secret_in_deployed_env() -> None:
    settings = Settings(environment="production", jwt_secret=DEFAULT_JWT_SECRET)
    try:
        validate_settings_for_environment(settings)
    except RuntimeError as exc:
        assert "JWT_SECRET" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("expected deployed default secret to fail")
