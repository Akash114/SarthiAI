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
    cors_origins: str = "http://localhost:8081,http://127.0.0.1:8081"


@lru_cache
def get_settings() -> Settings:
    return Settings()
