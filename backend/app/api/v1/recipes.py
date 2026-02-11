from uuid import UUID

from fastapi import APIRouter

from app.api.deps import AdminOrQA, CurrentUser, DbSession
from app.schemas.recipes import (
    IngredientAdd,
    IngredientUpdate,
    RecipeCreate,
    RecipeDetailResponse,
    RecipeResponse,
    RecipeUpdate,
    ScaleRequest,
    ScaledIngredientLine,
    ScaledRecipeResponse,
    StepAdd,
    StepUpdate,
    VersionCreate,
)
from app.schemas.common import IdResponse
from app.schemas.api_response import ApiResponse
from app.services.recipe_service import (
    add_ingredient,
    add_step,
    create_recipe,
    create_version,
    delete_ingredient,
    delete_recipe,
    delete_step,
    get_recipe,
    get_scaled_recipe,
    list_recipes,
    release_recipe_version,
    retire_recipe_version,
    update_ingredient,
    update_recipe,
    update_step,
)

router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.get("", response_model=list[RecipeResponse])
def list_all(db: DbSession):
    return list_recipes(db)


@router.get("/{recipe_id}", response_model=RecipeDetailResponse)
def get_one(recipe_id: UUID, db: DbSession):
    recipe = get_recipe(db, recipe_id)
    versions = []
    for v in recipe.versions:
        if v.is_deleted:
            continue
        ingredients = []
        for ing in v.ingredients:
            if ing.is_deleted:
                continue
            ingredients.append({
                "recipe_version_ingredient_id": ing.recipe_version_ingredient_id,
                "ingredient_id": ing.ingredient_id,
                "ingredient_name": ing.ingredient.name if ing.ingredient else "",
                "base_amount": float(ing.base_amount),
                "unit_id": ing.unit_id,
                "unit_abbreviation": ing.unit.abbreviation if ing.unit else "",
                "sort_order": ing.sort_order,
                "rounding_mode": ing.rounding_mode,
                "rounding_decimals": ing.rounding_decimals,
                "rounding_increment": float(ing.rounding_increment) if ing.rounding_increment else None,
                "notes": ing.notes,
            })
        steps = []
        for s in v.steps:
            if s.is_deleted:
                continue
            steps.append({
                "recipe_version_step_id": s.recipe_version_step_id,
                "step_number": s.step_number,
                "instruction": s.instruction,
                "critical_control_point": s.critical_control_point,
                "notes": s.notes,
            })
        versions.append({
            "recipe_version_id": v.recipe_version_id,
            "recipe_id": v.recipe_id,
            "version_number": v.version_number,
            "title": v.title,
            "notes": v.notes,
            "base_yield_value": float(v.base_yield_value),
            "base_yield_unit_id": v.base_yield_unit_id,
            "is_current": v.is_current,
            "status": v.status or "Draft",
            "released_at": v.released_at,
            "ingredients": ingredients,
            "steps": steps,
        })
    return RecipeDetailResponse(
        recipe_id=recipe.recipe_id,
        name=recipe.name,
        description=recipe.description,
        recipe_category_id=recipe.recipe_category_id,
        default_base_yield_value=float(recipe.default_base_yield_value),
        default_base_yield_unit_id=recipe.default_base_yield_unit_id,
        is_active=recipe.is_active,
        created_at=recipe.created_at,
        versions=versions,
    )


@router.post("", response_model=IdResponse, status_code=201)
def create(body: RecipeCreate, current_user: CurrentUser, db: DbSession):
    recipe = create_recipe(
        db,
        name=body.name,
        description=body.description,
        default_base_yield_value=body.default_base_yield_value,
        default_base_yield_unit_id=body.default_base_yield_unit_id,
    )
    db.commit()
    return IdResponse(id=recipe.recipe_id)


@router.patch("/{recipe_id}", response_model=RecipeResponse)
def update(recipe_id: UUID, body: RecipeUpdate, current_user: CurrentUser, db: DbSession):
    recipe = get_recipe(db, recipe_id)
    update_recipe(db, recipe, **body.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(recipe)
    return recipe


@router.delete("/{recipe_id}", status_code=204)
def delete(recipe_id: UUID, current_user: CurrentUser, db: DbSession):
    recipe = get_recipe(db, recipe_id)
    delete_recipe(db, recipe)
    db.commit()


@router.post("/{recipe_id}/versions/{version_id}/release")
def release_version(recipe_id: UUID, version_id: UUID, current_user: AdminOrQA, db: DbSession):
    version = release_recipe_version(db, version_id, current_user)
    db.commit()
    return ApiResponse.ok({"recipe_version_id": str(version.recipe_version_id), "status": version.status})


@router.post("/{recipe_id}/versions/{version_id}/retire")
def retire_version(recipe_id: UUID, version_id: UUID, current_user: AdminOrQA, db: DbSession):
    version = retire_recipe_version(db, version_id, current_user)
    db.commit()
    return ApiResponse.ok({"recipe_version_id": str(version.recipe_version_id), "status": version.status})


# ── Version CRUD ───────────────────────────────────────────────────

@router.post("/{recipe_id}/versions", status_code=201)
def create_ver(recipe_id: UUID, body: VersionCreate, current_user: CurrentUser, db: DbSession):
    version = create_version(
        db, recipe_id,
        base_yield_value=body.base_yield_value,
        base_yield_unit_id=body.base_yield_unit_id,
        title=body.title,
        notes=body.notes,
    )
    db.commit()
    return {"recipe_version_id": str(version.recipe_version_id), "version_number": version.version_number}


# ── Ingredient CRUD ────────────────────────────────────────────────

@router.post("/{recipe_id}/versions/{version_id}/ingredients", status_code=201)
def add_ing(recipe_id: UUID, version_id: UUID, body: IngredientAdd, current_user: CurrentUser, db: DbSession):
    ing = add_ingredient(db, version_id, **body.model_dump())
    db.commit()
    return {"recipe_version_ingredient_id": str(ing.recipe_version_ingredient_id)}


@router.patch("/{recipe_id}/versions/{version_id}/ingredients/{ingredient_id}")
def update_ing(recipe_id: UUID, version_id: UUID, ingredient_id: UUID, body: IngredientUpdate, current_user: CurrentUser, db: DbSession):
    ing = update_ingredient(db, version_id, ingredient_id, **body.model_dump(exclude_unset=True))
    db.commit()
    return {"recipe_version_ingredient_id": str(ing.recipe_version_ingredient_id)}


@router.delete("/{recipe_id}/versions/{version_id}/ingredients/{ingredient_id}", status_code=204)
def remove_ing(recipe_id: UUID, version_id: UUID, ingredient_id: UUID, current_user: CurrentUser, db: DbSession):
    delete_ingredient(db, version_id, ingredient_id)
    db.commit()


# ── Step CRUD ──────────────────────────────────────────────────────

@router.post("/{recipe_id}/versions/{version_id}/steps", status_code=201)
def add_stp(recipe_id: UUID, version_id: UUID, body: StepAdd, current_user: CurrentUser, db: DbSession):
    step = add_step(db, version_id, **body.model_dump())
    db.commit()
    return {"recipe_version_step_id": str(step.recipe_version_step_id)}


@router.patch("/{recipe_id}/versions/{version_id}/steps/{step_id}")
def update_stp(recipe_id: UUID, version_id: UUID, step_id: UUID, body: StepUpdate, current_user: CurrentUser, db: DbSession):
    step = update_step(db, version_id, step_id, **body.model_dump(exclude_unset=True))
    db.commit()
    return {"recipe_version_step_id": str(step.recipe_version_step_id)}


@router.delete("/{recipe_id}/versions/{version_id}/steps/{step_id}", status_code=204)
def remove_stp(recipe_id: UUID, version_id: UUID, step_id: UUID, current_user: CurrentUser, db: DbSession):
    delete_step(db, version_id, step_id)
    db.commit()


@router.post("/scale", response_model=ScaledRecipeResponse)
def scale(body: ScaleRequest, db: DbSession):
    data = get_scaled_recipe(
        db, body.recipe_version_id, body.target_yield_value, body.target_yield_unit_id
    )
    header = data["header"]
    ingredients = [
        ScaledIngredientLine(
            ingredient_name=i.get("ingredient_name", ""),
            base_amount=float(i.get("base_amount", 0)),
            unit_abbreviation=i.get("unit_abbrev", ""),
            scale_factor=float(i.get("scale_factor", 1)),
            scaled_amount_raw=float(i.get("scaled_amount_raw", 0)),
            scaled_amount_rounded=float(i.get("scaled_amount_rounded", 0)),
            rounding_mode=i.get("rounding_mode"),
            sort_order=i.get("sort_order", 0),
        )
        for i in data["ingredients"]
    ]
    steps = [
        {
            "recipe_version_step_id": "00000000-0000-0000-0000-000000000000",
            "step_number": s.get("step_number", 0),
            "instruction": s.get("instruction", ""),
            "critical_control_point": s.get("critical_control_point", False),
            "notes": s.get("notes"),
        }
        for s in data["steps"]
    ]
    return ScaledRecipeResponse(
        recipe_name=header.get("recipe_name", ""),
        version_number=header.get("version_number", 0),
        base_yield_value=float(header.get("base_yield_value", 0)),
        base_yield_unit=header.get("base_yield_unit", ""),
        target_yield_value=float(header.get("target_yield_value", 0)),
        target_yield_unit=header.get("target_yield_unit", ""),
        scale_factor=float(header.get("scale_factor", 1)),
        ingredients=ingredients,
        steps=steps,
    )
