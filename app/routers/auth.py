from typing import Annotated

from fastapi import APIRouter
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas import UserCreate, UserResult
from app.security import hash_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResult, status_code=201)
def create_user(body: UserCreate, db: Annotated[Session, get_db]) -> User:
    return User(
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email.lower(),
        password_hash=hash_password(body.password),
    )
