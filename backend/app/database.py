"""Backward-compatible imports for the dedicated database package."""

try:
    from database import Base, DATABASE_URL, SessionLocal, engine, get_db, init_db
except ModuleNotFoundError:
    from ..database import Base, DATABASE_URL, SessionLocal, engine, get_db, init_db

__all__ = [
    "Base",
    "DATABASE_URL",
    "SessionLocal",
    "engine",
    "get_db",
    "init_db",
]
