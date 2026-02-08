from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    product_type_id: UUID
    product_category_id: UUID | None = None
    sku: str | None = None
    default_price: float | None = None
    default_unit_id: UUID | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    product_type_id: UUID | None = None
    product_category_id: UUID | None = None
    sku: str | None = None
    default_price: float | None = None
    default_unit_id: UUID | None = None
    is_active: bool | None = None


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: UUID
    name: str
    description: str | None = None
    product_type_id: UUID
    product_category_id: UUID | None = None
    sku: str | None = None
    default_price: float | None = None
    default_unit_id: UUID | None = None
    is_active: bool
    created_at: datetime
