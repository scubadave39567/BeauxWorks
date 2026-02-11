"""Phase 2: Foundation / Lookup tables."""

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, text
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, pk_column


class Facility(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "facilities"

    facility_id: Mapped[uuid.UUID] = pk_column()
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50), nullable=True, unique=True)
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("1"))


class Unit(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "units"

    unit_id: Mapped[uuid.UUID] = pk_column()
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    abbreviation: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    unit_type: Mapped[str] = mapped_column(String(20), nullable=False)
    is_base_unit: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("0"))


class UnitConversion(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "unit_conversions"

    unit_conversion_id: Mapped[uuid.UUID] = pk_column()
    from_unit_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=False
    )
    to_unit_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=False
    )
    multiplier: Mapped[float] = mapped_column(Numeric(18, 8), nullable=False)

    from_unit: Mapped["Unit"] = relationship(foreign_keys=[from_unit_id])
    to_unit: Mapped["Unit"] = relationship(foreign_keys=[to_unit_id])


class RunStatus(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "run_statuses"

    run_status_id: Mapped[uuid.UUID] = pk_column()
    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))


class SalesChannel(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "sales_channels"

    sales_channel_id: Mapped[uuid.UUID] = pk_column()
    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("1"))


class RecipeCategory(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "recipe_categories"

    recipe_category_id: Mapped[uuid.UUID] = pk_column()
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    is_fermented: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("0"))


class StorageLocation(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "storage_locations"

    storage_location_id: Mapped[uuid.UUID] = pk_column()
    facility_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("facilities.facility_id"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("1"))

    facility = relationship("Facility", foreign_keys=[facility_id])


class ItemType(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "item_types"

    item_type_id: Mapped[uuid.UUID] = pk_column()
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))


class IngredientCategory(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "ingredient_categories"

    ingredient_category_id: Mapped[uuid.UUID] = pk_column()
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))


class ProductCategory(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "product_categories"

    product_category_id: Mapped[uuid.UUID] = pk_column()
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
