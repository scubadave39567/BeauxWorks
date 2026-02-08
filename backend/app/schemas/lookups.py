from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UnitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    unit_id: UUID
    name: str
    abbreviation: str
    unit_type: str
    is_base_unit: bool


class FacilityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    facility_id: UUID
    name: str
    code: str | None = None
    address: str | None = None
    timezone: str | None = None
    is_active: bool


class RunStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    run_status_id: UUID
    code: str
    name: str
    sort_order: int


class SalesChannelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sales_channel_id: UUID
    code: str
    name: str
    description: str | None = None
    is_active: bool


class RecipeCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    recipe_category_id: UUID
    name: str
    description: str | None = None
    sort_order: int


class ProductCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_category_id: UUID
    name: str
    description: str | None = None
    sort_order: int


class ProductTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_type_id: UUID
    code: str
    name: str
    description: str | None = None


class QualityMetricTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    quality_metric_type_id: UUID
    code: str
    name: str
    unit_id: UUID | None = None
    value_type: str
    min_value: float | None = None
    max_value: float | None = None
