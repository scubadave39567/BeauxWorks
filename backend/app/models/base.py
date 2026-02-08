import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, text
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("SYSUTCDATETIME()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("SYSUTCDATETIME()"),
    )


class SoftDeleteMixin:
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("0"),
    )


def pk_column():
    """Standard GUID primary key with NEWSEQUENTIALID() server default."""
    return mapped_column(
        UNIQUEIDENTIFIER,
        primary_key=True,
        server_default=text("NEWSEQUENTIALID()"),
        default=uuid.uuid4,
    )
