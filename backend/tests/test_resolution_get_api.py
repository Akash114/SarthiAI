from __future__ import annotations

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


def _create_resolution(
    test_client: TestClient,
    *,
    duration_weeks: int | None = 8,
    user_id: UUID | None = None,
) -> tuple[UUID, UUID]:
    actual_user = user_id or uuid4()
    payload = {
        "user_id": str(actual_user),
        "text": "Build a mindful morning routine to support focus.",
        "duration_weeks": duration_weeks,
    }
    response = test_client.post("/resolutions", json=payload)
    assert response.status_code == 201
    data = response.json()
    return UUID(data["id"]), actual_user


def _create_and_decompose(
    test_client: TestClient,
    *,
    duration_weeks: int | None = 8,
    user_id: UUID | None = None,
) -> tuple[UUID, UUID]:
    resolution_id, actual_user = _create_resolution(test_client, duration_weeks=duration_weeks, user_id=user_id)
    resp = test_client.post(f"/resolutions/{resolution_id}/decompose")
    assert resp.status_code == 200
    return resolution_id, actual_user


def test_get_resolution_returns_plan_and_draft_tasks(client):
    test_client, _ = client
    resolution_id, user_id = _create_and_decompose(test_client, duration_weeks=6)

    response = test_client.get(f"/resolutions/{resolution_id}", params={"user_id": str(user_id)})
    assert response.status_code == 200
    data = response.json()
    assert data["plan"]["weeks"] == 6
    assert data["draft_tasks"]
    assert data["request_id"]


def test_get_resolution_forbidden_for_other_user(client):
    test_client, _ = client
    resolution_id, user_id = _create_and_decompose(test_client)

    response = test_client.get(f"/resolutions/{resolution_id}", params={"user_id": str(uuid4())})
    assert response.status_code == 403

    ok_response = test_client.get(f"/resolutions/{resolution_id}", params={"user_id": str(user_id)})
    assert ok_response.status_code == 200


def test_reject_preserves_plan_and_tasks(client):
    test_client, _ = client
    resolution_id, user_id = _create_and_decompose(test_client)

    reject_payload = {"user_id": str(user_id), "decision": "reject"}
    assert test_client.post(f"/resolutions/{resolution_id}/approve", json=reject_payload).status_code == 200

    response = test_client.get(f"/resolutions/{resolution_id}", params={"user_id": str(user_id)})
    data = response.json()
    assert data["status"] == "draft"
    assert data["plan"]
    assert data["draft_tasks"]


def test_regenerate_updates_plan(client):
    test_client, _ = client
    resolution_id, user_id = _create_and_decompose(test_client)

    first = test_client.get(f"/resolutions/{resolution_id}", params={"user_id": str(user_id)}).json()
    assert first["plan"]["weeks"] == 8

    regen_response = test_client.post(
        f"/resolutions/{resolution_id}/decompose",
        json={"regenerate": True, "weeks": 5},
    )
    assert regen_response.status_code == 200

    refreshed = test_client.get(f"/resolutions/{resolution_id}", params={"user_id": str(user_id)}).json()
    assert refreshed["plan"]["weeks"] == 5


def test_list_resolutions_filters_by_status(client):
    test_client, _ = client
    draft_resolution, user_id = _create_and_decompose(test_client)
    active_resolution, _ = _create_and_decompose(test_client, user_id=user_id)

    approve_payload = {"user_id": str(user_id), "decision": "accept"}
    assert test_client.post(f"/resolutions/{active_resolution}/approve", json=approve_payload).status_code == 200

    all_resp = test_client.get("/resolutions", params={"user_id": str(user_id)})
    assert all_resp.status_code == 200
    all_data = all_resp.json()
    assert len(all_data) == 2

    draft_resp = test_client.get("/resolutions", params={"user_id": str(user_id), "status": "draft"})
    assert len(draft_resp.json()) == 1

    active_resp = test_client.get("/resolutions", params={"user_id": str(user_id), "status": "active"})
    active_data = active_resp.json()
    assert len(active_data) == 1
    assert active_data[0]["status"] == "active"

    detail_active = test_client.get(f"/resolutions/{active_resolution}", params={"user_id": str(user_id)}).json()
    assert detail_active["active_tasks"]
    assert not detail_active["draft_tasks"]
