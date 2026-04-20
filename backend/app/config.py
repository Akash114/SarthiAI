from __future__ import annotations

import logging
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# Must match the default in Settings; used to reject shipping the dev default in deployed envs.
DEFAULT_JWT_SECRET = "dev-secret-change-me-in-production-min-32-chars!!"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/Sarthi"
    redis_url: str = "redis://127.0.0.1:6379/0"
    jwt_secret: str = DEFAULT_JWT_SECRET
    access_token_minutes: int = 30
    refresh_token_days: int = 30
    sentry_dsn: str | None = None
    sentry_worker_dsn: str | None = None
    sentry_traces_sample_rate: float = 0.1
    cors_origins: str = "http://localhost:8081,http://127.0.0.1:8081"
    environment: str | None = None
    log_level: str = "INFO"
    # When set, traces export to OTLP HTTP (staging/production); omit locally unless debugging.
    otel_exporter_otlp_traces_endpoint: str | None = None
    otel_traces_sample_ratio: float = 1.0
    # When true (and OTLP URL unset): TracerProvider + FastAPI instrumentation, spans discarded after export no-op.
    otel_instrument_without_export: bool = False
    otel_service_name: str = "sarthi-api"
    otel_worker_service_name: str = "sarthi-worker"
    # PostHog
    posthog_api_key: str | None = None
    posthog_host: str = "https://eu.i.posthog.com"
    # Connection tuning (production)
    database_pool_size: int = 5
    database_pool_timeout_seconds: int = 30
    redis_socket_timeout_seconds: float = 5.0
    # Planner (optional OpenAI)
    openai_api_key: str | None = None
    openai_planner_model: str = "gpt-4o-mini"
    # Push notifications (Expo)
    notifications_enabled: bool = False
    expo_push_url: str = "https://exp.host/--/api/v2/push/send"
    expo_access_token: str | None = None
    # APScheduler-driven jobs (optional second process)
    scheduler_enabled: bool = False
    scheduler_timezone: str = "UTC"
    weekly_job_day: int = 0  # Monday=0 in cron style for day_of_week? APScheduler: 0=Monday
    weekly_job_hour: int = 9
    weekly_job_minute: int = 0
    intervention_job_day: int = 3
    intervention_job_hour: int = 10
    intervention_job_minute: int = 0
    task_reminder_interval_minutes: int = 30
    task_reminder_lookahead_minutes: int = 720
    jobs_run_on_startup: bool = False
    # Ops / manual job triggers (header X-Ops-Key when set)
    ops_api_key: str | None = None
    debug: bool = False
    # Per-IP limits on unauthenticated auth routes (register/login/refresh). 0 = disabled.
    auth_rate_limit_per_minute: int = 30


@lru_cache
def get_settings() -> Settings:
    return Settings()


def _is_strict_deployed_environment(environment: str | None) -> bool:
    e = (environment or "").strip().lower()
    return e in ("production", "staging", "prod", "preview")


def validate_settings_for_environment(settings: Settings | None = None) -> None:
    """Fail fast in deployed environments when secrets are left at unsafe defaults.

    Call from API lifespan, worker, and scheduler entrypoints. Local/dev typically
    leaves ENVIRONMENT unset — validation is a no-op then.
    """
    s = settings or get_settings()
    if not _is_strict_deployed_environment(s.environment):
        return
    if s.jwt_secret == DEFAULT_JWT_SECRET:
        raise RuntimeError(
            "JWT_SECRET must not use the default value when ENVIRONMENT is set to a "
            f"deployed environment ({s.environment!r}). Set a unique secret "
            "(at least 32 characters)."
        )
    if len(s.jwt_secret) < 32:
        raise RuntimeError(
            "JWT_SECRET must be at least 32 characters when ENVIRONMENT indicates "
            f"a deployed environment ({s.environment!r})."
        )
    if s.debug:
        logger.warning(
            "DEBUG is true while ENVIRONMENT=%s; disable debug in real deployments",
            s.environment,
        )
