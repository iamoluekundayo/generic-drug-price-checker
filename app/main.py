from contextlib import asynccontextmanager

from fastapi import FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app import models  # noqa: F401 (registers every model with Base)
from app.db import Base, engine
from app.limiter import limiter
from app.routers import auth, drugs, quotes, users


@asynccontextmanager
async def lifespan(app):
    # Generate the tables, runs once
    Base.metadata.create_all(engine)
    yield
    # shutdown: runs once, when the app stops
    engine.dispose()


app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.include_router(drugs.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(quotes.router)


@app.get("/")
def home():
    return {"status": "ok"}
