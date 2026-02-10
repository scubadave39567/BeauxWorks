from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.users import UserMeResponse, UserProfileUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserMeResponse)
def get_me(current_user: CurrentUser):
    roles = [
        ur.role.name
        for ur in current_user.user_roles
        if not ur.is_deleted and ur.role and not ur.role.is_deleted
    ]
    mfa_enabled = any(
        m.is_enabled and not m.is_deleted for m in current_user.user_mfa
    )
    return UserMeResponse(
        user_id=current_user.user_id,
        email=current_user.email,
        display_name=current_user.display_name,
        is_active=current_user.is_active,
        last_login_at=current_user.last_login_at,
        created_at=current_user.created_at,
        roles=roles,
        mfa_enabled=mfa_enabled,
        phone=current_user.phone,
        address=current_user.address,
        profile_photo_attachment_id=current_user.profile_photo_attachment_id,
    )


@router.patch("/me", response_model=UserMeResponse)
def update_me(payload: UserProfileUpdate, current_user: CurrentUser, db: DbSession):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return get_me(current_user)
