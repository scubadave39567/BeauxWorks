from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SaleCreate(BaseModel):
    product_id: UUID
    facility_id: UUID
    sales_channel_id: UUID
    sale_date: datetime
    quantity: float
    unit_id: UUID
    unit_price: float
    customer_name: str | None = None
    notes: str | None = None


class SaleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sale_id: UUID
    product_id: UUID
    facility_id: UUID
    sales_channel_id: UUID
    sale_date: datetime
    quantity: float
    unit_id: UUID
    unit_price: float
    total_price: float | None = None
    customer_name: str | None = None
    notes: str | None = None
    created_at: datetime


class SalesSummaryResponse(BaseModel):
    product_name: str
    channel_name: str
    sale_day: str
    transaction_count: int
    total_quantity: float
    total_revenue: float
