from __future__ import annotations

from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator


def traceparent_from_context() -> str | None:
    """Serialize current trace context for RQ job meta (ADR 0008 correlation)."""
    carrier: dict[str, str] = {}
    TraceContextTextMapPropagator().inject(carrier)
    return carrier.get("traceparent")
