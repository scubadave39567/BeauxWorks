from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    role_id: UUID
    name: str
    description: str | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    email: str
    display_name: str
    is_active: bool
    created_at: datetime


class UserMeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    email: str
    display_name: str
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime
    roles: list[str] = []
    mfa_enabled: bool = False
    phone: str | None = None
    address: str | None = None
    profile_photo_attachment_id: UUID | None = None


class UserProfileUpdate(BaseModel):
    display_name: str | None = None
    phone: str | None = None
    address: str | None = None
    profile_photo_attachment_id: UUID | None = None
