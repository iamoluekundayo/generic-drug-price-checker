"""Password hashing and login tokens (JWTs).

Passwords are never stored. Only an Argon2 hash is kept in ``users.password_hash``,
and a login check hashes what the user typed and compares it to that hash.

After logging in, a user gets a JWT: a signed token holding their user id
(``sub``) and an expiry time (``exp``). The token is signed with SECRET_KEY, so
it can't be edited without the signature breaking. It is signed, not encrypted:
"""

import os
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User

load_dotenv()


SECRET_KEY = os.environ["SECRET_KEY"]
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
ALGORITHM = "HS256"

# Argon2 with pwdlib's recommended settings. Each hash string stores its own
# salt and settings, so it is the only thing that needs saving.
password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Return an Argon2 hash of ``password`` for storing in the database."""
    return password_hash.hash(password)


DUMMY_HASH = hash_password("any fixed string")


def verify_password(password: str, hashed: str) -> bool:
    """Return True if ``password`` matches the stored hash ``hashed``."""
    return password_hash.verify(password, hashed)


def create_access_token(user_id: int) -> str:
    """Return a signed JWT for ``user_id`` that expires after the set minutes."""
    payload = {
        # PyJWT requires the subject claim to be a string
        "sub": str(user_id),
        "exp": datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# Reads the token from the "Authorization: Bearer <token>" header and returns
# a 401 by itself it the header is missing: tokenUrl tells the /docs Authorize
# button where to log in
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Dependency for protected routes: return the user the token belongs to.

    Raises 401 if the token is invalid, expired or missing a claim, or if its
    user no longer exists. Every failure gives the same response, so a caller
    learns nothing about why it failed.
    """
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Checks the signature and the expiry, and rejects tokens without
        # both claims, so a token can't be made to last forever.
        payload = jwt.decode(
            token,
            SECRET_KEY,
            options={"require": ["exp", "sub"]},
            algorithms=[ALGORITHM],
        )
    except jwt.InvalidTokenError:
        # Covers a bad signature, a malformed token and an expired token.
        raise credentials_exception from None
    user = db.get(User, int(payload["sub"]))
    if user is None:
        # A valid token for a deleted user is still refused
        raise credentials_exception
    return user
