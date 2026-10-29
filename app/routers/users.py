from typing import Annotated

from fastapi import APIRouter, Depends

from app.models import User
from app.schemas import UserResult
from app.security import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResult)
def get_user(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user
