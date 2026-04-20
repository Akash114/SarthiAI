from __future__ import annotations

import atexit
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from posthog import Posthog
from sqlalchemy import text

from app.api.exceptions import ApiError, api_error_handler
from app.api.v1.router import v1_router
from app.config import get_settings
from app.db import get_engine
from app.observability.context import request_id_ctx
from app.observability.logging_json import configure_logging
from app.observability.otel_setup import instrument_fastapi, setup_tracing
from app.observability.sentry_setup import init_sentry_api
from app.queue import redis_connection

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    if settings.posthog_api_key:
        posthog_client = Posthog(
            settings.posthog_api_key,
            host=settings.posthog_host,
            enable_exception_autocapture=True,
        )
        _app.state.posthog = posthog_client
        atexit.register(posthog_client.shutdown)
    else:
        _app.state.posthog = None
    yield
    if _app.state.posthog is not None:
        _app.state.posthog.flush()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    setup_tracing(
        service_name=settings.otel_service_name,
        otlp_endpoint=settings.otel_exporter_otlp_traces_endpoint,
        sample_ratio=settings.otel_traces_sample_ratio,
        instrument_without_export=settings.otel_instrument_without_export,
    )

    app = FastAPI(title="Sarthi API", lifespan=lifespan)

    if settings.sentry_dsn:
        init_sentry_api(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            traces_sample_rate=settings.sentry_traces_sample_rate,
        )

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        rid = str(uuid.uuid4())
        request.state.request_id = rid
        token = request_id_ctx.set(rid)
        try:
            response = await call_next(request)
            response.headers["X-Request-Id"] = rid
            return response
        finally:
            request_id_ctx.reset(token)

    @app.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/ready", tags=["health"])
    def ready() -> dict[str, str]:
        try:
            with get_engine().connect() as conn:
                conn.execute(text("SELECT 1"))
            redis_connection().ping()
        except Exception:
            logger.exception("readiness_failed")
            raise HTTPException(status_code=503, detail={"status": "not_ready"})
        return {"status": "ready"}

    app.add_exception_handler(ApiError, api_error_handler)

    app.include_router(v1_router, prefix="/v1")

    instrument_fastapi(app)
    return app


app = create_app()
