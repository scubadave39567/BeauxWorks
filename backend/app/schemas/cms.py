from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class WebsiteProductListingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    website_product_content_id: UUID
    product_id: UUID
    slug: str
    public_name: str
    short_description: str | None = None
    display_price: float | None = None
    price_label: str | None = None
    availability_status: str
    is_featured: bool
    primary_image_url: str | None = None
    primary_image_alt: str | None = None


class WebsiteProductDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    website_product_content_id: UUID
    product_id: UUID
    slug: str
    public_name: str
    public_description: str | None = None
    short_description: str | None = None
    display_price: float | None = None
    price_label: str | None = None
    availability_status: str
    is_featured: bool
    meta_title: str | None = None
    meta_description: str | None = None
    images: list["WebsiteProductImageResponse"] = []


class WebsiteProductImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    website_product_image_id: UUID
    attachment_id: UUID | None = None
    image_url: str | None = None
    alt_text: str | None = None
    caption: str | None = None
    is_primary: bool
    sort_order: int


class CmsProductCreate(BaseModel):
    product_id: UUID
    slug: str
    public_name: str
    public_description: str | None = None
    short_description: str | None = None
    display_price: float | None = None
    price_label: str | None = None
    availability_status: str = "in_stock"
    is_published: bool = False
    is_featured: bool = False
    meta_title: str | None = None
    meta_description: str | None = None
    sort_order: int = 0


class CmsProductUpdate(BaseModel):
    slug: str | None = None
    public_name: str | None = None
    public_description: str | None = None
    short_description: str | None = None
    display_price: float | None = None
    price_label: str | None = None
    availability_status: str | None = None
    is_published: bool | None = None
    is_featured: bool | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    sort_order: int | None = None
