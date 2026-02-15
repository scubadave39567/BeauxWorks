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


class FacilityCreate(BaseModel):
    name: str
    code: str | None = None
    address: str | None = None
    timezone: str | None = None
    is_active: bool = True


class FacilityUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    address: str | None = None
    timezone: str | None = None
    is_active: bool | None = None


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
    is_fermented: bool


class RecipeCategoryCreate(BaseModel):
    name: str
    description: str | None = None
    sort_order: int = 0
    is_fermented: bool = False


class RecipeCategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    sort_order: int | None = None
    is_fermented: bool | None = None


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


class ItemTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    item_type_id: UUID
    name: str
    description: str | None = None
    sort_order: int


class ItemTypeCreate(BaseModel):
    name: str
    description: str | None = None
    sort_order: int = 0


class ItemTypeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    sort_order: int | None = None


class IngredientCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ingredient_category_id: UUID
    name: str
    description: str | None = None
    sort_order: int


class IngredientCategoryCreate(BaseModel):
    name: str
    description: str | None = None
    sort_order: int = 0


class IngredientCategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    sort_order: int | None = None


class IngredientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ingredient_id: UUID
    name: str
    default_unit_id: UUID | None = None
    ingredient_type: str | None = None
    item_type: str = "Material"
    sku: str | None = None
    is_active: bool = True


class IngredientCreate(BaseModel):
    name: str
    default_unit_id: UUID | None = None
    ingredient_type: str | None = None
    item_type: str = "Material"
    sku: str | None = None


class IngredientUpdate(BaseModel):
    name: str | None = None
    default_unit_id: UUID | None = None
    ingredient_type: str | None = None
    item_type: str | None = None
    sku: str | None = None
    is_active: bool | None = None


class QualityMetricTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    quality_metric_type_id: UUID
    code: str
    name: str
    unit_id: UUID | None = None
    data_type: str
    min_value: float | None = None
    max_value: float | None = None
    requires_notes: bool = False
