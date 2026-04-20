from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/Sarthi"
    redis_url: str = "redis://127.0.0.1:6379/0"
    jwt_secret: str = "dev-secret-change-me-in-production-min-32-chars!!"
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


@lru_cache
def get_settings() -> Settings:
    return Settings()
