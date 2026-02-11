import uuid
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session, selectinload

from app.exceptions import BusinessError, NotFoundError
from app.models.recipes import (
    Ingredient,
    Recipe,
    RecipeVersion,
    RecipeVersionIngredient,
    RecipeVersionStep,
)


def list_recipes(db: Session) -> list[Recipe]:
    return (
        db.query(Recipe)
        .options(selectinload(Recipe.versions))
        .filter(Recipe.is_deleted == False)
        .order_by(Recipe.name)
        .all()
    )


def get_recipe(db: Session, recipe_id: uuid.UUID) -> Recipe:
    recipe = (
        db.query(Recipe)
        .filter(Recipe.recipe_id == recipe_id, Recipe.is_deleted == False)
        .first()
    )
    if not recipe:
        raise NotFoundError("Recipe not found")
    return recipe


def create_recipe(db: Session, *, name: str, description: str | None, default_base_yield_value: float, default_base_yield_unit_id: uuid.UUID) -> Recipe:
    recipe = Recipe(
        name=name,
        description=description,
        default_base_yield_value=default_base_yield_value,
        default_base_yield_unit_id=default_base_yield_unit_id,
    )
    db.add(recipe)
    db.flush()
    return recipe


def update_recipe(db: Session, recipe: Recipe, **kwargs) -> Recipe:
    for key, value in kwargs.items():
        if value is not None:
            setattr(recipe, key, value)
    db.flush()
    return recipe


def delete_recipe(db: Session, recipe: Recipe) -> None:
    recipe.is_deleted = True
    db.flush()


def release_recipe_version(db: Session, version_id: uuid.UUID, user) -> RecipeVersion:
    version = db.query(RecipeVersion).filter(RecipeVersion.recipe_version_id == version_id).first()
    if not version:
        raise NotFoundError("Recipe version not found")
    if version.status != "Draft":
        raise BusinessError(f"Cannot release a version with status '{version.status}'", error_code="INVALID_STATUS")
    version.status = "Released"
    version.released_at = datetime.now(timezone.utc)
    version.released_by_user_id = user.user_id
    db.flush()
    return version


def retire_recipe_version(db: Session, version_id: uuid.UUID, user) -> RecipeVersion:
    version = db.query(RecipeVersion).filter(RecipeVersion.recipe_version_id == version_id).first()
    if not version:
        raise NotFoundError("Recipe version not found")
    if version.status != "Released":
        raise BusinessError(f"Cannot retire a version with status '{version.status}'", error_code="INVALID_STATUS")
    version.status = "Retired"
    db.flush()
    return version


def _get_version_draft(db: Session, version_id: uuid.UUID) -> RecipeVersion:
    version = db.query(RecipeVersion).filter(
        RecipeVersion.recipe_version_id == version_id,
        RecipeVersion.is_deleted == False,
    ).first()
    if not version:
        raise NotFoundError("Recipe version not found")
    if version.status != "Draft":
        raise BusinessError("Only Draft versions can be edited", error_code="VERSION_NOT_DRAFT")
    return version


def create_version(db: Session, recipe_id: uuid.UUID, *, base_yield_value: float, base_yield_unit_id: uuid.UUID, title: str | None = None, notes: str | None = None) -> RecipeVersion:
    recipe = get_recipe(db, recipe_id)
    max_ver = db.query(db.query(RecipeVersion.version_number).filter(
        RecipeVersion.recipe_id == recipe_id, RecipeVersion.is_deleted == False
    ).subquery().c.version_number).scalar() or 0
    # simpler approach
    existing = (
        db.query(RecipeVersion)
        .filter(RecipeVersion.recipe_id == recipe_id, RecipeVersion.is_deleted == False)
        .all()
    )
    next_num = max((v.version_number for v in existing), default=0) + 1
    version = RecipeVersion(
        recipe_id=recipe_id,
        version_number=next_num,
        title=title,
        notes=notes,
        base_yield_value=base_yield_value,
        base_yield_unit_id=base_yield_unit_id,
        is_current=True,
        status="Draft",
    )
    # Mark old versions as not current
    for v in existing:
        v.is_current = False
    db.add(version)
    db.flush()
    return version


def add_ingredient(db: Session, version_id: uuid.UUID, *, ingredient_id: uuid.UUID, base_amount: float, unit_id: uuid.UUID, sort_order: int = 1000, rounding_mode: str | None = None, rounding_decimals: int | None = None, rounding_increment: float | None = None, notes: str | None = None) -> RecipeVersionIngredient:
    _get_version_draft(db, version_id)
    ing = RecipeVersionIngredient(
        recipe_version_id=version_id,
        ingredient_id=ingredient_id,
        base_amount=base_amount,
        unit_id=unit_id,
        sort_order=sort_order,
        rounding_mode=rounding_mode,
        rounding_decimals=rounding_decimals,
        rounding_increment=rounding_increment,
        notes=notes,
    )
    db.add(ing)
    db.flush()
    return ing


def update_ingredient(db: Session, version_id: uuid.UUID, ingredient_line_id: uuid.UUID, **kwargs) -> RecipeVersionIngredient:
    _get_version_draft(db, version_id)
    ing = db.query(RecipeVersionIngredient).filter(
        RecipeVersionIngredient.recipe_version_ingredient_id == ingredient_line_id,
        RecipeVersionIngredient.is_deleted == False,
    ).first()
    if not ing:
        raise NotFoundError("Ingredient not found")
    for key, value in kwargs.items():
        if value is not None:
            setattr(ing, key, value)
    db.flush()
    return ing


def delete_ingredient(db: Session, version_id: uuid.UUID, ingredient_line_id: uuid.UUID) -> None:
    _get_version_draft(db, version_id)
    ing = db.query(RecipeVersionIngredient).filter(
        RecipeVersionIngredient.recipe_version_ingredient_id == ingredient_line_id,
        RecipeVersionIngredient.is_deleted == False,
    ).first()
    if not ing:
        raise NotFoundError("Ingredient not found")
    ing.is_deleted = True
    db.flush()


def add_step(db: Session, version_id: uuid.UUID, *, step_number: int, instruction: str, critical_control_point: bool = False, notes: str | None = None) -> RecipeVersionStep:
    _get_version_draft(db, version_id)
    step = RecipeVersionStep(
        recipe_version_id=version_id,
        step_number=step_number,
        instruction=instruction,
        critical_control_point=critical_control_point,
        notes=notes,
    )
    db.add(step)
    db.flush()
    return step


def update_step(db: Session, version_id: uuid.UUID, step_id: uuid.UUID, **kwargs) -> RecipeVersionStep:
    _get_version_draft(db, version_id)
    step = db.query(RecipeVersionStep).filter(
        RecipeVersionStep.recipe_version_step_id == step_id,
        RecipeVersionStep.is_deleted == False,
    ).first()
    if not step:
        raise NotFoundError("Step not found")
    for key, value in kwargs.items():
        if value is not None:
            setattr(step, key, value)
    db.flush()
    return step


def delete_step(db: Session, version_id: uuid.UUID, step_id: uuid.UUID) -> None:
    _get_version_draft(db, version_id)
    step = db.query(RecipeVersionStep).filter(
        RecipeVersionStep.recipe_version_step_id == step_id,
        RecipeVersionStep.is_deleted == False,
    ).first()
    if not step:
        raise NotFoundError("Step not found")
    step.is_deleted = True
    db.flush()


def get_scaled_recipe(
    db: Session,
    recipe_version_id: uuid.UUID,
    target_yield_value: float,
    target_yield_unit_id: uuid.UUID,
) -> dict:
    """Call sp_get_scaled_recipe and return the three result sets."""
    conn = db.connection()
    raw = conn.connection.cursor()
    raw.execute(
        "EXEC dbo.sp_get_scaled_recipe ?, ?, ?",
        [str(recipe_version_id), target_yield_value, str(target_yield_unit_id)],
    )

    # Result Set 1: Header
    header_cols = [col[0] for col in raw.description]
    header_row = raw.fetchone()
    header = dict(zip(header_cols, header_row)) if header_row else {}

    # Result Set 2: Ingredients
    raw.nextset()
    ing_cols = [col[0] for col in raw.description]
    ingredients = [dict(zip(ing_cols, row)) for row in raw.fetchall()]

    # Result Set 3: Steps
    raw.nextset()
    step_cols = [col[0] for col in raw.description]
    steps = [dict(zip(step_cols, row)) for row in raw.fetchall()]

    return {"header": header, "ingredients": ingredients, "steps": steps}
