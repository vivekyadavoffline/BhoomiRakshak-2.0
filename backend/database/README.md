# Database layer

This package owns the SQLAlchemy engine, session factory, declarative base, and database initialization for Bhoomi Rakshak.

## Local database

By default, the API uses SQLite at `backend/database/bhoomi_rakshak.db`. The file is ignored by Git. Set `DATABASE_URL` to use another SQLAlchemy-supported database.

## Usage

Start the API from `backend/`:

```powershell
uvicorn app.main:app --reload
```

Tables are created automatically during FastAPI startup after the application models are imported. Existing imports from `app.database` remain supported for seed scripts and older modules.
