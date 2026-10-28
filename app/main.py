from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import models  # noqa: F401 (registers every model with Base)
from app.db import Base, engine
from app.routers import auth, drugs


@asynccontextmanager
async def lifespan(app):
    # Generate the tables, runs once
    Base.metadata.create_all(engine)
    yield
    # shutdown: runs once, when the app stops
    engine.dispose()


app = FastAPI(lifespan=lifespan)
app.include_router(drugs.router)
app.include_router(auth.router)


@app.get("/")
def home():
    return {"status": "ok"}
