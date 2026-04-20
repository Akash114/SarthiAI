from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


engine: Engine | None = None
SessionLocal: sessionmaker[Session] | None = None


def configure_engine(url: str | None = None) -> None:
    """(Re)bind engine and SessionLocal — used by tests and app startup."""
    global engine, SessionLocal
    settings = get_settings()
    url = url or settings.database_url
    engine = create_engine(
        url,
        pool_pre_ping=True,
        echo=False,
        pool_size=settings.database_pool_size,
        pool_timeout=settings.database_pool_timeout_seconds,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_engine() -> Engine:
    if engine is None:
        configure_engine()
    assert engine is not None
    return engine


def get_session_factory() -> sessionmaker[Session]:
    if SessionLocal is None:
        configure_engine()
    assert SessionLocal is not None
    return SessionLocal


def get_db() -> Generator[Session, None, None]:
    factory = get_session_factory()
    db = factory()
    try:
        yield db
    finally:
        db.close()
