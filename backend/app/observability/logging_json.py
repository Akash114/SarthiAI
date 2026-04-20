from __future__ import annotations

import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any

from opentelemetry import trace

from app.observability.context import request_id_ctx, user_id_ctx


class JsonLogFormatter(logging.Formatter):
    """Structured logs per ADR 0008: timestamp, level, message, request_id, optional user_id."""

    def format(self, record: logging.LogRecord) -> str:
        ts = datetime.fromtimestamp(record.created, tz=UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        payload: dict[str, Any] = {
            "timestamp": ts,
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
        }
        rid = getattr(record, "request_id", None) or request_id_ctx.get()
        if rid:
            payload["request_id"] = rid
        uid = getattr(record, "user_id", None) or user_id_ctx.get()
        if uid:
            payload["user_id"] = uid
        span = trace.get_current_span()
        ctx = span.get_span_context() if span else None
        if ctx and ctx.is_valid:
            payload["trace_id"] = format(ctx.trace_id, "032x")
        rid_extra = getattr(record, "resolution_id", None)
        if rid_extra:
            payload["resolution_id"] = rid_extra
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str | None = None) -> None:
    root = logging.getLogger()
    if level:
        root.setLevel(level)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonLogFormatter())
    root.handlers.clear()
    root.addHandler(handler)
    logging.captureWarnings(True)
