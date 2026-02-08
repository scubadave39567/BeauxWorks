"""Phase 6: Products + Sales + Compliance + Attachments models."""

import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, Computed, Date, DateTime, ForeignKey, LargeBinary, Numeric, String, Text, text
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, pk_column


class Product(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "products"

    product_id: Mapped[uuid.UUID] = pk_column()
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    product_type_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("product_types.product_type_id"), nullable=False
    )
    product_category_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("product_categories.product_category_id"), nullable=True
    )
    sku: Mapped[str | None] = mapped_column(String(100), nullable=True)
    default_price: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    default_unit_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("1"))

    product_type = relationship("ProductType", foreign_keys=[product_type_id])
    product_category = relationship("ProductCategory", foreign_keys=[product_category_id])
    default_unit = relationship("Unit", foreign_keys=[default_unit_id])
    compliance_profile: Mapped["ProductComplianceProfile | None"] = relationship(
        back_populates="product", uselist=False
    )


class ProductComplianceProfile(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "product_compliance_profiles"

    product_compliance_profile_id: Mapped[uuid.UUID] = pk_column()
    product_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("products.product_id"), nullable=False, unique=True
    )
    classification_code: Mapped[str] = mapped_column(String(50), nullable=False)
    requires_scheduled_process: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    requires_ph_logging: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    requires_temp_logging: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    requires_aw_logging: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    requires_salinity_logging: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    product: Mapped["Product"] = relationship(back_populates="compliance_profile")


class ScheduledProcessDocument(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "scheduled_process_documents"

    scheduled_process_document_id: Mapped[uuid.UUID] = pk_column()
    product_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("products.product_id"), nullable=False
    )
    recipe_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("recipe_versions.recipe_version_id"), nullable=True
    )
    authority_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    authority_contact: Mapped[str | None] = mapped_column(String(200), nullable=True)
    authority_location_state: Mapped[str | None] = mapped_column(String(2), nullable=True)
    document_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    process_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    process_identifier: Mapped[str | None] = mapped_column(String(100), nullable=True)
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("1"))

    product = relationship("Product", foreign_keys=[product_id])


class Sale(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "sales"

    sale_id: Mapped[uuid.UUID] = pk_column()
    product_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("products.product_id"), nullable=False
    )
    facility_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("facilities.facility_id"), nullable=False
    )
    sales_channel_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("sales_channels.sales_channel_id"), nullable=False
    )
    sale_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    unit_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=False
    )
    unit_price: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    total_price: Mapped[float] = mapped_column(
        Numeric(18, 2),
        Computed("CAST(quantity * unit_price AS decimal(18,2))"),
    )
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("users.user_id"), nullable=True
    )

    product = relationship("Product", foreign_keys=[product_id])
    facility = relationship("Facility", foreign_keys=[facility_id])
    sales_channel = relationship("SalesChannel", foreign_keys=[sales_channel_id])
    unit = relationship("Unit", foreign_keys=[unit_id])


class Attachment(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "attachments"

    attachment_id: Mapped[uuid.UUID] = pk_column()
    file_rowguid: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, nullable=False, unique=True, server_default=text("NEWSEQUENTIALID()")
    )
    file_blob: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    file_name: Mapped[str] = mapped_column(String(260), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256_hash: Mapped[bytes | None] = mapped_column(LargeBinary(32), nullable=True)
    uploaded_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("users.user_id"), nullable=False
    )
    facility_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("facilities.facility_id"), nullable=True
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class AttachmentLink(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "attachment_links"

    attachment_link_id: Mapped[uuid.UUID] = pk_column()
    attachment_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("attachments.attachment_id"), nullable=False
    )
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UNIQUEIDENTIFIER, nullable=False)
    link_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    attachment = relationship("Attachment", foreign_keys=[attachment_id])
