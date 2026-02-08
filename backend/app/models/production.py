"""Phase 4: Production Runs + Quality & Process Logging models."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, LargeBinary, Numeric, String, Text, text
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, pk_column


class ProductType(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "product_types"

    product_type_id: Mapped[uuid.UUID] = pk_column()
    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)


class QualityMetricType(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "quality_metric_types"

    quality_metric_type_id: Mapped[uuid.UUID] = pk_column()
    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    unit_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=True
    )
    value_type: Mapped[str] = mapped_column(String(20), nullable=False)
    min_value: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    max_value: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    unit = relationship("Unit", foreign_keys=[unit_id])


class ProductionRun(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "production_runs"

    production_run_id: Mapped[uuid.UUID] = pk_column()
    recipe_version_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("recipe_versions.recipe_version_id"), nullable=False
    )
    run_status_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("run_statuses.run_status_id"), nullable=False
    )
    facility_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("facilities.facility_id"), nullable=False
    )
    operator_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("users.user_id"), nullable=True
    )
    product_type_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("product_types.product_type_id"), nullable=True
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("products.product_id"), nullable=True
    )
    planned_start_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    target_yield_value: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    target_yield_unit_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=False
    )
    actual_yield_value: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    actual_yield_unit_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=True
    )
    lot_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    recipe_version = relationship("RecipeVersion", foreign_keys=[recipe_version_id])
    run_status = relationship("RunStatus", foreign_keys=[run_status_id])
    facility = relationship("Facility", foreign_keys=[facility_id])
    operator = relationship("User", foreign_keys=[operator_user_id])
    product_type = relationship("ProductType", foreign_keys=[product_type_id])
    target_yield_unit = relationship("Unit", foreign_keys=[target_yield_unit_id])
    actual_yield_unit = relationship("Unit", foreign_keys=[actual_yield_unit_id])

    run_code: Mapped["ProductionRunCode | None"] = relationship(back_populates="production_run", uselist=False)
    run_ingredients: Mapped[list["ProductionRunIngredient"]] = relationship(back_populates="production_run")
    quality_logs: Mapped[list["ProductionRunQualityLog"]] = relationship(back_populates="production_run")
    deviations: Mapped[list["ProductionRunDeviation"]] = relationship(back_populates="production_run")
    distributions: Mapped[list["ProductionRunDistribution"]] = relationship(back_populates="production_run")


class ProductionRunCode(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "production_run_codes"

    production_run_code_id: Mapped[uuid.UUID] = pk_column()
    production_run_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("production_runs.production_run_id"), nullable=False, unique=True
    )
    code_value: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    code_type: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'qr'")
    )
    issued_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("SYSUTCDATETIME()")
    )

    production_run: Mapped["ProductionRun"] = relationship(back_populates="run_code")


class ProductionRunIngredient(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "production_run_ingredients"

    production_run_ingredient_id: Mapped[uuid.UUID] = pk_column()
    production_run_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("production_runs.production_run_id"), nullable=False
    )
    ingredient_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("ingredients.ingredient_id"), nullable=False
    )
    scaled_amount: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    unit_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=False
    )
    rounding_applied: Mapped[str | None] = mapped_column(String(50), nullable=True)

    production_run: Mapped["ProductionRun"] = relationship(back_populates="run_ingredients")
    ingredient = relationship("Ingredient", foreign_keys=[ingredient_id])
    unit = relationship("Unit", foreign_keys=[unit_id])


class QualityTemplate(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "quality_templates"

    quality_template_id: Mapped[uuid.UUID] = pk_column()
    product_type_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("product_types.product_type_id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("1"))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    product_type = relationship("ProductType", foreign_keys=[product_type_id])
    items: Mapped[list["QualityTemplateItem"]] = relationship(back_populates="template")


class QualityTemplateItem(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "quality_template_items"

    quality_template_item_id: Mapped[uuid.UUID] = pk_column()
    quality_template_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("quality_templates.quality_template_id"), nullable=False
    )
    quality_metric_type_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("quality_metric_types.quality_metric_type_id"), nullable=False
    )
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("1"))
    target_min: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    target_max: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    guidance_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    stage_code: Mapped[str | None] = mapped_column(String(50), nullable=True)

    template: Mapped["QualityTemplate"] = relationship(back_populates="items")
    metric_type = relationship("QualityMetricType", foreign_keys=[quality_metric_type_id])


class ProductionRunQualityLog(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "production_run_quality_logs"

    production_run_quality_log_id: Mapped[uuid.UUID] = pk_column()
    production_run_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("production_runs.production_run_id"), nullable=False
    )
    quality_template_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("quality_template_items.quality_template_item_id"), nullable=True
    )
    quality_metric_type_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("quality_metric_types.quality_metric_type_id"), nullable=False
    )
    measured_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    measured_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("users.user_id"), nullable=False
    )
    value_numeric: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    value_text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    value_bool: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    unit_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    production_run: Mapped["ProductionRun"] = relationship(back_populates="quality_logs")
    template_item = relationship("QualityTemplateItem", foreign_keys=[quality_template_item_id])
    metric_type = relationship("QualityMetricType", foreign_keys=[quality_metric_type_id])
    measured_by = relationship("User", foreign_keys=[measured_by_user_id])
    unit = relationship("Unit", foreign_keys=[unit_id])


class ProductionRunDeviation(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "production_run_deviations"

    production_run_deviation_id: Mapped[uuid.UUID] = pk_column()
    production_run_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("production_runs.production_run_id"), nullable=False
    )
    detected_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    detected_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("users.user_id"), nullable=False
    )
    deviation_type: Mapped[str] = mapped_column(String(100), nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=False)
    corrective_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("users.user_id"), nullable=True
    )

    production_run: Mapped["ProductionRun"] = relationship(back_populates="deviations")
    detected_by = relationship("User", foreign_keys=[detected_by_user_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_user_id])


class ProductionRunDistribution(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "production_run_distribution"

    production_run_distribution_id: Mapped[uuid.UUID] = pk_column()
    production_run_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("production_runs.production_run_id"), nullable=False
    )
    distributed_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    channel_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("sales_channels.sales_channel_id"), nullable=True
    )
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    quantity: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    unit_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    production_run: Mapped["ProductionRun"] = relationship(back_populates="distributions")
    channel = relationship("SalesChannel", foreign_keys=[channel_id])
    unit = relationship("Unit", foreign_keys=[unit_id])


class ApiIdempotencyKey(Base):
    __tablename__ = "api_idempotency_keys"

    api_idempotency_key_id: Mapped[uuid.UUID] = pk_column()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("users.user_id"), nullable=False
    )
    idempotency_key: Mapped[str] = mapped_column(String(100), nullable=False)
    request_hash: Mapped[bytes | None] = mapped_column(LargeBinary(32), nullable=True)
    response_metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
