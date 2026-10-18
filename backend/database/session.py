from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from .config import DATABASE_URL

_url = make_url(DATABASE_URL)
_connect_args = {"check_same_thread": False} if _url.drivername == "sqlite" else {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables for all imported application models."""
    try:
        from app import models
    except ModuleNotFoundError:
        from backend.app import models

    models.Base.metadata.create_all(bind=engine)
