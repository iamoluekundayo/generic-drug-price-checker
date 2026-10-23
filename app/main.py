from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import Base, engine, get_db
from app.models import Drug, Price


@asynccontextmanager
async def lifespan(app):
    # Generate the tables, runs once
    Base.metadata.create_all(engine)
    yield
    # shutdown: runs once, when the app stops
    engine.dispose()


app = FastAPI(lifespan=lifespan)


@app.get("/")
def home():
    return {"status": "ok"}


@app.get("/drugs")
def get_drug(q: str, db: Annotated[Session, Depends(get_db)]):
    return db.scalars(select(Drug).where(Drug.description.ilike(f"%{q}%"))).all()
