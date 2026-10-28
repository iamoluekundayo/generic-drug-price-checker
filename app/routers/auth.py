"""Authentication endpoints: account registration.

All routes are mounted under ``/auth``. Passwords are hashed with Argon2
before storage and are never returned in a response
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas import Token, UserCreate, UserResult
from app.security import DUMMY_HASH, create_access_token, hash_password, verify_password

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


@router.post("/login", response_model=Token)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
) -> Token:
    """Authenticate a user and issue a JWT access token.

    Credentials arrive as form data, not JSON, because the OAuths password
    flow requires it. That format is also what lets the "Authorize" button on
    ``/docs`` log in. The spec names the field ``username``, so it carries the
    user's email here

    Args:
        form_data: The submitted ``username`` (email) and ``password``.
        db: Database session, provided per request by ``get_db``.

    Returns:
        A bearer token to send as ``Authorization: Bearer <token>`` on
        protected requests.

    Raises:
        HTTPException: 401 Unauthorized if the email or password is wrong.
    """
    # One error for both failure cases, so the response never reveals whether
    # the email exists or only the password was wrong.
    credentials_exception = HTTPException(
        status_code=401,
        detail="Incorrect email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )
    # Lowercase to match how ``register`` stores emails.
    user = db.scalars(
        select(User).where(User.email == form_data.username.lower())
    ).first()

    if user is None:
        # Run a full Argon2 check against a dummy hash, so an unknown email
        # takes as long as a wrong password. Otherwise response times would
        # reveal which emails are registered.
        verify_password(form_data.password, DUMMY_HASH)
        raise credentials_exception

    if not verify_password(form_data.password, user.password_hash):
        raise credentials_exception

    return Token(access_token=create_access_token(user.id))
