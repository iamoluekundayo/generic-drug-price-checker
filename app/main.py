from typing import Annotated

from fastapi import Depends, FastAPI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import Base, engine, get_db
from app.models import Drug

app = FastAPI()


@app.get("/")
def home():
    return {"status": "ok"}


# Generate the tables
Base.metadata.create_all(engine)


@app.get("/drugs")
def search_drug(q: str, db: Annotated[Session, Depends(get_db)]):
    return db.scalars(select(Drug).where(Drug.description.ilike(f"%{q}%"))).all()
