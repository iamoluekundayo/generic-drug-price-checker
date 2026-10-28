"""Authentication endpoints: account registration.

All routes are mounted under ``/auth``. Passwords are hashed with Argon2
before storage and are never returned in a response
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas import UserCreate, UserResult
from app.security import hash_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResult, status_code=201)
def register(body: UserCreate, db: Annotated[Session, Depends(get_db)]) -> User:
    """Create a new user account.

    The email is normalized to lowercase so that addresses differing only in
    case are treated as the same account. The plain-text password is hashed
    and then discard.

    Args:
        body: Registration details (name, email and plain-text password).
        db: Database session, provided per request by ``get_db``.

    Returns:
        The newly created user. ``response_model=UserResult`` limits the
        response to public fields, so ``password_hash`` is never sent.

    Raises:
        HTTPException: 409 Conflict if the email is already registered.
    """
    user = User(
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email.lower(),
        password_hash=hash_password(body.password),
    )
    db.add(user)
    # Rely on the unique constraint on ``users.email`` instead of checking for
    # an existing user first. A separate check could pass for two simultaneous
    # requests, and both would then insert. The constraint cannot be bypassed.
    try:
        db.commit()
    except IntegrityError:
        # A failed commit leaves the session unusable until it is rolled back
        db.rollback()
        # ``from None`` keeps the database error out of the logs, since a
        # duplicate email is an expected case rather than a server fault
        raise HTTPException(
            status_code=409, detail="Email already registered"
        ) from None

    # Load database-assigned values while the session is open
    db.refresh(user)
    return user
