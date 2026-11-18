"""Routes for the logged-in user's own account."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.models import User
from app.schemas import UserResult
from app.security import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


# response_model=UserResult limits the response to the schema's fields,
# so password_hash on the User model is never sent.
@router.get("/me", response_model=UserResult)
def get_user(current_user: Annotated[User, Depends(get_current_user)]):
    """Return the logged-in user's profile.

    Requires a valid token, Returns 401 if it's missing, invalid or expired.
    """
    return current_user
