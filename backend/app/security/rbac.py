from fastapi import Depends

from app.api.deps import CurrentUser
from app.exceptions import ForbiddenError
from app.models.identity import User


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
