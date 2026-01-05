from __future__ import annotations

from datetime import date, time
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.deps import get_db
from app.db.models.agent_action_log import AgentActionLog
from app.db.models.resolution import Resolution
from app.db.models.task import Task
from app.db.models.user import User
from app.main import app


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):  # pragma: no cover - sqlite setup
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    User.__table__.create(bind=engine)
    Resolution.__table__.create(bind=engine)
    Task.__table__.create(bind=engine)
    AgentActionLog.__table__.create(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client, TestingSessionLocal
    app.dependency_overrides.clear()


def _create_resolution(test_client: TestClient, *, duration_weeks: int | None = 8) -> tuple[UUID, UUID]:
    user_id = uuid4()
    payload = {
        "user_id": str(user_id),
        "text": "Build a mindful morning routine to support focus.",
        "duration_weeks": duration_weeks,
    }
    response = test_client.post("/resolutions", json=payload)
    assert response.status_code == 201
    data = response.json()
    return UUID(data["id"]), user_id


def _create_and_decompose(test_client: TestClient, duration_weeks: int | None = 8):
    resolution_id, user_id = _create_resolution(test_client, duration_weeks=duration_weeks)
    response = test_client.post(f"/resolutions/{resolution_id}/decompose")
    assert response.status_code == 200
    tasks = response.json()["week_1_tasks"]
    return resolution_id, user_id, tasks


def test_accept_approval_activates_resolution_and_tasks(client):
    test_client, session_factory = client
    resolution_id, user_id, tasks = _create_and_decompose(test_client, duration_weeks=6)

    edit_task = tasks[0]
    payload = {
        "user_id": str(user_id),
        "decision": "accept",
        "task_edits": [
            {
                "task_id": edit_task["id"],
                "scheduled_day": "2024-01-03",
                "scheduled_time": "09:00",
                "duration_min": 35,
            }
        ],
    }
    response = test_client.post(f"/resolutions/{resolution_id}/approve", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "active"
    assert len(data["tasks_activated"]) == len(tasks)

    with session_factory() as db:
        resolution = db.get(Resolution, resolution_id)
        assert resolution.status == "active"
        stored_tasks = db.query(Task).filter(Task.resolution_id == resolution_id).all()
        assert all((task.metadata_json or {}).get("draft") is False for task in stored_tasks)
        edited_task = next(task for task in stored_tasks if str(task.id) == edit_task["id"])
        assert edited_task.scheduled_day == date(2024, 1, 3)
        assert edited_task.scheduled_time == time(9, 0)
        assert edited_task.duration_min == 35
        logs = db.query(AgentActionLog).filter(AgentActionLog.user_id == user_id).all()
        assert len(logs) == 1
        assert logs[0].action_type == "resolution_approved"
        assert logs[0].undo_available is True


def test_accept_without_decomposition_returns_conflict(client):
    test_client, session_factory = client
    resolution_id, user_id = _create_resolution(test_client)
    payload = {"user_id": str(user_id), "decision": "accept"}
    response = test_client.post(f"/resolutions/{resolution_id}/approve", json=payload)
    assert response.status_code == 409

    with session_factory() as db:
        resolution = db.get(Resolution, resolution_id)
        assert resolution.status == "draft"


def test_reject_keeps_resolution_in_draft_and_logs_action(client):
    test_client, session_factory = client
    resolution_id, user_id, _ = _create_and_decompose(test_client)
    payload = {"user_id": str(user_id), "decision": "reject"}
    response = test_client.post(f"/resolutions/{resolution_id}/approve", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "draft"

    with session_factory() as db:
        resolution = db.get(Resolution, resolution_id)
        assert resolution.status == "draft"
        tasks = db.query(Task).filter(Task.resolution_id == resolution_id).all()
        assert all((task.metadata_json or {}).get("draft") is True for task in tasks)
        logs = db.query(AgentActionLog).filter(AgentActionLog.user_id == user_id).all()
        assert len(logs) == 1
        assert logs[0].action_type == "resolution_rejected"
        assert logs[0].undo_available is False


def test_request_id_echo_on_approval(client):
    test_client, _ = client
    resolution_id, user_id, _ = _create_and_decompose(test_client)
    req_id = "req-approval-001"
    payload = {"user_id": str(user_id), "decision": "regenerate"}
    response = test_client.post(
        f"/resolutions/{resolution_id}/approve",
        json=payload,
        headers={"X-Request-Id": req_id},
    )
    assert response.status_code == 200
    assert response.headers.get("X-Request-Id") == req_id


def test_approval_succeeds_when_observability_disabled(monkeypatch, client):
    test_client, session_factory = client
    resolution_id, user_id, _ = _create_and_decompose(test_client)

    import app.observability.client as opik_client

    monkeypatch.setattr(opik_client, "get_opik_client", lambda: None)

    payload = {"user_id": str(user_id), "decision": "regenerate"}
    response = test_client.post(f"/resolutions/{resolution_id}/approve", json=payload)
    assert response.status_code == 200


def test_task_edits_invalid_task_ids_rejected(client):
    test_client, session_factory = client
    resolution_a, user_a, _ = _create_and_decompose(test_client)
    resolution_b, user_b, tasks_b = _create_and_decompose(test_client)

    invalid_task_id = tasks_b[0]["id"]
    payload = {
        "user_id": str(user_a),
        "decision": "accept",
        "task_edits": [
            {
                "task_id": invalid_task_id,
                "scheduled_day": "2024-02-01",
            }
        ],
    }
    response = test_client.post(f"/resolutions/{resolution_a}/approve", json=payload)
    assert response.status_code == 400
    assert invalid_task_id in response.json()["detail"]

    with session_factory() as db:
        resolution = db.get(Resolution, resolution_a)
        assert resolution.status == "draft"
        logs = db.query(AgentActionLog).filter(AgentActionLog.user_id == user_a).all()
        assert not logs


def test_accept_requires_draft_tasks_present(client):
    test_client, session_factory = client
    resolution_id, user_id, _ = _create_and_decompose(test_client)

    with session_factory() as db:
        tasks = db.query(Task).filter(Task.resolution_id == resolution_id).all()
        for task in tasks:
            metadata = dict(task.metadata_json or {})
            metadata["draft"] = False
            task.metadata_json = metadata
        db.commit()

    payload = {"user_id": str(user_id), "decision": "accept"}
    response = test_client.post(f"/resolutions/{resolution_id}/approve", json=payload)
    assert response.status_code == 409
    assert "No draft tasks" in response.json()["detail"]


def test_approval_atomicity_rolls_back_on_failure(monkeypatch, client):
    test_client, session_factory = client
    resolution_id, user_id, tasks = _create_and_decompose(test_client)

    import app.api.routes.resolution as resolution_routes

    def explode(tasks, activated_at):
        raise RuntimeError("boom")

    monkeypatch.setattr(resolution_routes, "_activate_tasks", explode)

    payload = {"user_id": str(user_id), "decision": "accept", "task_edits": []}
    with pytest.raises(RuntimeError):
        test_client.post(f"/resolutions/{resolution_id}/approve", json=payload)

    with session_factory() as db:
        resolution = db.get(Resolution, resolution_id)
        assert resolution.status == "draft"
        stored_tasks = db.query(Task).filter(Task.resolution_id == resolution_id).all()
        assert all((task.metadata_json or {}).get("draft") is True for task in stored_tasks)
        logs = db.query(AgentActionLog).filter(AgentActionLog.user_id == user_id).all()
        assert not logs


def test_reapproval_returns_conflict_without_extra_logs(client):
    test_client, session_factory = client
    resolution_id, user_id, _ = _create_and_decompose(test_client)
    payload = {"user_id": str(user_id), "decision": "accept"}
    assert test_client.post(f"/resolutions/{resolution_id}/approve", json=payload).status_code == 200

    response = test_client.post(f"/resolutions/{resolution_id}/approve", json=payload)
    assert response.status_code == 409

    with session_factory() as db:
        logs = db.query(AgentActionLog).filter(AgentActionLog.user_id == user_id).all()
        assert len(logs) == 1


def test_reject_and_regenerate_keep_draft_and_log_payload(client):
    test_client, session_factory = client
    resolution_id, user_id, _ = _create_and_decompose(test_client)
    req_id_reject = "req-reject-1"
    payload_reject = {"user_id": str(user_id), "decision": "reject"}
    resp_reject = test_client.post(
        f"/resolutions/{resolution_id}/approve",
        json=payload_reject,
        headers={"X-Request-Id": req_id_reject},
    )
    assert resp_reject.status_code == 200

    payload_regen = {"user_id": str(user_id), "decision": "regenerate"}
    resp_regen = test_client.post(
        f"/resolutions/{resolution_id}/approve",
        json=payload_regen,
        headers={"X-Request-Id": "req-regen-1"},
    )
    assert resp_regen.status_code == 200

    with session_factory() as db:
        resolution = db.get(Resolution, resolution_id)
        assert resolution.status == "draft"
        tasks = db.query(Task).filter(Task.resolution_id == resolution_id).all()
        assert all((task.metadata_json or {}).get("draft") is True for task in tasks)
        logs = db.query(AgentActionLog).filter(AgentActionLog.user_id == user_id).order_by(AgentActionLog.created_at).all()
        assert len(logs) == 2
        assert logs[0].action_type == "resolution_rejected"
        assert logs[0].action_payload.get("decision") == "reject"
        assert logs[0].action_payload.get("request_id") == req_id_reject
        assert logs[1].action_type == "resolution_regenerate_requested"
        assert logs[1].action_payload.get("decision") == "regenerate"


def test_accept_response_includes_request_id_and_edits(client):
    test_client, session_factory = client
    resolution_id, user_id, tasks = _create_and_decompose(test_client)
    edit_task = tasks[1]
    req_id = "req-accept-meta"
    payload = {
        "user_id": str(user_id),
        "decision": "accept",
        "task_edits": [
            {
                "task_id": edit_task["id"],
                "scheduled_day": "2024-02-02",
                "scheduled_time": "10:15",
                "duration_min": 40,
            }
        ],
    }
    response = test_client.post(
        f"/resolutions/{resolution_id}/approve",
        json=payload,
        headers={"X-Request-Id": req_id},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["request_id"] == req_id
    assert response.headers.get("X-Request-Id") == req_id
    assert body["status"] == "active"
    activated = {task["id"]: task for task in body["tasks_activated"]}
    edited = activated[edit_task["id"]]
    assert edited["scheduled_day"] == "2024-02-02"
    assert edited["scheduled_time"] == "10:15:00"
    assert edited["duration_min"] == 40
