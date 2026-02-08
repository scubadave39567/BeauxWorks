from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RecipeVersionIngredientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    recipe_version_ingredient_id: UUID
    ingredient_id: UUID
    ingredient_name: str = ""
    base_amount: float
    unit_id: UUID
    unit_abbreviation: str = ""
    sort_order: int
    rounding_mode: str | None = None
    rounding_decimals: int | None = None
    rounding_increment: float | None = None
    notes: str | None = None


class RecipeVersionStepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    recipe_version_step_id: UUID
    step_number: int
    instruction: str
    critical_control_point: bool
    notes: str | None = None


class RecipeVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    recipe_version_id: UUID
    recipe_id: UUID
    version_number: int
    title: str | None = None
    notes: str | None = None
    base_yield_value: float
    base_yield_unit_id: UUID
    is_current: bool
    ingredients: list[RecipeVersionIngredientResponse] = []
    steps: list[RecipeVersionStepResponse] = []


class RecipeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    recipe_id: UUID
    name: str
    description: str | None = None
    default_base_yield_value: float
    default_base_yield_unit_id: UUID
    is_active: bool
    created_at: datetime


class RecipeDetailResponse(RecipeResponse):
    versions: list[RecipeVersionResponse] = []


class RecipeCreate(BaseModel):
    name: str
    description: str | None = None
    default_base_yield_value: float
    default_base_yield_unit_id: UUID


class RecipeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    default_base_yield_value: float | None = None
    default_base_yield_unit_id: UUID | None = None
    is_active: bool | None = None


class ScaleRequest(BaseModel):
    recipe_version_id: UUID
    target_yield_value: float
    target_yield_unit_id: UUID


class ScaledIngredientLine(BaseModel):
    ingredient_name: str
    base_amount: float
    unit_abbreviation: str
    scale_factor: float
    scaled_amount_raw: float
    scaled_amount_rounded: float
    rounding_mode: str | None = None
    sort_order: int


class ScaledRecipeResponse(BaseModel):
    recipe_name: str
    version_number: int
    base_yield_value: float
    base_yield_unit: str
    target_yield_value: float
    target_yield_unit: str
    scale_factor: float
    ingredients: list[ScaledIngredientLine]
    steps: list[RecipeVersionStepResponse]
