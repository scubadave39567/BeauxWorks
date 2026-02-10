"""Phase 1: Identity & Access Control models."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, LargeBinary, String, Text, text
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, pk_column


class User(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    user_id: Mapped[uuid.UUID] = pk_column()
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(500), nullable=False)
    password_algo: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default=text("'argon2id'")
    )
    password_updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("1"))
    failed_login_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    profile_photo_attachment_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, nullable=True
    )

    # Relationships
    user_roles: Mapped[list["UserRole"]] = relationship(back_populates="user", lazy="selectin")
    user_mfa: Mapped[list["UserMfa"]] = relationship(back_populates="user")
    recovery_codes: Mapped[list["UserRecoveryCode"]] = relationship(back_populates="user")
    refresh_tokens: Mapped[list["UserRefreshToken"]] = relationship(back_populates="user")


class Role(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "roles"

    role_id: Mapped[uuid.UUID] = pk_column()
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    user_roles: Mapped[list["UserRole"]] = relationship(back_populates="role")


class UserRole(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "user_roles"

    user_role_id: Mapped[uuid.UUID] = pk_column()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("users.user_id"), nullable=False
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("roles.role_id"), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="user_roles", lazy="joined")
    role: Mapped["Role"] = relationship(back_populates="user_roles", lazy="joined")


class UserMfa(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "user_mfa"

    user_mfa_id: Mapped[uuid.UUID] = pk_column()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("users.user_id"), nullable=False
    )
    mfa_type: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default=text("'totp'")
    )
    secret_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("0"))
    enabled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship(back_populates="user_mfa")


class UserRecoveryCode(Base):
    __tablename__ = "user_recovery_codes"

    recovery_code_id: Mapped[uuid.UUID] = pk_column()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("users.user_id"), nullable=False
    )
    code_hash: Mapped[bytes] = mapped_column(LargeBinary(64), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("SYSUTCDATETIME()")
    )

    user: Mapped["User"] = relationship(back_populates="recovery_codes")


class UserRefreshToken(Base):
    __tablename__ = "user_refresh_tokens"

    refresh_token_id: Mapped[uuid.UUID] = pk_column()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("users.user_id"), nullable=False
    )
    token_hash: Mapped[bytes] = mapped_column(LargeBinary(64), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    device_info: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("SYSUTCDATETIME()")
    )

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class AuditLog(Base):
    __tablename__ = "audit_log"

    audit_log_id: Mapped[uuid.UUID] = pk_column()
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("users.user_id"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UNIQUEIDENTIFIER, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    details_json: Mapped[str | None] = mapped_column(Text, nullable=True)
