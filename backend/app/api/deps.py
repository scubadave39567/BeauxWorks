from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import ForbiddenError, UnauthorizedError
from app.models.identity import User
from app.security.jwt import decode_access_token

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedError()
    token = authorization.removeprefix("Bearer ")
    payload = decode_access_token(token)
    if payload is None:
        raise UnauthorizedError()
    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise UnauthorizedError()
    user = (
        db.query(User)
        .filter(User.user_id == UUID(user_id), User.is_deleted == False, User.is_active == True)
        .first()
    )
    if user is None:
        raise UnauthorizedError()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*role_names: str):
    def _checker(current_user: CurrentUser) -> User:
        user_roles = {
            ur.role.name
            for ur in current_user.user_roles
            if not ur.is_deleted and ur.role and not ur.role.is_deleted
        }
        if not user_roles.intersection(role_names):
            raise ForbiddenError("Insufficient role privileges")
        return current_user

    return _checker
