import os

from dotenv import load_dotenv

# libraries to build engine, base class, to make sessions
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# read .env file
load_dotenv()


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

# Create the engine; an object as a connection the database
engine = create_engine(DATABASE_URL, connect_args=connect_args)

# Session: a workspace for one unit of work
SessionLocal = sessionmaker(bind=engine)


# Create base class
class Base(DeclarativeBase):
    pass


def get_db():
    # Makes a fresh session for one request
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
