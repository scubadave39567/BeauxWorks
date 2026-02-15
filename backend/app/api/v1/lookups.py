from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.api.deps import DbSession
from app.models.foundations import (
    Facility,
    IngredientCategory,
    ItemType,
    ProductCategory,
    RecipeCategory,
    RunStatus,
    SalesChannel,
    Unit,
)
from app.models.production import ProductType, QualityMetricType
from app.models.recipes import Ingredient
from app.schemas.lookups import (
    FacilityCreate,
    FacilityResponse,
    FacilityUpdate,
    IngredientCategoryCreate,
    IngredientCategoryResponse,
    IngredientCategoryUpdate,
    IngredientCreate,
    IngredientResponse,
    IngredientUpdate,
    ItemTypeCreate,
    ItemTypeResponse,
    ItemTypeUpdate,
    ProductCategoryResponse,
    ProductTypeResponse,
    QualityMetricTypeResponse,
    RecipeCategoryCreate,
    RecipeCategoryResponse,
    RecipeCategoryUpdate,
    RunStatusResponse,
    SalesChannelResponse,
    UnitResponse,
)
from app.schemas.common import IdResponse

router = APIRouter(prefix="/lookups", tags=["lookups"])


@router.get("/units", response_model=list[UnitResponse])
def list_units(db: DbSession):
    return db.query(Unit).filter(Unit.is_deleted == False).order_by(Unit.unit_type, Unit.name).all()


@router.get("/facilities", response_model=list[FacilityResponse])
def list_facilities(db: DbSession):
    return (
        db.query(Facility)
        .filter(Facility.is_deleted == False)
        .order_by(Facility.name)
        .all()
    )


@router.post("/facilities", response_model=FacilityResponse, status_code=201)
def create_facility(payload: FacilityCreate, db: DbSession):
    fac = Facility(**payload.model_dump())
    db.add(fac)
    db.commit()
    db.refresh(fac)
    return fac


@router.patch("/facilities/{facility_id}", response_model=FacilityResponse)
def update_facility(facility_id: UUID, payload: FacilityUpdate, db: DbSession):
    fac = (
        db.query(Facility)
        .filter(Facility.facility_id == facility_id, Facility.is_deleted == False)
        .first()
    )
    if not fac:
        raise HTTPException(status_code=404, detail="Facility not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(fac, field, value)
    db.commit()
    db.refresh(fac)
    return fac


@router.delete("/facilities/{facility_id}", status_code=204)
def delete_facility(facility_id: UUID, db: DbSession):
    fac = (
        db.query(Facility)
        .filter(Facility.facility_id == facility_id, Facility.is_deleted == False)
        .first()
    )
    if not fac:
        raise HTTPException(status_code=404, detail="Facility not found")
    fac.is_deleted = True
    db.commit()


@router.get("/run-statuses", response_model=list[RunStatusResponse])
def list_run_statuses(db: DbSession):
    return (
        db.query(RunStatus)
        .filter(RunStatus.is_deleted == False)
        .order_by(RunStatus.sort_order)
        .all()
    )


@router.get("/sales-channels", response_model=list[SalesChannelResponse])
def list_sales_channels(db: DbSession):
    return (
        db.query(SalesChannel)
        .filter(SalesChannel.is_deleted == False)
        .order_by(SalesChannel.code)
        .all()
    )


# ── Recipe Categories CRUD ──────────────────────────────────────────

@router.get("/recipe-categories", response_model=list[RecipeCategoryResponse])
def list_recipe_categories(db: DbSession):
    return (
        db.query(RecipeCategory)
        .filter(RecipeCategory.is_deleted == False)
        .order_by(RecipeCategory.sort_order)
        .all()
    )


@router.post("/recipe-categories", response_model=IdResponse, status_code=201)
def create_recipe_category(payload: RecipeCategoryCreate, db: DbSession):
    cat = RecipeCategory(**payload.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return IdResponse(id=cat.recipe_category_id)


@router.patch("/recipe-categories/{category_id}", response_model=RecipeCategoryResponse)
def update_recipe_category(category_id: UUID, payload: RecipeCategoryUpdate, db: DbSession):
    cat = (
        db.query(RecipeCategory)
        .filter(RecipeCategory.recipe_category_id == category_id, RecipeCategory.is_deleted == False)
        .first()
    )
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cat, field, value)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/recipe-categories/{category_id}", status_code=204)
def delete_recipe_category(category_id: UUID, db: DbSession):
    cat = (
        db.query(RecipeCategory)
        .filter(RecipeCategory.recipe_category_id == category_id, RecipeCategory.is_deleted == False)
        .first()
    )
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    cat.is_deleted = True
    db.commit()


# ── Item Types CRUD ───────────────────────────────────────────────────

@router.get("/item-types", response_model=list[ItemTypeResponse])
def list_item_types(db: DbSession):
    return (
        db.query(ItemType)
        .filter(ItemType.is_deleted == False)
        .order_by(ItemType.sort_order)
        .all()
    )


@router.post("/item-types", response_model=ItemTypeResponse, status_code=201)
def create_item_type(payload: ItemTypeCreate, db: DbSession):
    it = ItemType(**payload.model_dump())
    db.add(it)
    db.commit()
    db.refresh(it)
    return it


@router.patch("/item-types/{item_type_id}", response_model=ItemTypeResponse)
def update_item_type(item_type_id: UUID, payload: ItemTypeUpdate, db: DbSession):
    it = (
        db.query(ItemType)
        .filter(ItemType.item_type_id == item_type_id, ItemType.is_deleted == False)
        .first()
    )
    if not it:
        raise HTTPException(status_code=404, detail="Item type not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(it, field, value)
    db.commit()
    db.refresh(it)
    return it


@router.delete("/item-types/{item_type_id}", status_code=204)
def delete_item_type(item_type_id: UUID, db: DbSession):
    it = (
        db.query(ItemType)
        .filter(ItemType.item_type_id == item_type_id, ItemType.is_deleted == False)
        .first()
    )
    if not it:
        raise HTTPException(status_code=404, detail="Item type not found")
    it.is_deleted = True
    db.commit()


# ── Ingredient Categories CRUD ────────────────────────────────────────

@router.get("/ingredient-categories", response_model=list[IngredientCategoryResponse])
def list_ingredient_categories(db: DbSession):
    return (
        db.query(IngredientCategory)
        .filter(IngredientCategory.is_deleted == False)
        .order_by(IngredientCategory.sort_order)
        .all()
    )


@router.post("/ingredient-categories", response_model=IngredientCategoryResponse, status_code=201)
def create_ingredient_category(payload: IngredientCategoryCreate, db: DbSession):
    ic = IngredientCategory(**payload.model_dump())
    db.add(ic)
    db.commit()
    db.refresh(ic)
    return ic


@router.patch("/ingredient-categories/{cat_id}", response_model=IngredientCategoryResponse)
def update_ingredient_category(cat_id: UUID, payload: IngredientCategoryUpdate, db: DbSession):
    ic = (
        db.query(IngredientCategory)
        .filter(IngredientCategory.ingredient_category_id == cat_id, IngredientCategory.is_deleted == False)
        .first()
    )
    if not ic:
        raise HTTPException(status_code=404, detail="Ingredient category not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ic, field, value)
    db.commit()
    db.refresh(ic)
    return ic


@router.delete("/ingredient-categories/{cat_id}", status_code=204)
def delete_ingredient_category(cat_id: UUID, db: DbSession):
    ic = (
        db.query(IngredientCategory)
        .filter(IngredientCategory.ingredient_category_id == cat_id, IngredientCategory.is_deleted == False)
        .first()
    )
    if not ic:
        raise HTTPException(status_code=404, detail="Ingredient category not found")
    ic.is_deleted = True
    db.commit()


# ── Other lookups ────────────────────────────────────────────────────

@router.get("/product-categories", response_model=list[ProductCategoryResponse])
def list_product_categories(db: DbSession):
    return (
        db.query(ProductCategory)
        .filter(ProductCategory.is_deleted == False)
        .order_by(ProductCategory.sort_order)
        .all()
    )


@router.get("/product-types", response_model=list[ProductTypeResponse])
def list_product_types(db: DbSession):
    return (
        db.query(ProductType)
        .filter(ProductType.is_deleted == False)
        .order_by(ProductType.name)
        .all()
    )


@router.get("/quality-metric-types", response_model=list[QualityMetricTypeResponse])
def list_quality_metric_types(db: DbSession):
    return (
        db.query(QualityMetricType)
        .filter(QualityMetricType.is_deleted == False)
        .order_by(QualityMetricType.name)
        .all()
    )


@router.get("/ingredients", response_model=list[IngredientResponse])
def list_ingredients(db: DbSession, include_inactive: bool = False):
    q = db.query(Ingredient).filter(Ingredient.is_deleted == False)
    if not include_inactive:
        q = q.filter(Ingredient.is_active == True)
    return q.order_by(Ingredient.name).all()


@router.post("/ingredients", response_model=IngredientResponse, status_code=201)
def create_ingredient(payload: IngredientCreate, db: DbSession):
    ing = Ingredient(**payload.model_dump())
    db.add(ing)
    db.commit()
    db.refresh(ing)
    return ing


@router.patch("/ingredients/{ingredient_id}", response_model=IngredientResponse)
def update_ingredient(ingredient_id: UUID, payload: IngredientUpdate, db: DbSession):
    ing = (
        db.query(Ingredient)
        .filter(Ingredient.ingredient_id == ingredient_id, Ingredient.is_deleted == False)
        .first()
    )
    if not ing:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ing, field, value)
    db.commit()
    db.refresh(ing)
    return ing


@router.delete("/ingredients/{ingredient_id}", status_code=204)
def delete_ingredient(ingredient_id: UUID, db: DbSession):
    ing = (
        db.query(Ingredient)
        .filter(Ingredient.ingredient_id == ingredient_id, Ingredient.is_deleted == False)
        .first()
    )
    if not ing:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    ing.is_deleted = True
    db.commit()
