"""RQ worker entrypoint: `python -m app.worker` from backend directory."""

from rq import Worker

from app.config import get_settings
from app.observability.logging_json import configure_logging
from app.observability.otel_setup import setup_tracing
from app.observability.sentry_setup import init_sentry_worker
from app.queue import redis_connection, task_queue


def main() -> None:
    s = get_settings()
    configure_logging(s.log_level)
    setup_tracing(
        service_name=s.otel_worker_service_name,
        otlp_endpoint=s.otel_exporter_otlp_traces_endpoint,
        sample_ratio=s.otel_traces_sample_ratio,
        instrument_without_export=s.otel_instrument_without_export,
    )
    worker_dsn = s.sentry_worker_dsn or s.sentry_dsn
    if worker_dsn:
        init_sentry_worker(
            dsn=worker_dsn,
            environment=s.environment,
            traces_sample_rate=s.sentry_traces_sample_rate,
        )
    w = Worker([task_queue()], connection=redis_connection())
    w.work()


if __name__ == "__main__":
    main()
