"""Auth: register, login, refresh, merge, Bearer on preferences."""
from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.db.deps import get_db
from app.db.models.agent_action_log import AgentActionLog
from app.db.models.auth_identity import AuthIdentity
from app.db.models.brain_dump import BrainDump
from app.db.models.notification_token import NotificationToken
from app.db.models.refresh_token import RefreshToken
from app.db.models.resolution import Resolution
from app.db.models.task import Task
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
    def set_sqlite_pragma(conn, _record):  # pragma: no cover
        cur = conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    User.__table__.create(bind=engine)
    AuthIdentity.__table__.create(bind=engine)
    RefreshToken.__table__.create(bind=engine)
    Resolution.__table__.create(bind=engine)
    Task.__table__.create(bind=engine)
    BrainDump.__table__.create(bind=engine)
    AgentActionLog.__table__.create(bind=engine)
    UserPreferences.__table__.create(bind=engine)
    NotificationToken.__table__.create(bind=engine)

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


def test_register_login_refresh_me_logout(client, monkeypatch):
    monkeypatch.setenv("AUTH_LEGACY_ALLOW_UNAUTHENTICATED", "true")
    get_settings.cache_clear()
    test_client, _ = client

    r = test_client.post(
        "/auth/register",
        json={"email": "user@example.com", "password": "longpassword1"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["user_id"]
    access = body["access_token"]
    refresh = body["refresh_token"]

    r2 = test_client.post("/auth/login", json={"email": "user@example.com", "password": "wrong"})
    assert r2.status_code == 401

    r3 = test_client.get("/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert r3.status_code == 200
    assert r3.json()["email"] == "user@example.com"

    r4 = test_client.post("/auth/refresh", json={"refresh_token": refresh})
    assert r4.status_code == 200
    refresh2 = r4.json()["refresh_token"]
    assert refresh2 != refresh

    r5 = test_client.post("/auth/logout", json={"refresh_token": refresh2})
    assert r5.status_code == 204

    r6 = test_client.post("/auth/refresh", json={"refresh_token": refresh2})
    assert r6.status_code == 401


def test_register_duplicate_email(client, monkeypatch):
    monkeypatch.setenv("AUTH_LEGACY_ALLOW_UNAUTHENTICATED", "true")
    get_settings.cache_clear()
    test_client, _ = client
    payload = {"email": "dup@example.com", "password": "longpassword1"}
    assert test_client.post("/auth/register", json=payload).status_code == 201
    r = test_client.post("/auth/register", json=payload)
    assert r.status_code == 409


def test_merge_anonymous_moves_data(client, monkeypatch):
    monkeypatch.setenv("AUTH_LEGACY_ALLOW_UNAUTHENTICATED", "true")
    get_settings.cache_clear()
    test_client, session_factory = client

    anon_id = uuid4()
    session = session_factory()
    try:
        session.add(User(id=anon_id))
        session.flush()
        session.add(
            BrainDump(id=uuid4(), user_id=anon_id, body="note", signals_extracted={}, actionable=False)
        )
        session.commit()
    finally:
        session.close()

    reg = test_client.post(
        "/auth/register",
        json={"email": "merge@example.com", "password": "longpassword1"},
    )
    assert reg.status_code == 201
    auth_uid = reg.json()["user_id"]
    access = reg.json()["access_token"]

    r = test_client.post(
        "/auth/merge-anonymous",
        json={"anonymous_user_id": str(anon_id)},
        headers={"Authorization": f"Bearer {access}"},
    )
    assert r.status_code == 200
    assert r.json()["merged"] is True

    session = session_factory()
    try:
        assert session.get(User, anon_id) is None
        bd = session.query(BrainDump).one()
        assert bd.user_id == UUID(auth_uid)
    finally:
        session.close()

    r2 = test_client.post(
        "/auth/merge-anonymous",
        json={"anonymous_user_id": str(anon_id)},
        headers={"Authorization": f"Bearer {access}"},
    )
    assert r2.status_code == 200
    assert r2.json()["merged"] is False


def test_preferences_requires_auth_when_legacy_off(client, monkeypatch):
    monkeypatch.setenv("AUTH_LEGACY_ALLOW_UNAUTHENTICATED", "false")
    get_settings.cache_clear()
    test_client, _ = client

    uid = str(uuid4())
    r = test_client.get("/preferences", params={"user_id": uid})
    assert r.status_code == 401

    monkeypatch.setenv("AUTH_LEGACY_ALLOW_UNAUTHENTICATED", "true")
    get_settings.cache_clear()
