from __future__ import annotations

import logging
import uuid

import pytest

logging.getLogger("httpx").setLevel(logging.WARNING)
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.db as db_mod
from app.config import get_settings
from app.db import Base, get_db
from app.main import create_app


@pytest.fixture(autouse=True)
def _settings_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET", "test-jwt-secret-at-least-32-characters-long")
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("REDIS_URL", "redis://127.0.0.1:6379/15")
    monkeypatch.setenv("OTEL_SDK_DISABLED", "true")
    get_settings.cache_clear()


@pytest.fixture
def engine(_settings_env: None):
    import app.models  # noqa: F401 — register ORM tables with Base.metadata

    eng = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)


@pytest.fixture
def client(engine, monkeypatch: pytest.MonkeyPatch):
    get_settings.cache_clear()
    db_mod.engine = engine
    db_mod.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    class _InlineQueue:
        def enqueue(self, fn, *args, **kwargs):
            job_meta = kwargs.pop("meta", None) or {}
            job_timeout = kwargs.pop("job_timeout", None)
            _ = job_timeout
            assert not kwargs, kwargs
            # Simulate RQ passing only positional args to the job function
            fn(*args)

            class _J:
                id = "inline-job"

            j = _J()
            j.meta = job_meta
            return j

    monkeypatch.setattr("app.api.v1.core_routes.task_queue", lambda: _InlineQueue())

    app = create_app()

    def _override_db():
        factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    db_mod.engine = None
    db_mod.SessionLocal = None
    get_settings.cache_clear()


@pytest.fixture
def auth_headers(client: TestClient) -> dict[str, str]:
    email = f"u_{uuid.uuid4().hex[:8]}@test.dev"
    r = client.post(
        "/v1/auth/register",
        json={"email": email, "password": "password123"},
    )
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
