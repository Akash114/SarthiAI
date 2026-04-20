from __future__ import annotations

import os

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SpanExporter, SpanExportResult
from opentelemetry.sdk.trace.sampling import ParentBased, TraceIdRatioBased

_tracing_enabled = False


class _DiscardSpanExporter(SpanExporter):
    """Keeps spans in-process for context/trace_id logs without sending OTLP."""

    def export(self, spans):  # noqa: ANN001
        return SpanExportResult.SUCCESS

    def shutdown(self) -> None:
        return None

    def force_flush(self, timeout_millis: float = 30000) -> bool:
        return True


def _clamp_ratio(r: float) -> float:
    if r < 0.0:
        return 0.0
    if r > 1.0:
        return 1.0
    return r


def setup_tracing(
    *,
    service_name: str,
    otlp_endpoint: str | None,
    sample_ratio: float,
    instrument_without_export: bool = False,
) -> None:
    """Configure TracerProvider: OTLP export, or in-process only (no export), or skip."""
    global _tracing_enabled
    if os.environ.get("OTEL_SDK_DISABLED", "").lower() in ("1", "true", "yes"):
        return

    ratio = _clamp_ratio(sample_ratio)
    sampler = ParentBased(root=TraceIdRatioBased(ratio))
    resource = Resource.create({"service.name": service_name})

    if otlp_endpoint:
        provider = TracerProvider(resource=resource, sampler=sampler)
        exporter = OTLPSpanExporter(endpoint=otlp_endpoint)
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)
        _tracing_enabled = True
        return

    if instrument_without_export:
        provider = TracerProvider(resource=resource, sampler=sampler)
        provider.add_span_processor(BatchSpanProcessor(_DiscardSpanExporter()))
        trace.set_tracer_provider(provider)
        _tracing_enabled = True


def instrument_fastapi(app) -> None:
    if os.environ.get("OTEL_SDK_DISABLED", "").lower() in ("1", "true", "yes"):
        return
    if not _tracing_enabled:
        return
    FastAPIInstrumentor.instrument_app(app)
