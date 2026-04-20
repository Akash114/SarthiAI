"""Per-client rate limiting for unauthenticated auth routes (in-process).

Suitable for a single API instance; for horizontal scale, replace with a shared
store (e.g. Redis) and the same keying scheme.
"""

from __future__ import annotations

import logging
import time
from threading import Lock
from typing import Final

from fastapi import Request

from app.api.exceptions import ApiError
from app.api.v1.deps import _rid
from app.config import get_settings

logger = logging.getLogger(__name__)

_lock: Final[Lock] = Lock()
# key -> list of request timestamps (monotonic) in the current window
_buckets: dict[str, list[float]] = {}
_WINDOW_SECONDS: Final[float] = 60.0


def clear_buckets_for_tests() -> None:
    """Reset state (pytest)."""
    with _lock:
        _buckets.clear()


def enforce_auth_rate_limit(request: Request, route_key: str) -> None:
    """Raise ApiError 429 if this client exceeded the configured limit for this route."""
    settings = get_settings()
    limit = settings.auth_rate_limit_per_minute
    if limit <= 0:
        return

    client = request.client
    host = client.host if client else "unknown"
    key = f"{host}:{route_key}"

    now = time.monotonic()
    with _lock:
        window_start = now - _WINDOW_SECONDS
        timestamps = [t for t in _buckets.get(key, []) if t > window_start]
        if len(timestamps) >= limit:
            rid = _rid(request)
            logger.warning(
                "auth_rate_limit_exceeded",
                extra={"request_id": rid, "route_key": route_key, "client_host": host},
            )
            raise ApiError(
                429,
                code="rate_limited",
                message="Too many requests. Try again later.",
                request_id=rid,
            )
        timestamps.append(now)
        _buckets[key] = timestamps
