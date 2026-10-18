import os
from pathlib import Path

DATABASE_DIR = Path(__file__).resolve().parent
_DEFAULT_DATABASE_PATH = DATABASE_DIR / "bhoomi_rakshak.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_DEFAULT_DATABASE_PATH.as_posix()}")


def database_path() -> Path:
    """Return the local SQLite path when using the default database."""
    return _DEFAULT_DATABASE_PATH
