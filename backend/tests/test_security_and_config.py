"""Config validation and auth rate-limiting behavior."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.config import DEFAULT_JWT_SECRET, Settings, validate_settings_for_environment


def test_validate_allows_default_jwt_when_not_deployed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.setenv("JWT_SECRET", DEFAULT_JWT_SECRET)
    s = Settings()
    validate_settings_for_environment(s)


def test_validate_rejects_default_jwt_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWT_SECRET", DEFAULT_JWT_SECRET)
    s = Settings()
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        validate_settings_for_environment(s)


def test_validate_rejects_short_jwt_in_staging(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "staging")
    monkeypatch.setenv("JWT_SECRET", "short")
    s = Settings()
    with pytest.raises(RuntimeError, match="32"):
        validate_settings_for_environment(s)


def test_validate_ok_for_staging_with_long_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "staging")
    monkeypatch.setenv("JWT_SECRET", "a" * 32)
    s = Settings()
    validate_settings_for_environment(s)


def test_register_rate_limited_after_burst(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import get_settings
    from app.services.auth_rate_limit import clear_buckets_for_tests

    monkeypatch.setenv("AUTH_RATE_LIMIT_PER_MINUTE", "2")
    get_settings.cache_clear()
    clear_buckets_for_tests()
    suffix = uuid.uuid4().hex[:8]
    for i in range(2):
        r = client.post(
            "/v1/auth/register",
            json={"email": f"rl{i}_{suffix}@t.dev", "password": "password123"},
        )
        assert r.status_code == 201, r.text
    r3 = client.post(
        "/v1/auth/register",
        json={"email": f"rl2_{suffix}@t.dev", "password": "password123"},
    )
    assert r3.status_code == 429
    assert r3.json()["code"] == "rate_limited"
    clear_buckets_for_tests()
