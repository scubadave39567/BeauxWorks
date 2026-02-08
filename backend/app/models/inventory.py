"""Phase 5: Inventory + Ingredient Lot Genealogy models."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, text
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, pk_column


class Supplier(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "suppliers"

    supplier_id: Mapped[uuid.UUID] = pk_column()
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(server_default=text("1"))


class IngredientInventory(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "ingredient_inventory"

    ingredient_inventory_id: Mapped[uuid.UUID] = pk_column()
    ingredient_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("ingredients.ingredient_id"), nullable=False
    )
    facility_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("facilities.facility_id"), nullable=False
    )
    quantity_on_hand: Mapped[float] = mapped_column(
        Numeric(18, 6), nullable=False, server_default=text("0")
    )
    unit_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=False
    )
    low_stock_threshold: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)

    ingredient = relationship("Ingredient", foreign_keys=[ingredient_id])
    facility = relationship("Facility", foreign_keys=[facility_id])
    unit = relationship("Unit", foreign_keys=[unit_id])


class IngredientLot(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "ingredient_lots"

    ingredient_lot_id: Mapped[uuid.UUID] = pk_column()
    ingredient_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("ingredients.ingredient_id"), nullable=False
    )
    facility_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("facilities.facility_id"), nullable=False
    )
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("suppliers.supplier_id"), nullable=True
    )
    lot_number: Mapped[str] = mapped_column(String(100), nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    quantity_received: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    unit_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    ingredient = relationship("Ingredient", foreign_keys=[ingredient_id])
    facility = relationship("Facility", foreign_keys=[facility_id])
    supplier = relationship("Supplier", foreign_keys=[supplier_id])
    unit = relationship("Unit", foreign_keys=[unit_id])


class InventoryTransaction(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "inventory_transactions"

    inventory_transaction_id: Mapped[uuid.UUID] = pk_column()
    ingredient_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("ingredients.ingredient_id"), nullable=False
    )
    facility_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("facilities.facility_id"), nullable=False
    )
    ingredient_lot_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("ingredient_lots.ingredient_lot_id"), nullable=True
    )
    production_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("production_runs.production_run_id"), nullable=True
    )
    transaction_type: Mapped[str] = mapped_column(String(50), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    unit_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=False
    )
    reference_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    transacted_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    transacted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("users.user_id"), nullable=True
    )

    ingredient = relationship("Ingredient", foreign_keys=[ingredient_id])
    facility = relationship("Facility", foreign_keys=[facility_id])
    ingredient_lot = relationship("IngredientLot", foreign_keys=[ingredient_lot_id])
    unit = relationship("Unit", foreign_keys=[unit_id])


class ProductionRunIngredientConsumption(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "production_run_ingredient_consumption"

    production_run_ingredient_consumption_id: Mapped[uuid.UUID] = pk_column()
    production_run_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("production_runs.production_run_id"), nullable=False
    )
    ingredient_lot_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("ingredient_lots.ingredient_lot_id"), nullable=False
    )
    quantity_used: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    unit_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=False
    )
    consumed_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    ingredient_lot = relationship("IngredientLot", foreign_keys=[ingredient_lot_id])
    unit = relationship("Unit", foreign_keys=[unit_id])


class ProductLot(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "product_lots"

    product_lot_id: Mapped[uuid.UUID] = pk_column()
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("products.product_id"), nullable=True
    )
    production_run_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("production_runs.production_run_id"), nullable=False
    )
    facility_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("facilities.facility_id"), nullable=False
    )
    lot_code: Mapped[str] = mapped_column(String(64), nullable=False)
    quantity_produced: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    unit_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=False
    )
    produced_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("SYSUTCDATETIME()")
    )

    facility = relationship("Facility", foreign_keys=[facility_id])
    unit = relationship("Unit", foreign_keys=[unit_id])
