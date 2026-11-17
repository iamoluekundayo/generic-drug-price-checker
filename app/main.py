"""FASTAPI application entry point.

Creates the app, creates database tables at startup, sets up rate
limiting and error handling, includes the API routers, and servers the
front end from ``static/``.

Run with: ``uvicorn app.main:app --reload``
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app import models  # noqa: F401 (registers every model with Base)
from app.db import Base, engine
from app.limiter import limiter
from app.routers import auth, drugs, quotes, users

DOCS_PATHS = ("/docs", "/redoc")


@asynccontextmanager
async def lifespan(app):
    """Run setup when the app starts and clean up when it stops.

    Startup: create any missing database tables.
    Shutdown: close the engine's pooled database connections.
    """
    Base.metadata.create_all(engine)
    yield
    engine.dispose()


app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    if not request.url.path.startswith(DOCS_PATHS):
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' https://cdn.jsdelivr.net; "
            "style-src 'self' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Add strict-transport-security later, once the app is served over HTTPS
    return response


app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return unexpected errors as JSON, matching the API's other errors."""
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong. Please try again."},
    )


app.include_router(drugs.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(quotes.router)


@app.get("/health")
def health_check():
    """Report that the server is running."""
    return {"status": "ok"}


# Mus stay last: a mount at "/" matches every path, so any route add after it is unreachable.
app.mount("/", StaticFiles(directory="static", html=True), name="static")
# TODO: Clean missing or dirty values
# TODO: Set last_seen on each import
