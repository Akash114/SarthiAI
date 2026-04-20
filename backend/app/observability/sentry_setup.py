from __future__ import annotations

import logging
from typing import Any

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration


def _scrub_event(event: dict[str, Any], _hint: dict[str, Any]) -> dict[str, Any] | None:
    """Strip auth headers and cookies from Sentry payloads (ADR 0007)."""
    req = event.get("request")
    if isinstance(req, dict):
        headers = req.get("headers")
        if isinstance(headers, dict):
            for k in list(headers.keys()):
                lk = k.lower()
                if lk in ("authorization", "cookie", "set-cookie"):
                    headers[k] = "[redacted]"
    return event


def init_sentry_api(*, dsn: str, environment: str | None, traces_sample_rate: float) -> None:
    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        integrations=[
            FastApiIntegration(),
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ],
        traces_sample_rate=traces_sample_rate,
        before_send=_scrub_event,
    )


def init_sentry_worker(*, dsn: str, environment: str | None, traces_sample_rate: float) -> None:
    from sentry_sdk.integrations.rq import RqIntegration

    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        integrations=[RqIntegration(), LoggingIntegration(level=logging.INFO, event_level=logging.ERROR)],
        traces_sample_rate=traces_sample_rate,
        before_send=_scrub_event,
    )
