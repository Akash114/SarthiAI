from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.deps import get_db
from app.db.models.agent_action_log import AgentActionLog
from app.db.models.user import User
from app.db.models.user_preferences import UserPreferences
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
    def set_fk(conn, record):  # pragma: no cover
        cursor = conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    User.__table__.create(bind=engine)
    UserPreferences.__table__.create(bind=engine)
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


def _seed_user(session_factory):
    session = session_factory()
    try:
        user_id = uuid4()
        session.add(User(id=user_id))
        session.commit()
        return user_id
    finally:
        session.close()


def test_get_preferences_creates_defaults(client):
    test_client, session_factory = client
    user_id = _seed_user(session_factory)
    resp = test_client.get("/preferences", params={"user_id": str(user_id)})
    assert resp.status_code == 200
    data = resp.json()
    assert data["coaching_paused"] is False
    assert data["weekly_plans_enabled"] is True
    assert data["interventions_enabled"] is True
    assert data["request_id"]


def test_patch_updates_and_logs(client):
    test_client, session_factory = client
    user_id = _seed_user(session_factory)
    # create defaults
    test_client.get("/preferences", params={"user_id": str(user_id)})
    resp = test_client.patch(
        "/preferences",
        json={"user_id": str(user_id), "coaching_paused": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["coaching_paused"] is True
    assert data["request_id"]

    session = session_factory()
    try:
        log = session.query(AgentActionLog).one()
        assert log.action_payload["changes"]["coaching_paused"] is True
    finally:
        session.close()


def test_patch_no_changes_does_not_log(client):
    test_client, session_factory = client
    user_id = _seed_user(session_factory)
    test_client.get("/preferences", params={"user_id": str(user_id)})
    resp = test_client.patch(
        "/preferences",
        json={"user_id": str(user_id)},
    )
    assert resp.status_code == 200
    session = session_factory()
    try:
        count = session.query(AgentActionLog).count()
        assert count == 0
    finally:
        session.close()
