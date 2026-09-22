"""SQLAlchemy engine, session factory and declarative base.

The engine configuration is deliberately driver-agnostic so the same code runs
on SQLite today and PostgreSQL after migration -- only ``NNM_DATABASE_URL``
changes.
"""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

connect_args: dict[str, object] = {}
engine_kwargs: dict[str, object] = {"pool_pre_ping": True, "future": True}

if settings.is_sqlite:
    # ``check_same_thread`` is required because FastAPI runs sync endpoints in
    # a thread pool; SQLite otherwise refuses cross-thread connection reuse.
    connect_args["check_same_thread"] = False
else:
    engine_kwargs.update({"pool_size": 10, "max_overflow": 20})

engine = create_engine(settings.database_url, connect_args=connect_args, **engine_kwargs)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)


class Base(DeclarativeBase):
    """Declarative base shared by every ORM model."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a request-scoped database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables. Safe to call repeatedly."""
    from app import models  # noqa: F401  (import registers the mappers)

    Base.metadata.create_all(bind=engine)
