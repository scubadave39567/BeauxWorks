from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.api.deps import DbSession
from app.models.foundations import (
    Facility,
    ProductCategory,
    RecipeCategory,
    RunStatus,
    SalesChannel,
    Unit,
)
from app.models.production import ProductType, QualityMetricType
from app.schemas.lookups import (
    FacilityResponse,
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
