"""Phase 7: Website CMS / Product Content models."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, text
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, pk_column


class WebsiteProductContent(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "website_product_content"

    website_product_content_id: Mapped[uuid.UUID] = pk_column()
    product_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("products.product_id"), nullable=False, unique=True
    )
    slug: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    public_name: Mapped[str] = mapped_column(String(200), nullable=False)
    public_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    short_description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    display_price: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    price_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    availability_status: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default=text("'in_stock'")
    )
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("0"))
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("0"))
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    meta_title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    meta_description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    product = relationship("Product", foreign_keys=[product_id])
    images: Mapped[list["WebsiteProductImage"]] = relationship(back_populates="content")


class WebsiteProductImage(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "website_product_images"

    website_product_image_id: Mapped[uuid.UUID] = pk_column()
    website_product_content_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER,
        ForeignKey("website_product_content.website_product_content_id"),
        nullable=False,
    )
    attachment_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("attachments.attachment_id"), nullable=True
    )
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    alt_text: Mapped[str | None] = mapped_column(String(300), nullable=True)
    caption: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("0"))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    content: Mapped["WebsiteProductContent"] = relationship(back_populates="images")
    attachment = relationship("Attachment", foreign_keys=[attachment_id])
