from contextlib import contextmanager
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.engine import Connection

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()
    return create_engine(
        settings.sqlalchemy_url,
        pool_size=10,
        max_overflow=0,
        pool_timeout=30,
        pool_recycle=1800,
        fast_executemany=True,
    )


@contextmanager
def get_conn():
    """One connection per call-site, auto-committed, mirrors the Node `mssql` pool usage."""
    engine = get_engine()
    with engine.connect() as conn:
        yield conn
        conn.commit()
