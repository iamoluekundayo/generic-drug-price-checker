"""Database setup: engine, session factory, request dependency and model base class.

Reads ``DATABASE_URL`` from ``.env``, falling back to a local SQLite file.
Set ``SQL_ECHO=true`` in ``.env`` to print every SQL statement while debugging.
"""

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

echo = os.getenv("SQL_ECHO", "false").lower() == "true"

# Optional: falls back to a local SQLite file when not set.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")

# SQLite only lets a connection be used by the thread that created it by default.
# FastAPI runs sync routes in a thread pool, so a request's session can move
# between threads. Each request still has its own session, so turning the check off is safe.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

# One engine for the whole app. It manages a pool of reusable connections.
engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=echo)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Turn on foreign key enforcement for each new SQLite connection.

    SQLite leaves foreign key off by default, and the setting applies to one
    connection only, so it must be set every time the pool opens connection.
    Other databases always enforce them, so this does nothing for them.
    """
    cursor = dbapi_connection.cursor()
    if DATABASE_URL.startswith("sqlite"):
        cursor.execute("PRAGMA foreign_keys = ON")
    cursor.close()


# Session factory, built once at startup. Calling SessionLocal() makes a new session.
SessionLocal = sessionmaker(bind=engine)


def get_db():
    """Provide a database session for one request, then close it.

    Used as a FastAPI dependency: ``db: Annotated[Session, Depends(get_db)]``.
    The session is closed after the response, even if the route raised an error.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Create base class
class Base(DeclarativeBase):
    """Base class for all ORM models.

    Every model that inherits from it is registered in ``Base.metadata``,
    which ``create_all`` uses to create the tables.
    """
