"""QC Plans + QC Entries models."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, text
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, pk_column


class QcPlan(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "qc_plans"

    qc_plan_id: Mapped[uuid.UUID] = pk_column()
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    applies_to_recipe_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    applies_to_recipe_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("recipes.recipe_id"), nullable=True
    )
    applies_to_recipe_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("recipe_versions.recipe_version_id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("1"))

    requirements: Mapped[list["QcPlanRequirement"]] = relationship(back_populates="qc_plan")


class QcPlanRequirement(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "qc_plan_requirements"

    qc_plan_requirement_id: Mapped[uuid.UUID] = pk_column()
    qc_plan_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("qc_plans.qc_plan_id"), nullable=False
    )
    metric_type_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("quality_metric_types.quality_metric_type_id"), nullable=False
    )
    stage: Mapped[str] = mapped_column(String(50), nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("1"))
    min_value: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    max_value: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    fail_requires_deviation: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    qc_plan: Mapped["QcPlan"] = relationship(back_populates="requirements")
    metric_type = relationship("QualityMetricType", foreign_keys=[metric_type_id])


class RunQcEntry(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "run_qc_entries"

    run_qc_entry_id: Mapped[uuid.UUID] = pk_column()
    production_run_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("production_runs.production_run_id"), nullable=False
    )
    metric_type_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("quality_metric_types.quality_metric_type_id"), nullable=False
    )
    stage: Mapped[str] = mapped_column(String(50), nullable=False)
    value_number: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    value_text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    uom_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=True
    )
    observed_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_amended: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("0"))
    amended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    amended_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("users.user_id"), nullable=True
    )
    amended_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("users.user_id"), nullable=False
    )

    metric_type = relationship("QualityMetricType", foreign_keys=[metric_type_id])
    uom = relationship("Unit", foreign_keys=[uom_id])
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    amended_by = relationship("User", foreign_keys=[amended_by_user_id])
