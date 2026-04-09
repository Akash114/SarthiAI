"""Tests for Expo push batch client."""
from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.models.notification_token import NotificationToken
from app.db.models.user import User
from app.services.notifications.expo_client import send_expo_push_batch


@pytest.fixture()
def db_session():
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
    NotificationToken.__table__.create(bind=engine)

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_send_expo_batch_all_ok(db_session):
    user_id = uuid4()
    db_session.add(User(id=user_id))
    db_session.commit()
    t1 = str(uuid4())
    t2 = str(uuid4())
    db_session.add(
        NotificationToken(user_id=user_id, token=t1, active=True),
    )
    db_session.add(
        NotificationToken(user_id=user_id, token=t2, active=True),
    )
    db_session.commit()

    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.json.return_value = {
        "data": [
            {"status": "ok", "id": "a"},
            {"status": "ok", "id": "b"},
        ]
    }

    with patch("app.services.notifications.expo_client.httpx.Client") as client_cls:
        client_inst = MagicMock()
        client_cls.return_value.__enter__.return_value = client_inst
        client_inst.post.return_value = fake_response

        messages = [
            {"to": t1, "title": "x", "body": "y"},
            {"to": t2, "title": "x", "body": "y"},
        ]
        result = send_expo_push_batch(db_session, user_id, messages)

    assert result.status == "sent"
    assert result.tokens_ok == 2
    assert result.tokens_deactivated == 0


def test_send_expo_batch_deactivates_invalid_token(db_session):
    user_id = uuid4()
    db_session.add(User(id=user_id))
    db_session.commit()
    good = "ExponentPushToken[good]"
    bad = "ExponentPushToken[bad]"
    db_session.add(NotificationToken(user_id=user_id, token=good, active=True))
    db_session.add(NotificationToken(user_id=user_id, token=bad, active=True))
    db_session.commit()

    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.json.return_value = {
        "data": [
            {"status": "ok", "id": "a"},
            {
                "status": "error",
                "message": "Invalid",
                "details": {"error": "DeviceNotRegistered"},
            },
        ]
    }

    with patch("app.services.notifications.expo_client.httpx.Client") as client_cls:
        client_inst = MagicMock()
        client_cls.return_value.__enter__.return_value = client_inst
        client_inst.post.return_value = fake_response

        messages = [
            {"to": good, "title": "x", "body": "y"},
            {"to": bad, "title": "x", "body": "y"},
        ]
        result = send_expo_push_batch(db_session, user_id, messages)

    assert result.status == "partial"
    assert result.tokens_ok == 1
    assert result.tokens_deactivated == 1

    db_session.expire_all()
    rows = db_session.query(NotificationToken).filter(NotificationToken.token == bad).all()
    assert rows[0].active is False


def test_send_expo_http_502_retryable(db_session):
    user_id = uuid4()
    db_session.add(User(id=user_id))
    db_session.commit()
    tok = "ExponentPushToken[x]"
    db_session.add(NotificationToken(user_id=user_id, token=tok, active=True))
    db_session.commit()

    fake_response = MagicMock()
    fake_response.status_code = 502
    fake_response.text = "bad gateway"

    with patch("app.services.notifications.expo_client.httpx.Client") as client_cls:
        client_inst = MagicMock()
        client_cls.return_value.__enter__.return_value = client_inst
        client_inst.post.return_value = fake_response

        result = send_expo_push_batch(db_session, user_id, [{"to": tok, "title": "t", "body": "b"}])

    assert result.status == "failed"
    assert result.retryable is True
